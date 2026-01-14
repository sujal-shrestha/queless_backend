const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const connectDB = require("./config/db");
const bookingRoutes = require("./routes/bookingRoutes");
const venueRoutes = require("./routes/venueRoutes"); // ✅ use this exact file

// ✅ NEW: staff + org queue routes
const staffRoutes = require("./routes/staffRoutes");
const orgQueueRoutes = require("./routes/orgQueueRoutes");

const queueRoutes = require("./routes/queueRoutes");

dotenv.config();
connectDB();

const app = express();

// ✅ serve logos
app.use("/logos", express.static(path.join(__dirname, "public/logos")));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  res.on("finish", () =>
    console.log(`⬅️ ${req.method} ${req.originalUrl} -> ${res.statusCode}`)
  );
  next();
});

app.use("/api/auth", require("./routes/auth"));

// ✅ NEW: staff login + org queue (super simple)
app.use("/api/staff", staffRoutes);
app.use("/api/org", orgQueueRoutes);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/venues", venueRoutes); // ✅ ONLY THIS ONCE
app.use("/api/bookings", bookingRoutes);
app.use("/api/queue", queueRoutes);


app.get("/", (req, res) => res.send("QueueLess API is running"));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
