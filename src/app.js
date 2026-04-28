const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const memberRoutes = require("./routes/member.routes");
const taskRoutes = require("./routes/task.routes");
const commentRoutes = require("./routes/comment.routes");
const notificationRoutes = require("./routes/notification.routes");
const activityRoutes = require("./routes/activity.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const searchRoutes = require("./routes/search.routes");

const errorMiddleware = require("./middleware/error.middleware");

require("dotenv").config();
const app = express();
console.log({
  authRoutes,
  projectRoutes,
  memberRoutes,
  taskRoutes,
  commentRoutes,
  notificationRoutes,
  activityRoutes,
});

app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      "https://stpm-client.vercel.app",
      "http://localhost:5173"
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/search", searchRoutes);

// error handler
app.use(errorMiddleware);

module.exports = app;
