const Comment = require("../models/Comment");
const Task = require("../models/Task");
const ProjectMember = require("../models/ProjectMember");
const ActivityLog = require("../models/ActivityLog");

exports.addComment = async (req, res, next) => {
  try {
    const { taskId, message } = req.body;

    if (!taskId || !message) {
      return res
        .status(400)
        .json({ message: "taskId and message are required" });
    }

    // check task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // user must be member of project
    const isMember = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this project" });
    }

    const comment = await Comment.create({
      taskId,
      userId: req.user._id,
      message,
    });
    await ActivityLog.create({
  projectId: task.projectId,
  taskId,
  performedBy: req.user._id,
  action: "Comment added",
});


    return res.status(201).json({
      message: "Comment added successfully",
      comment,
    });
  } catch (err) {
    next(err);
  }
};

exports.getCommentsByTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // user must be member of project
    const isMember = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this project" });
    }

    const comments = await Comment.find({ taskId })
      .populate("userId", "name email")
      .sort({ createdAt: 1 });

    return res.json({
      message: "Comments fetched",
      count: comments.length,
      comments,
    });
  } catch (err) {
    next(err);
  }
};
