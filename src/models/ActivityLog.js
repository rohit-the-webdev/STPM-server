const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
