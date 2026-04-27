const Task = require("../models/Task");
const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

exports.createTask = async (req, res, next) => {
  try {
    const { title, status, priority, dueDate, assignedTo, projectId } =
      req.body;

    if (!title || !projectId) {
      return res
        .status(400)
        .json({ message: "title and projectId are required" });
    }

    // check project exists
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // only owner/manager can create task
    const myMembership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res
        .status(403)
        .json({ message: "You are not a member of this project" });
    }

    if (!["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can create tasks" });
    }

    // if assignedTo provided, ensure that user is a member of project
    if (assignedTo) {
      const assignedMember = await ProjectMember.findOne({
        projectId,
        userId: assignedTo,
      });

      if (!assignedMember) {
        return res.status(400).json({
          message: "Assigned user is not a member of this project",
        });
      }
    }

    const task = await Task.create({
      title,
      status: status || "To Do",
      priority: priority || "Medium",
      dueDate,
      assignedTo,
      projectId,
    });
    await ActivityLog.create({
      projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: "Task created",
    });

    if (assignedTo) {
      await Notification.create({
        userId: assignedTo,
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${title}`,
        type: "ASSIGNED",
      });
    }

    return res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId, status, priority } = req.query;

    if (!projectId) {
      return res.status(400).json({ message: "projectId query is required" });
    }

    // must be member of project
    const myMembership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }

    // basic filters
    const filter = { projectId };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Tasks fetched",
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllUserTasks = async (req, res, next) => {
  try {
    // 1. Get all project IDs where user is a member
    const memberships = await ProjectMember.find({ userId: req.user._id }).select("projectId");
    const projectIds = memberships.map(m => m.projectId);

    // 2. Fetch all tasks for those projects
    // We populate assignedTo for user info and projectId for project context
    const tasks = await Task.find({
      $or: [
        { projectId: { $in: projectIds } },
        { assignedTo: req.user._id }
      ]
    })
      .populate("assignedTo", "name email profilePhoto")
      .populate("projectId", "name")
      .sort({ dueDate: 1 });

    return res.json({
      message: "All user tasks fetched",
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const oldAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;

    const oldStatus = task.status;

    // must be member of project
    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }

    const isOwnerOrManager = ["owner", "manager"].includes(myMembership.role);
    const isAssignedUser =
      task.assignedTo && task.assignedTo.toString() === req.user._id.toString();

    // owner/manager can update any task
    // member can update only their assigned task
    if (!isOwnerOrManager && !isAssignedUser) {
      return res
        .status(403)
        .json({ message: "Not allowed to update this task" });
    }

    // allowed fields to update
    const allowedUpdates = [
      "title",
      "status",
      "priority",
      "dueDate",
      "assignedTo",
    ];

    // If not owner/manager, they can only update status
    if (!isOwnerOrManager) {
      const updates = Object.keys(req.body);
      const invalidUpdates = updates.filter((u) => u !== "status");
      if (invalidUpdates.length > 0) {
        return res.status(403).json({
          message: "Members can only update the status of assigned tasks",
        });
      }
    }

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    // if changing assignedTo, ensure new user is member of project (only owner/manager)
    if (req.body.assignedTo !== undefined) {
      if (!isOwnerOrManager) {
        return res
          .status(403)
          .json({ message: "Only owner/manager can reassign tasks" });
      }

      if (req.body.assignedTo) {
        const assignedMember = await ProjectMember.findOne({
          projectId: task.projectId,
          userId: req.body.assignedTo,
        });

        if (!assignedMember) {
          return res.status(400).json({
            message: "Assigned user is not a member of this project",
          });
        }
      }
    }

    await task.save();
    // Notify when task is assigned or reassigned
    if (req.body.assignedTo && req.body.assignedTo !== oldAssignedTo) {
      await Notification.create({
        userId: req.body.assignedTo,
        title: "Task Assigned",
        message: `You have been assigned a task: ${task.title}`,
        type: "ASSIGNED",
      });

      await ActivityLog.create({
        projectId: task.projectId,
        taskId: task._id,
        performedBy: req.user._id,
        action: "Task assigned",
      });
    }

    if (oldStatus !== task.status) {
      await ActivityLog.create({
        projectId: task.projectId,
        taskId: task._id,
        performedBy: req.user._id,
        action: `Task status changed to ${task.status}`,
      });
    }

    if (task.assignedTo && oldStatus !== task.status) {
      await Notification.create({
        userId: task.assignedTo,
        title: "Task Status Updated",
        message: `Task status changed to ${task.status}`,
        type: "STATUS_UPDATE",
      });
    }

    return res.json({
      message: "Task updated successfully",
      task,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const taskId = req.params.id;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // must be member of project
    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }

    // only owner/manager can delete
    if (!["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can delete tasks" });
    }
    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: "Task deleted",
    });

    await Task.findByIdAndDelete(taskId);

    return res.json({ message: "Task deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Labels
exports.addLabel = async (req, res, next) => {
  try {
    const { label } = req.body;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can add labels" });
    }

    if (task.labels.includes(label)) {
      return res.status(400).json({ message: "Label already exists" });
    }

    task.labels.push(label);
    await task.save();

    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: `Label added: ${label}`,
    });

    res.json({ message: "Label added", task });
  } catch (err) {
    next(err);
  }
};

exports.removeLabel = async (req, res, next) => {
  try {
    const { label, taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can remove labels" });
    }

    task.labels = task.labels.filter((l) => l !== label);
    await task.save();

    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: `Label removed: ${label}`,
    });

    res.json({ message: "Label removed", task });
  } catch (err) {
    next(err);
  }
};

// Subtasks
exports.addSubtask = async (req, res, next) => {
  try {
    const { title } = req.body;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can add subtasks" });
    }

    task.subtasks.push({ title });
    await task.save();

    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: `Subtask added: ${title}`,
    });

    res.json({ message: "Subtask added", task });
  } catch (err) {
    next(err);
  }
};

exports.toggleSubtask = async (req, res, next) => {
  try {
    const { taskId, subtaskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership) return res.status(403).json({ message: "Access denied" });

    const isOwnerOrManager = ["owner", "manager"].includes(myMembership.role);
    const isAssigned =
      task.assignedTo && task.assignedTo.toString() === req.user._id.toString();

    if (!isOwnerOrManager && !isAssigned) {
      return res.status(403).json({
        message: "Only owner/manager or assigned member can toggle subtasks",
      });
    }

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });

    subtask.isCompleted = !subtask.isCompleted;
    await task.save();

    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: `${req.user.name} ${subtask.isCompleted ? "completed" : "uncompleted"} subtask "${subtask.title}" in task "${task.title}"`,
    });

    res.json({ message: "Subtask toggled", task });
  } catch (err) {
    next(err);
  }
};

exports.updateSubtaskTitle = async (req, res, next) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { title } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can edit subtask titles" });
    }

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) return res.status(404).json({ message: "Subtask not found" });

    subtask.title = title;
    await task.save();

    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: `Subtask title updated to: ${title}`,
    });

    res.json({ message: "Subtask title updated", task });
  } catch (err) {
    next(err);
  }
};


exports.deleteSubtask = async (req, res, next) => {
  try {
    const { taskId, subtaskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can delete subtasks" });
    }

    task.subtasks.pull(subtaskId);
    await task.save();

    res.json({ message: "Subtask deleted", task });
  } catch (err) {
    next(err);
  }
};

// Attachments
exports.uploadAttachment = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can upload attachments" });
    }

    const attachment = {
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      uploadedBy: req.user._id,
    };

    task.attachments.push(attachment);
    await task.save();

    await ActivityLog.create({
      projectId: task.projectId,
      taskId: task._id,
      performedBy: req.user._id,
      action: `Attachment uploaded: ${req.file.originalname}`,
    });

    res.json({ message: "Attachment uploaded", task });
  } catch (err) {
    next(err);
  }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const { taskId, attachmentId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const myMembership = await ProjectMember.findOne({
      projectId: task.projectId,
      userId: req.user._id,
    });

    if (!myMembership || !["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can delete attachments" });
    }

    task.attachments.pull(attachmentId);
    await task.save();

    res.json({ message: "Attachment deleted", task });
  } catch (err) {
    next(err);
  }
};

