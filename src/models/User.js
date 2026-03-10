const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    profilePhoto: {
      type: String,
      default: "https://ui-avatars.com/api/?name=User&background=random"
    },
    designation: {
      type: String,
      default: "employee"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
