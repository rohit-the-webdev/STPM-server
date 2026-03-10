const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const activityController = require("../controllers/activity.controller");

// Get activity logs of a project
router.get("/:projectId", authMiddleware, activityController.getProjectActivity);

module.exports = router;
