const ActivityLog = require("../models/ActivityLog");
const ProjectMember = require("../models/ProjectMember");

exports.getProjectActivity = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Only project members can view activity logs
    const isMember = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    const logs = await ActivityLog.find({ projectId })
      .populate("performedBy", "name email")
      .populate("taskId", "title")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Activity logs fetched",
      count: logs.length,
      logs,
    });
  } catch (err) {
    next(err);
  }
};
