// routes/venues.js
const express = require("express");
const Venue = require("../models/Venue");

const router = express.Router();

// GET /api/venues?search=
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    const filter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const venues = await Venue.find(filter).sort({ name: 1 });

    res.json({ venues });
  } catch (err) {
    console.error("Fetch venues error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
