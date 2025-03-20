import mongoose from "mongoose";
import Attendance from "./attendance.model.js"; // Import Attendance Model

const leaveSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },

    fullName: { type: String, required: true },
    designation: { type: String, required: true },
    leaveDate: { type: Date, required: true },
    leaveDocument: { type: String, required: false }, // File upload (optional)
    reason: { type: String, required: true },
    
    status: { 
      type: String, 
      enum: ["Approved", "Rejected", "Pending"], 
      default: "Pending" 
    },
  },
  { timestamps: true }
});

// Middleware: Ensure Employee is Present in Attendance before applying for leave
leaveSchema.pre("validate", async function (next) {
  try {
    const attendance = await Attendance.findOne({
      employeeId: this.employeeId,
      status: "Present", // Employee must be present
      date: { $eq: this.leaveDate }, // Check for user-selected date
    });

    if (!attendance) {
      throw new Error("Employee must be present on the selected leave date to apply for leave");
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Leave = mongoose.model("Leave", leaveSchema);
export default Leave;
