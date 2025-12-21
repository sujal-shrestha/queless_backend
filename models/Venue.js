// models/Venue.js
const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["bank", "hospital"], required: true },
    logoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Venue", venueSchema);
