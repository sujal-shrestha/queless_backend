// models/Venue.js
const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: "" }, // e.g. "hams.png"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Venue", venueSchema);
