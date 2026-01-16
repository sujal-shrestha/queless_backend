// config/db.js
const mongoose = require("mongoose");

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("Missing Mongo URI. Set MONGODB_URI (or MONGO_URI) in .env");
  }

  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");
};
