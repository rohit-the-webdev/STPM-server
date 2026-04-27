const router = require("express").Router();

const authMiddleware = require("../middleware/auth.middleware");
const taskController = require("../controllers/task.controller");
const upload = require("../middleware/upload.middleware");

router.post("/", authMiddleware, taskController.createTask);
router.get("/", authMiddleware, taskController.getTasks);
router.get("/all", authMiddleware, taskController.getAllUserTasks);
router.put("/:id", authMiddleware, taskController.updateTask);
router.delete("/:id", authMiddleware, taskController.deleteTask);

// Labels
router.post("/:taskId/labels", authMiddleware, taskController.addLabel);
router.delete(
  "/:taskId/labels/:label",
  authMiddleware,
  taskController.removeLabel
);

// Subtasks
router.post("/:taskId/subtasks", authMiddleware, taskController.addSubtask);
router.patch(
  "/:taskId/subtasks/:subtaskId/toggle",
  authMiddleware,
  taskController.toggleSubtask
);
router.patch(
  "/:taskId/subtasks/:subtaskId/title",
  authMiddleware,
  taskController.updateSubtaskTitle
);
router.delete(
  "/:taskId/subtasks/:subtaskId",
  authMiddleware,
  taskController.deleteSubtask
);

// Attachments
router.post(
  "/:taskId/attachments",
  authMiddleware,
  upload.single("file"),
  taskController.uploadAttachment
);
router.delete(
  "/:taskId/attachments/:attachmentId",
  authMiddleware,
  taskController.deleteAttachment
);

module.exports = router;
