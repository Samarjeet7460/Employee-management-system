import mongoose from 'mongoose';
import Attendance from './attendance.model.js'; // Import attendance model

const employeeSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phoneNumber: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Phone must be 10 digits'],
    },
    position: { type: String, required: true },
    department: { type: String, required: true, default: 'General' },
    experience: { type: Number, required: true, min: 0 },
    dateOfJoining: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// Middleware: Automatically delete attendance when an employee is removed
employeeSchema.pre('remove', async function (next) {
  await Attendance.deleteMany({ employeeId: this._id }); // Delete related attendance records
  next();
});

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
