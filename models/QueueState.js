// models/QueueState.js
const mongoose = require("mongoose");

const queueStateSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    dateKey: { type: String, required: true },

    started: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },

    currentServingIndex: { type: Number, default: 0 }, // 0 = not started
    updatedAtNepal: { type: Date, default: null },
  },
  { timestamps: true }
);

queueStateSchema.index({ branch: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("QueueState", queueStateSchema);
