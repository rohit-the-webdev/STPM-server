const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const notificationController = require("../controllers/notification.controller");

// Get my notifications
router.get("/", authMiddleware, notificationController.getMyNotifications);

// Mark notification as read
router.put("/:id/read", authMiddleware, notificationController.markAsRead);

module.exports = router;
