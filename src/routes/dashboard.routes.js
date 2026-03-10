const express = require("express");
const router = express.Router();
const { getDashboardSummary } = require("../controllers/dashboard.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get("/summary", authMiddleware, getDashboardSummary);

module.exports = router;