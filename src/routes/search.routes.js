const express = require("express");
const router = express.Router();
const searchController = require("../controllers/search.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Unified search endpoint
router.get("/", authMiddleware, searchController.globalSearch);

module.exports = router;
