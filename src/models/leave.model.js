import mongoose from 'mongoose';
import Attendance from './attendance.model.js';

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    fullname: { type: String, required: true },
    designation: { type: String, required: true },
    leaveDate: { type: Date, required: true },
    leaveDocument: { type: String, required: false },
    reason: { type: String, required: true },

    status: {
      type: String,
      enum: ['Approved', 'Rejected', 'Pending'],
      default: 'Pending',
      required: true
    },
  },
  { timestamps: true }
);


leaveSchema.pre('validate', async function (next) {
  try {
    const attendance = await Attendance.findOne({
      employeeId: this.employeeId,
      status: 'Present',
      date: { $eq: this.leaveDate },
    });

    if (!attendance) {
      throw new Error(
        'Employee must be present on the selected leave date to apply for leave'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;
