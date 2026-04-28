const mongoose = require("mongoose");

const connectDB = async () => {
  if (mongoose.connections[0].readyState) {
    return; // already connected
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB error:", err);
    throw err;
  }
};

module.exports = connectDB;