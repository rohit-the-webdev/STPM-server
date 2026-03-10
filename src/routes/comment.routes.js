const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const commentController = require("../controllers/comment.controller");

// Add comment to a task
router.post("/", authMiddleware, commentController.addComment);

// Get comments of a task
router.get("/:taskId", authMiddleware, commentController.getCommentsByTask);

module.exports = router;
