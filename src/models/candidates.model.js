import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    srNo: {
      type: Number,
      unique: true,
    },
    fullname: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: Number,
      required: true,
      match: [/^\d{10}$/, "Phone number must be 10 digits"],
    },
    position: {
      type: String,
      required: true,
      enum: ["Intern", "Full Time", "Junior", "Senior", "Team Lead"],
      default: "Intern",
    },
    status: {
      type: String,
      enum: ["New", "Scheduled", "Ongoing", "Selected", "Rejected"],
      default: "New",
    },
    experience: {
      type: Number,
      required: true,
      min: 0,
    },
    resume: {
      type: String,
      required: true, // Stores resume file name
    },
    profileImage: {
      type: String,
      required: true, // Stores profile image file name
    },
  },
  { timestamps: true }
);

// Auto-increment srNo before saving
candidateSchema.pre("save", async function (next) {
  if (!this.srNo) {
    const lastCandidate = await mongoose
      .model("Candidate", candidateSchema)
      .findOne({}, {}, { sort: { srNo: -1 } });

    this.srNo = lastCandidate ? lastCandidate.srNo + 1 : 1;
  }
  next();
});

const Candidate = mongoose.model("Candidate", candidateSchema);

export default Candidate;
