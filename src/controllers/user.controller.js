import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import Candidate from '../models/candidates.model.js';

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
  const { fullname, email, phoneNumber, position, experience, status } = req.body;

  console.log("body data : ", req.body);
  
  if (
    [fullname, email, phoneNumber, position, experience, status].some(
      (field) => field?.trim() === ''
    )
  ) {
    throw new ApiError(400, 'All fields are required!');
  }

  const existingCandidate = Candidate.find({ email });

  if (!existingCandidate) {
    throw new ApiError(400, 'Candidate with this email already exists');
  }

  // const resumeLocalPath = req.file?.path;
  // if (!resumeLocalPath) {
  //   throw new ApiError(400, 'Resume is required');
  // }

  const newCandidate = new Candidate({
    fullname: fullname.toLowerCase(),
    email,
    phoneNumber,
    position,
    experience,
    // resume: resume.url,
    status,
  });

  if (!newCandidate) {
    throw new ApiError(500, 'Something went wrong while creating candidate');
  }

  console.log("database data : ",newCandidate);

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      {newCandidate},
      "candidate created successfully"
    )
  )
  
});

const editCandidate = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; 
    const { fullName, email, phoneNumber, position, experience, status } = req.body;

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      id,
      { fullName, email, phoneNumber, position, experience, status },
      { new: true, runValidators: true }
    );

    if (!updatedCandidate) {
      throw new ApiError(404, "Candidate not found");
    }

    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {updatedCandidate},
        "Candidate details updated successfully"
      )
    )
  } catch (error) {
    throw new ApiError(500, error?.message || "Error updating candidate");
  }
})

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

const updateAvatarImage = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar image is required');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, 'Error while upload avatar image');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'avatar image update successfully'));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, 'Cover image image is required');
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, 'Error while upload cover image');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Cover image update successfully'));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountsDetails,
  updateAvatarImage,
  updateCoverImage,
  addCandidate,
  editCandidate
};
