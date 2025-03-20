import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure directory exists
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "";

    if (file.fieldname === "resume") {
      uploadPath = "./public/resume";
    } else if (file.fieldname === "profileImage") {
      uploadPath = "./public/profileImage";
    }

    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filters
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "resume" && file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed for resume!"), false);
  }
  if (
    file.fieldname === "profileImage" &&
    !["image/jpeg", "image/png"].includes(file.mimetype)
  ) {
    return cb(new Error("Only JPEG and PNG images are allowed for profile image!"), false);
  }
  cb(null, true);
};

// Configure multer for multiple file fields
const upload = multer({ storage, fileFilter });

export default upload;
