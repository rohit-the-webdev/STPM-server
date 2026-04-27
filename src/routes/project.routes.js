const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const projectController = require("../controllers/project.controller");
const memberController = require("../controllers/member.controller");

// Create Project
router.post("/", authMiddleware, projectController.createProject);

// Get all projects of logged-in user
router.get("/", authMiddleware, projectController.getMyProjects);

// Get project settings (all projects with roles and members)
router.get("/settings", authMiddleware, projectController.getProjectSettings);

// Get single project details
router.get("/:id", authMiddleware, projectController.getProjectById);

// Update project
router.patch("/:id", authMiddleware, projectController.updateProject);

// Delete project
router.delete("/:id", authMiddleware, projectController.deleteProject);

// Leave project
router.post("/:id/leave", authMiddleware, projectController.leaveProject);

// Get project performance
router.get("/:projectId/performance", authMiddleware, projectController.getProjectPerformance);

// Transfer ownership
router.post("/:id/transfer-ownership", authMiddleware, projectController.transferOwnership);

// Member management
router.get("/:id/members", authMiddleware, memberController.getProjectMembers);
router.post("/:id/members", authMiddleware, memberController.addMemberToProject);
router.patch("/:id/members/:userId", authMiddleware, memberController.updateMemberRoleByUserId);
router.delete("/:id/members/:userId", authMiddleware, memberController.removeMemberByUserId);

module.exports = router;
