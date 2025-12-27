const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },

    title: { type: String, required: true, trim: true },
    organizationName: { type: String, required: true, trim: true },

    scheduledAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["upcoming", "cancelled"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
