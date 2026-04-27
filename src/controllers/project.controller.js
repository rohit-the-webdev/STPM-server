const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");
const ActivityLog = require("../models/ActivityLog");
const Task = require("../models/Task");

exports.createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    // 1) create project
    const project = await Project.create({
      name,
      description,
      createdBy: req.user._id,
    });
    await ActivityLog.create({
      projectId: project._id,
      performedBy: req.user._id,
      action: "Project created",
    });

    // 2) add creator as OWNER in project_members
    await ProjectMember.create({
      projectId: project._id,
      userId: req.user._id,
      role: "owner",
    });

    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyProjects = async (req, res, next) => {
  try {
    // Find projects where user is a member
    const memberships = await ProjectMember.find({
      userId: req.user._id,
    }).select("projectId role");

    const projectIds = memberships.map((m) => m.projectId);

    const projects = await Project.find({ _id: { $in: projectIds } })
      .sort({ updatedAt: -1 })
      .lean();

    const tasks = await Task.find({ projectId: { $in: projectIds } });

    projects.forEach((project) => {
      const pTasks = tasks.filter(
        (t) => t.projectId.toString() === project._id.toString()
      );
      project.totalTasks = pTasks.length;
      project.completedTasks = pTasks.filter((t) => t.status === "Done").length;

      const allToDo = pTasks.length > 0 && pTasks.every((t) => t.status === "To Do");
      const allDone = pTasks.length > 0 && pTasks.every((t) => t.status === "Done");
      project.allToDo = allToDo;
      project.allDone = allDone;
      project.inProgress = pTasks.length > 0 && !allToDo && !allDone;
    });

    return res.json({
      message: "My projects fetched",
      count: projects.length,
      projects,
    });
  } catch (err) {
    next(err);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    // check membership
    const isMember = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!isMember) {
      return res.status(403).json({ message: "Access denied to this project" });
    }

    const project = await Project.findById(projectId).populate(
      "createdBy",
      "name email"
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({
      message: "Project fetched",
      project,
      myRole: isMember.role,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { name, description, isCompleted } = req.body;

    // only owner or manager can update project
    const membership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({ message: "Access denied to this project" });
    }

    if (!["owner", "manager"].includes(membership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can update project" });
    }

    const project = await Project.findByIdAndUpdate(
      projectId,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(typeof isCompleted === "boolean" && { isCompleted })
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await ActivityLog.create({
      projectId: project._id,
      performedBy: req.user._id,
      action: "Project settings updated",
    });

    return res.json({
      message: "Project updated successfully",
      project,
    });
  } catch (err) {
    next(err);
  }
};

exports.getProjectSettings = async (req, res, next) => {
  try {
    const memberships = await ProjectMember.find({ userId: req.user._id })
      .populate({
        path: "projectId",
        populate: { path: "createdBy", select: "name email profilePhoto" }
      });

    const projectsWithSettings = await Promise.all(memberships.map(async (m) => {
      const p = m.projectId;
      if (!p) return null;

      // Get all members for this project
      const allMembers = await ProjectMember.find({ projectId: p._id })
        .populate("userId", "name email profilePhoto designation");

      // Get member count and tasks info
      const tasks = await Task.find({ projectId: p._id });

      const membersWithActivity = allMembers.map(m => {
        const assignedTasks = tasks.filter(t => t.assignedTo && t.assignedTo.toString() === m.userId?._id.toString());
        return {
          ...m.toObject(),
          assignedTaskCount: assignedTasks.length
        };
      });

      return {
        _id: p._id,
        name: p.name,
        description: p.description,
        isCompleted: p.isCompleted,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        myRole: m.role,
        members: membersWithActivity,
        memberCount: allMembers.length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === "Done").length
      };
    }));

    const filteredProjects = projectsWithSettings.filter(p => p !== null);

    res.json({
      message: "Project settings fetched",
      projects: filteredProjects
    });
  } catch (err) {
    next(err);
  }
};

exports.leaveProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { newOwnerId } = req.body;

    const myMembership = await ProjectMember.findOne({ projectId, userId: req.user._id });
    if (!myMembership) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    if (myMembership.role === "owner") {
      const allMembers = await ProjectMember.find({ projectId });
      if (allMembers.length === 1) {
        return res.status(400).json({ message: "Cannot leave project with only one member. Delete the project instead." });
      }

      if (!newOwnerId) {
        return res.status(400).json({ message: "As the owner, you must transfer ownership to another member before leaving." });
      }

      // Transfer ownership
      const newOwnerMembership = await ProjectMember.findOne({ projectId, userId: newOwnerId });
      if (!newOwnerMembership) {
        return res.status(400).json({ message: "New owner must be a member of the project" });
      }

      newOwnerMembership.role = "owner";
      await newOwnerMembership.save();

      await ActivityLog.create({
        projectId,
        performedBy: req.user._id,
        action: `Ownership transferred to user ${newOwnerId}`
      });
    }

    await ProjectMember.deleteOne({ _id: myMembership._id });

    await ActivityLog.create({
      projectId,
      performedBy: req.user._id,
      action: "Left the project"
    });

    res.json({ message: "Left project successfully" });
  } catch (err) {
    next(err);
  }
};

exports.transferOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { newOwnerId } = req.body;

    const myMembership = await ProjectMember.findOne({ projectId, userId: req.user._id });
    if (!myMembership || myMembership.role !== "owner") {
      return res.status(403).json({ message: "Only owners can transfer ownership" });
    }

    const newOwnerMembership = await ProjectMember.findOne({ projectId, userId: newOwnerId });
    if (!newOwnerMembership) {
      return res.status(400).json({ message: "New owner must be a member of the project" });
    }

    // Current owner becomes manager
    myMembership.role = "manager";
    await myMembership.save();

    // New owner becomes owner
    newOwnerMembership.role = "owner";
    await newOwnerMembership.save();

    await ActivityLog.create({
      projectId,
      performedBy: req.user._id,
      action: `Ownership transferred to user ${newOwnerId}`
    });

    res.json({ message: "Ownership transferred successfully" });
  } catch (err) {
    next(err);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    // only owner can delete project
    const membership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({ message: "Access denied to this project" });
    }

    if (membership.role !== "owner") {
      return res.status(403).json({ message: "Only owner can delete project" });
    }

    const project = await Project.findByIdAndDelete(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // cleanup project members
    await ProjectMember.deleteMany({ projectId });

    return res.json({
      message: "Project deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

exports.getProjectPerformance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    // Check membership and role
    const membership = await ProjectMember.findOne({ projectId, userId });
    if (!membership) {
      return res.status(403).json({ message: "Access denied to this project" });
    }

    const isAdmin = ["owner", "manager"].includes(membership.role);

    // Get all project members
    const members = await ProjectMember.find({ projectId }).populate(
      "userId",
      "name email profilePhoto designation"
    );

    // Get all tasks for this project
    const tasks = await Task.find({ projectId });

    const now = new Date();

    const performanceData = members
      .map((member) => {
        if (!member.userId) return null;

        // If not admin, only show their own data
        if (!isAdmin && member.userId._id.toString() !== userId.toString()) {
          return null;
        }

        const mTasks = tasks.filter(
          (t) =>
            t.assignedTo &&
            t.assignedTo.toString() === member.userId._id.toString()
        );

        const assigned = mTasks.length;
        const completed = mTasks.filter((t) => t.status === "Done").length;
        const inProgress = mTasks.filter((t) => t.status === "In Progress").length;
        const overdue = mTasks.filter(
          (t) => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < now
        ).length;

        const completionRate = assigned > 0 ? (completed / assigned) * 100 : 0;

        return {
          user: member.userId,
          role: member.role,
          assigned,
          completed,
          inProgress,
          overdue,
          completionRate: parseFloat(completionRate.toFixed(2)),
        };
      })
      .filter(Boolean);

    // Overview metrics
    const overview = {
      totalMembers: performanceData.length,
      totalCompleted: performanceData.reduce((acc, curr) => acc + curr.completed, 0),
      avgCompletionRate:
        performanceData.length > 0
          ? parseFloat(
            (
              performanceData.reduce((acc, curr) => acc + curr.completionRate, 0) /
              performanceData.length
            ).toFixed(2)
          )
          : 0,
    };

    return res.json({
      message: "Performance data fetched successfully",
      performance: performanceData,
      overview,
    });
  } catch (err) {
    next(err);
  }
};
