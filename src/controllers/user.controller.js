import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import Candidate from '../models/candidates.model.js';
import Employee from '../models/employee.model.js';
import Attendance from '../models/attendance.model.js';
import mongoose from 'mongoose';

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'something went wrong while generating access and refresh token'
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, password, confirmPassword } = req.body;

  if (
    [fullname, email, password, confirmPassword].some(
      (field) => field?.trim() === ''
    )
  ) {
    throw new ApiError(400, 'All fields are required!');
  }

  if (password !== confirmPassword) {
    throw new ApiError(400, 'Password is not matching');
  }

  const existingUser = await User.findOne({ $or: [{ fullname }, { email }] });

  if (existingUser) {
    throw new ApiError(409, 'User with fullname or email already exists');
  }

  const user = await User.create({
    fullname: fullname.toLowerCase(),
    email,
    password,
  });

  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  if (!createdUser) {
    throw new ApiError(500, 'Something went wrong ');
  }

  console.log(createdUser);
});

const loginUser = asyncHandler(async (req, res) => {
  const { fullname, password } = req.body;

  if (!(fullname || password)) {
    throw new ApiError(400, 'All fields required');
  }

  const user = await User.findOne({ fullname: fullname });

  if (!user) {
    throw new ApiError(404, 'user not found!');
  }

  const checkPassword = await user.isPasswordCorrect(password);

  if (!checkPassword) {
    throw new ApiError(401, 'invalid user crenditials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged in successfully'
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User logged out'));
});

const addCandidate = asyncHandler(async (req, res) => {
  const { fullname, email, phoneNumber, position, experience, status } =
    req.body;

  if (
    [fullname, email, phoneNumber, position, experience, status].some(
      (field) => !field?.trim()
    )
  ) {
    throw new ApiError(400, 'All fields are required!');
  }

  const existingCandidate = await Candidate.findOne({ email });

  if (existingCandidate) {
    throw new ApiError(400, 'Candidate with this email already exists');
  }

  const newCandidate = new Candidate({
    fullname: fullname.toLowerCase(),
    email,
    phoneNumber,
    position,
    experience,
    status,
  });

  await newCandidate.save();

  const employeeStatuses = ['New', 'Scheduled', 'Ongoing', 'Selected'];

  if (employeeStatuses.includes(status)) {
    const newEmployee = await Employee.create({
      fullname: newCandidate.fullname,
      email: newCandidate.email,
      phoneNumber: newCandidate.phoneNumber,
      position: newCandidate.position,
      experience: newCandidate.experience,
      department: 'General',
      dateOfJoining: new Date(),
    });

    await Attendance.create({
      employeeId: newEmployee._id,
      profileImage: '',
      fullname: newEmployee.fullname,
      position: newEmployee.position,
      department: newEmployee.department,
      task: '--',
      status: 'Absent',
      date: new Date(),
    });
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newCandidate, 'Candidate created successfully'));
});

const editCandidate = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, email, phoneNumber, position, experience, status } =
      req.body;

    if (
      [fullname, email, phoneNumber, position, experience, status].some(
        (field) => !field?.trim()
      )
    ) {
      throw new ApiError(400, 'All fields are required!');
    }

    if (!id) {
      throw new ApiError(400, 'Candidate ID is required');
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      id,
      { fullname, email, phoneNumber, position, experience, status },
      { new: true, validateBeforeSave: false }
    );

    if (!updatedCandidate) {
      throw new ApiError(404, 'Candidate not found');
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedCandidate,
          'Candidate details updated successfully'
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || 'Error while updating candidate details'
    );
  }
});

const deleteCandidate = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, 'Candidate ID is required');
    }

    const deletedCandidate = await Candidate.findByIdAndDelete(id);

    if (!deletedCandidate) {
      throw new ApiError(404, 'Candidate not found');
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, 'Candidate deleted successfully'));
  } catch (error) {
    throw new ApiError(500, error?.message || 'Error while deleting candidate');
  }
});

const filterCandidate = asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      throw new ApiError(400, 'Status is required for filtering candidates');
    }

    const validStatuses = [
      'New',
      'Scheduled',
      'Ongoing',
      'Selected',
      'Rejected',
    ];
    if (!validStatuses.includes(status)) {
      throw new ApiError(
        400,
        'Invalid status. Allowed values: New, Scheduled, Ongoing, Selected, Rejected'
      );
    }

    const candidates = await Candidate.find({ status });

    return res
      .status(200)
      .json(
        new ApiResponse(200, candidates, 'Candidates filtered successfully')
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || 'Error while filtering candidates'
    );
  }
});

const listOfCandidate = asyncHandler(async (req, res) => {
  const candidates = await Candidate.find();
  console.log(candidates);

  if (!candidates || candidates.length === 0) {
    throw new ApiError(404, 'No candidates found');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { candidates },
        'all cantidate data fetch successfully'
      )
    );
});

const listOfEmployee = asyncHandler(async (req, res) => {
  const employees = await Employee.find();

  if (!employees || employees.length === 0) {
    throw new ApiError(404, 'No employees found');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { employees },
        'all employees data fetch successfully'
      )
    );
});

const listOfAttendanceEmployees = asyncHandler(async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find()
      .populate('employeeId', 'profileImage fullName position department')
      .sort({ date: -1 });

    if (!attendanceRecords || attendanceRecords.length === 0) {
      throw new ApiError(200, 'No records found');
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          attendanceRecords,
          'Attendance data fetched successfully'
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || 'Error fetching attendance records'
    );
  }
});

const editEmployee = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, email, phoneNumber, position, department, experience } =
      req.body;

    if (
      [fullname, email, phoneNumber, position, department, experience].some(
        (field) => !field?.trim
      )
    ) {
      throw new ApiError(400, 'All fields are required!');
    }

    if (!id) {
      throw new ApiError(400, 'Employee ID is required');
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      { fullname, email, phoneNumber, position, experience, department },
      { new: true, validateBeforeSave: false }
    );

    if (!updatedEmployee) {
      throw new ApiError(404, 'Candidate not found');
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedEmployee,
          'Employee details updated successfully'
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || 'Error while updating candidate details'
    );
  }
});

const deleteEmployee = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, 'Employee ID is required');
    }

    const deletedEmployee = await Employee.findByIdAndDelete(id);

    if (!deletedEmployee) {
      throw new ApiError(404, 'Employee not found');
    }

    await Attendance.deleteMany({ employeeId: id });

    return res
      .status(200)
      .json(new ApiResponse(200, null, 'Employee deleted successfully'));
  } catch (error) {
    throw new ApiError(500, error?.message || 'Error while deleting candidate');
  }
});

const editAttendance = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, task } = req.body;

    if (!id) {
      throw new ApiError(400, 'Attendance ID is required');
    }

    if (status && !['Present', 'Absent'].includes(status)) {
      throw new ApiError(
        400,
        'Invalid status. Allowed values: Present, Absent'
      );
    }

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      id,
      { status, task },
      { new: true, runValidators: true }
    );

    if (!updatedAttendance) {
      throw new ApiError(404, 'Attendance record not found');
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedAttendance,
          'Attendance updated successfully'
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || 'Error updating attendance');
  }
});

const addLeave = asyncHandler(async (req, res) => {
  try {
    const { leaveDate, leaveDocument, reason } = req.body;
    const { id } = req.params; // Employee ID from URL params

    if (!id || !leaveDate || !reason) {
      throw new ApiError(400, "Employee ID, leave date, and reason are required");
    }

    // Convert employeeId to ObjectId
    const employeeObjectId = new mongoose.Types.ObjectId(id);

    // Convert leaveDate to proper format
    const leaveDateFormatted = new Date(leaveDate).setHours(0, 0, 0, 0);

    // Check if the employee was Present on the selected leave date
    const attendance = await Attendance.findOne({
      employeeId: employeeObjectId,
      status: "Present",
      date: { $eq: leaveDateFormatted },
    });

    if (!attendance) {
      throw new ApiError(400, "Employee must be present on the selected leave date to apply for leave");
    }

    // Create leave request
    const leaveRequest = await Leave.create({
      employeeId: employeeObjectId,
      fullname: attendance.fullname, // Auto-fill from Attendance
      designation: attendance.position, // Auto-fill from Attendance
      leaveDate: leaveDateFormatted,
      leaveDocument,
      reason,
    });

    return res.status(201).json(new ApiResponse(201, leaveRequest, "Leave request submitted successfully"));
  } catch (error) {
    throw new ApiError(500, error?.message || "Error submitting leave request");
  }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodeToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodeToken?._id);

    if (!user) {
      throw new ApiError(401, 'invalid refresh token');
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, 'refresh token is expired or invalid');
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          'AccessToken refreshed'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'invalid refresh token');
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const passwordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!passwordCorrect) {
    throw new ApiError(400, 'Invalid old password');
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'password change successfully'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.user, 'current user details fetch successfully')
    );
});

const updateAccountsDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, 'all fields required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true }
  ).select('-password');

  return res
    .status(200)
    .json(
      new ApiResponse(200, { user }, 'account details updated successfully')
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountsDetails,
  addCandidate,
  editCandidate,
  listOfCandidate,
  deleteCandidate,
  filterCandidate,
  listOfEmployee,
  editEmployee,
  deleteEmployee,
  listOfAttendanceEmployees,
  editAttendance,
  addLeave,
};
