// /api/index.js

const connectDB = require("../config/db");
const app = require("../app");

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};