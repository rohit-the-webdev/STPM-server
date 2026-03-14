require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

connectDB();

module.exports = app;
