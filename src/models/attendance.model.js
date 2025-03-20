import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Candidate", 
        required: true 
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    status: { 
        type: String, 
        enum: ["Present", "Absent"], 
        default: "Absent",
        required: true 
    },
  },
  { timestamps: true }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
