const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },

    // ✅ NEW: branch-based queue
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    title: { type: String, required: true },
    organizationName: { type: String },

    scheduledAt: { type: Date, required: true },

    dateKey: { type: String, required: true }, // YYYY-MM-DD
    queueIndex: { type: Number, required: true }, // 1..50
    queueNumber: { type: String, required: true }, // A-01..A-50

    checkedIn: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["upcoming", "cancelled", "completed"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

// ✅ Unique per BRANCH per DAY
bookingSchema.index({ branch: 1, dateKey: 1, queueIndex: 1 }, { unique: true });

module.exports = mongoose.model("Booking", bookingSchema);
