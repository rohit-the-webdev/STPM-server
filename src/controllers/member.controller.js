const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");
const ActivityLog = require("../models/ActivityLog");
const Notification = require("../models/Notification");

exports.addMemberToProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { email, role } = req.body;
    const Notification = require("../models/Notification");

    if (!email) {
      return res.status(400).json({ message: "Member email is required" });
    }

    // Check project exists
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Only owner/manager can add members
    const myMembership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can add members" });
    }

    // Find user by email
    const userToAdd = await User.findOne({ email });
    if (!userToAdd) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    // Prevent duplicate member
    const alreadyMember = await ProjectMember.findOne({
      projectId,
      userId: userToAdd._id,
    });

    if (alreadyMember) {
      return res
        .status(400)
        .json({ message: "User already a member of project" });
    }

    // Create membership
    const membership = await ProjectMember.create({
      projectId,
      userId: userToAdd._id,
      role: role || "member", // default member
    });
    await ActivityLog.create({
      projectId,
      performedBy: req.user._id,
      action: "Member added to project",
    });

    await Notification.create({
      userId: userToAdd._id,
      title: "Added to Project",
      message: `You were added to project "${project.name}"`,
      type: "MEMBER_ADDED",
    });

    return res.status(201).json({
      message: "Member added successfully",
      membership,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const memberId = req.params.id;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    const allowedRoles = ["owner", "manager", "member"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role value" });
    }

    const member = await ProjectMember.findById(memberId);
    if (!member)
      return res.status(404).json({ message: "Membership not found" });

    // Only owner can change roles
    const myMembership = await ProjectMember.findOne({
      projectId: member.projectId,
      userId: req.user._id,
    });

    if (!myMembership || myMembership.role !== "owner") {
      return res.status(403).json({ message: "Only owner can change roles" });
    }

    // Prevent changing owner role (simple rule)
    if (member.role === "owner") {
      return res.status(400).json({ message: "Cannot change owner role" });
    }

    member.role = role;
    await member.save();

    return res.json({
      message: "Member role updated",
      member,
    });
  } catch (err) {
    next(err);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const memberId = req.params.id;

    const member = await ProjectMember.findById(memberId);
    if (!member)
      return res.status(404).json({ message: "Membership not found" });

    // Only owner/manager can remove members
    const myMembership = await ProjectMember.findOne({
      projectId: member.projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!["owner", "manager"].includes(myMembership.role)) {
      return res
        .status(403)
        .json({ message: "Only owner/manager can remove members" });
    }

    // Prevent removing owner
    if (member.role === "owner") {
      return res.status(400).json({ message: "Cannot remove project owner" });
    }

    await ProjectMember.findByIdAndDelete(memberId);

    return res.json({
      message: "Member removed successfully",
    });
  } catch (err) {
    next(err);
  }
};
exports.getProjectMembers = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    const myMembership = await ProjectMember.findOne({
      projectId,
      userId: req.user._id,
    });

    if (!myMembership) {
      return res.status(403).json({ message: "Access denied" });
    }

    const members = await ProjectMember.find({ projectId }).populate(
      "userId",
      "name email"
    );

    res.json({
      message: "Project members fetched",
      count: members.length,
      members,
    });
  } catch (err) {
    next(err);
  }
};
