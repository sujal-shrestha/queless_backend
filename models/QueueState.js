const mongoose = require("mongoose");

const queueStateSchema = new mongoose.Schema(
  {
    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },

    // ✅ per-branch queue
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    dateKey: { type: String, required: true }, // "YYYY-MM-DD" Nepal time
    currentIndex: { type: Number, default: 0 }, // 0 = not started
  },
  { timestamps: true }
);

// ✅ one state per BRANCH per day
queueStateSchema.index({ branch: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("QueueState", queueStateSchema);
