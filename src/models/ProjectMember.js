const mongoose = require("mongoose");

const projectMemberSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: {
      type: String,
      enum: ["owner", "manager", "member"],
      default: "member",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProjectMember", projectMemberSchema);
