const Booking = require("../models/Booking");
const QueueState = require("../models/QueueState");

/** Nepal date key */
function dateKeyFromDateNepal(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function makeQueueNumber(index) {
  return `A-${String(index).padStart(2, "0")}`;
}

/**
 * ✅ GET LIVE QUEUE (PER BRANCH)
 * GET /api/queue/live/:branchId
 */
async function getLiveQueue(req, res) {
  try {
    const { branchId } = req.params;
    const todayKey = dateKeyFromDateNepal(new Date());

    // total issued today (upcoming) for this branch
    const totalIssued = await Booking.countDocuments({
      branch: branchId,
      dateKey: todayKey,
      status: "upcoming",
    });

    // current serving index
    const state = await QueueState.findOne({ branch: branchId, dateKey: todayKey });
    const currentServingIndex = state?.currentIndex ?? 0;

    return res.json({
      success: true,
      data: {
        branchId,
        dateKey: todayKey,
        currentServingIndex,
        currentServingNumber: currentServingIndex > 0 ? makeQueueNumber(currentServingIndex) : "--",
        totalIssued,
      },
    });
  } catch (err) {
    console.error("getLiveQueue error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { getLiveQueue };
