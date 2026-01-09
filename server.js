// server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const connectDB = require("./config/db");
const bookingRoutes = require("./routes/bookingRoutes");

// ✅ Load env first
dotenv.config();

// ✅ Connect DB
connectDB();

// ✅ Create app BEFORE app.use
const app = express();

/**
 * ✅ Serve logos (must be after app is created)
 * URL: http://localhost:5001/logos/<filename>
 */
app.use("/logos", express.static(path.join(__dirname, "public/logos")));

/**
 * ✅ CORS
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

/**
 * ✅ Debug logger
 */
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  res.on("finish", () => {
    console.log(`⬅️ ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

// ✅ Routes (KEEP ONLY ONE /api/venues)
app.use("/api/auth", require("./routes/auth"));
app.use("/api/venues", require("./routes/venues"));
app.use("/api/bookings", bookingRoutes);

app.get("/", (req, res) => {
  res.send("QueueLess API is running");
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
