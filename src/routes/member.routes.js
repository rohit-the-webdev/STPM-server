const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const memberController = require("../controllers/member.controller");

// ➕ Project-based routes (ADD THESE)
router.post(
  "/projects/:id/members",
  authMiddleware,
  memberController.addMemberToProject
);

router.get(
  "/projects/:id/members",
  authMiddleware,
  memberController.getProjectMembers
);

// Update member role (owner/manager/member)
router.put("/:id/role", authMiddleware, memberController.updateMemberRole);

// Remove member from project
router.delete("/:id", authMiddleware, memberController.removeMember);

module.exports = router;
