import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Employee", 
      required: true 
    },

    profileImage: { 
      type: String, 
      required: false 
    },

    fullname: { 
      type: String, 
      required: true 
    },

    position: { 
      type: String, 
      required: true 
    },

    department: { 
      type: String, 
      required: true,
      default: "General"  // Default department if missing
    },

    task: { 
      type: String, 
      default: "--" 
    },

    status: { 
      type: String, 
      enum: ["Present", "Absent"], 
      required: true, 
      default: "Absent" 
    },

    date: { 
      type: Date, 
      required: true, 
      default: Date.now 
    },
  },
  { timestamps: true }
);

// Pre-validation hook to auto-fill details from Employee
attendanceSchema.pre("validate", async function (next) {
  const Employee = mongoose.model("Employee");
  const employee = await Employee.findById(this.employeeId);

  if (!employee) {
    throw new Error("Employee not found");
  }

  this.fullname = employee.fullname;
  this.position = employee.position;
  this.department = employee.department || "General";
  this.profileImage = employee.profileImage || "";  // Auto-fill profile image

  next();
});

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
