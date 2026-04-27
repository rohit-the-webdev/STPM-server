const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const ProjectMember = require("../models/ProjectMember");

/**
 * Universal search across projects, tasks, and members
 */
exports.globalSearch = async (req, res, next) => {
    try {
        const { q, type = "all" } = req.query;
        const userId = req.user.id;

        if (!q) {
            return res.json({ projects: [], tasks: [], members: [] });
        }

        const searchRegex = new RegExp(q, "i");
        const results = {
            projects: [],
            tasks: [],
            members: [],
        };

        // Use aggregations or multiple queries
        // In a bigger app, use MongoDB text search or Elasticsearch

        // 1. PROJECTS
        if (type === "all" || type === "projects") {
            // Find projects the user is a member of AND match the name
            const memberProjects = await ProjectMember.find({ userId }).select("projectId");
            const projectIds = memberProjects.map(mp => mp.projectId);

            results.projects = await Project.find({
                _id: { $in: projectIds },
                name: searchRegex
            })
                .limit(10)
                .select("name description isCompleted");
        }

        // 2. TASKS
        if (type === "all" || type === "tasks") {
            // Find tasks within projects the user is a member of
            const memberProjects = await ProjectMember.find({ userId }).select("projectId");
            const projectIds = memberProjects.map(mp => mp.projectId);

            results.tasks = await Task.find({
                projectId: { $in: projectIds },
                $or: [
                    { title: searchRegex },
                    { labels: searchRegex }
                ]
            })
                .populate("assignedTo", "name profilePhoto")
                .limit(10)
                .select("title status priority labels projectId assignedTo");
        }

        // 3. MEMBERS (Users)
        if (type === "all" || type === "members") {
            // Here, "members" usually means other users in the system or specifically project members
            // The requirement says "Members (name/email)"
            // Let's search all users for now, or users who share projects with current user
            // Searching all users is common for inviting them to new projects.
            results.members = await User.find({
                $or: [
                    { name: searchRegex },
                    { email: searchRegex }
                ],
                _id: { $ne: userId } // Don't include self
            })
                .limit(10)
                .select("name email profilePhoto designation");
        }

        res.json(results);
    } catch (error) {
        next(error);
    }
};
