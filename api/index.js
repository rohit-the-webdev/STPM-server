// /api/index.js

const connectDB = require("../src/config/db");
const app = require("../src/app");

module.exports = async (req, res) => {
    try {
        await connectDB();
        return app(req, res);
    } catch (error) {
        console.error("Vercel Entry Point Error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error.message,
        });
    }
};