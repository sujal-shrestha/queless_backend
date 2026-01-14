const mongoose = require("mongoose");

const dailyQueueSchema = new mongoose.Schema(
  {
    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },

    // ✅ per-branch queue
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    dateKey: { type: String, required: true }, // "YYYY-MM-DD" Nepal time

    nowServing: { type: Number, default: 0 }, // 0 means not started
    totalBooked: { type: Number, default: 0 }, // optional
  },
  { timestamps: true }
);

// ✅ one queue per BRANCH per day
dailyQueueSchema.index({ branch: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("DailyQueue", dailyQueueSchema);
