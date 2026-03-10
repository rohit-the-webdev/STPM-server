const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");
const ActivityLog = require("../models/ActivityLog");

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

    const projects = await Project.find({ _id: { $in: projectIds } }).sort({
      updatedAt: -1,
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
    const { name, description } = req.body;

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
      { name, description },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({
      message: "Project updated successfully",
      project,
    });
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
