const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const projectController = require("../controllers/project.controller");
const memberController = require("../controllers/member.controller");

// Create Project
router.post("/", authMiddleware, projectController.createProject);

// Get all projects of logged-in user
router.get("/", authMiddleware, projectController.getMyProjects);

// Get single project details
router.get("/:id", authMiddleware, projectController.getProjectById);

// Update project
router.put("/:id", authMiddleware, projectController.updateProject);

// Delete project
router.delete("/:id", authMiddleware, projectController.deleteProject);

// ➕ ADD THIS (GET members)
router.get("/:id/members", authMiddleware, memberController.getProjectMembers);

// Add member to a project (by email)
router.post("/:id/members", authMiddleware, memberController.addMemberToProject);

module.exports = router;
