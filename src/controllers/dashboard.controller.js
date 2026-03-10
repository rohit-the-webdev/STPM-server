const Project = require("../models/Project");
const Task = require("../models/Task");
const ProjectMember = require("../models/ProjectMember");

exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();

    // 1️⃣ Get memberships
    const memberships = await ProjectMember.find({
      userId: userId,
    });

    const projectIds = memberships.map((m) => m.projectId);

    // Detect role
    const hasElevatedRole = memberships.some(
      (m) => m.role === "owner" || m.role === "manager"
    );

    // 2️⃣ Get projects
    const projects = await Project.find({
      _id: { $in: projectIds },
    });

    // 3️⃣ Get all tasks in those projects
    const allTasks = await Task.find({
      projectId: { $in: projectIds }, // change to "project" if your Task model uses that
    });

    // 4️⃣ Role-based filtering
    const relevantTasks = hasElevatedRole
      ? allTasks
      : allTasks.filter(
          (t) => t.assignedTo?.toString() === userId
        );

    // ===== SUMMARY =====
    const projectCount = projects.length;
    const totalTasks = relevantTasks.length;

    const pendingTasks = relevantTasks.filter(
      (t) => t.status !== "Done"
    ).length;

    const completedTasks = relevantTasks.filter(
      (t) => t.status === "Done"
    ).length;

    const overdueCount = relevantTasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < today &&
        t.status !== "Done"
    ).length;

    // ===== STATUS DISTRIBUTION =====
    const statusDistribution = ["To Do", "In Progress", "Done"].map(
      (status) => ({
        name: status,
        value: relevantTasks.filter(
          (t) => t.status === status
        ).length,
      })
    );

    // ===== PRIORITY DISTRIBUTION =====
    const priorityDistribution = ["High", "Medium", "Low"].map(
      (priority) => ({
        name: priority,
        value: relevantTasks.filter(
          (t) => t.priority === priority
        ).length,
      })
    );

    // ===== PROJECT COMPLETION =====
    const projectCompletion = projects.map((project) => {
      const projectTasks = allTasks.filter(
        (t) =>
          t.projectId.toString() ===
          project._id.toString()
      );

      const total = projectTasks.length;
      const done = projectTasks.filter(
        (t) => t.status === "Done"
      ).length;

      const overdue = projectTasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < today &&
          t.status !== "Done"
      ).length;

      const completion =
        total === 0
          ? 0
          : Math.round((done / total) * 100);

      return {
        id: project._id,
        name: project.name,
        completion,
        overdue,
      };
    });

    // ===== WEEKLY PRODUCTIVITY =====
    const weeklyProductivity = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);

      const isoDate = date.toISOString().split("T")[0];

      const count = relevantTasks.filter((task) => {
        if (task.status !== "Done") return false;

        const taskDate = new Date(task.updatedAt)
          .toISOString()
          .split("T")[0];

        return taskDate === isoDate;
      }).length;

      weeklyProductivity.push({
        date: isoDate,
        count,
      });
    }

    res.json({
      projectCount,
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueCount,
      statusDistribution,
      priorityDistribution,
      projectCompletion,
      weeklyProductivity,
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      message: "Failed to load dashboard data",
    });
  }
};