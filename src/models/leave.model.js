import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Candidate", 
        required: true 
    },
    leaveDate: { 
        type: Date, 
        required: true 
    },
    reason: { 
        type: String, 
        required: true 
    },
  },
  { timestamps: true }
);

const Leave = mongoose.model("Leave", leaveSchema);
export default Leave;
