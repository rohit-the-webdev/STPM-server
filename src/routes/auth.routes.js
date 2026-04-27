const router = require("express").Router();
const { register, login, me, updateProfile } = require("../controllers/auth.controller");

const authMiddleware = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, me);
router.put("/update-profile", authMiddleware, updateProfile);

module.exports = router;

