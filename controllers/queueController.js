// controllers/queueController.js
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const QueueState = require("../models/QueueState");

// Nepal-local date key: "YYYY-MM-DD"
function dateKeyFromDateNepal(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function resolveDateKey(req) {
  const q = (req.query?.date || "").toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return dateKeyFromDateNepal(new Date());
}

function makeQueueNumber(index) {
  return `A-${String(index).padStart(2, "0")}`;
}

/**
 * ✅ HARD RBAC: staff can only access their assigned branch
 */
function assertStaffBranchAccess(req, branchId) {
  if (req.user?.role !== "staff") return null; // not staff => no restriction here

  const staffBranchId = req.user?.branch?._id
    ? String(req.user.branch._id)
    : req.user?.branch
    ? String(req.user.branch)
    : null;

  if (!staffBranchId) {
    return { status: 403, message: "Staff user is not assigned to any branch" };
  }

  if (String(staffBranchId) !== String(branchId)) {
    return { status: 403, message: "You are not assigned to this branch" };
  }

  return null;
}

// -------------------------
// GET /api/queue/live/:branchId?date=YYYY-MM-DD
// Anyone logged-in can read, BUT staff should only read their own branch
// -------------------------
exports.getLiveQueue = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateKey = resolveDateKey(req);

    const accessError = assertStaffBranchAccess(req, branchId);
    if (accessError) {
      return res.status(accessError.status).json({ success: false, message: accessError.message });
    }

    const [totalIssued, state] = await Promise.all([
      Booking.countDocuments({ branch: branchId, dateKey }),
      QueueState.findOne({ branch: branchId, dateKey }),
    ]);

    const started = !!state?.started;
    const currentServingIndex = state?.currentServingIndex || 0;

    return res.json({
      success: true,
      data: {
        branchId,
        dateKey,
        started,
        totalIssued,
        currentServingIndex,
        currentServingNumber: currentServingIndex > 0 ? makeQueueNumber(currentServingIndex) : "--",
      },
    });
  } catch (err) {
    console.error("getLiveQueue error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// -------------------------
// GET /api/queue/:branchId/appointments?date=YYYY-MM-DD
// Staff-only (already enforced by routes)
// -------------------------
exports.getAppointmentsForDay = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateKey = resolveDateKey(req);

    const accessError = assertStaffBranchAccess(req, branchId);
    if (accessError) {
      return res.status(accessError.status).json({ success: false, message: accessError.message });
    }

    const bookings = await Booking.find({ branch: branchId, dateKey })
      .populate("user", "username email")
      .select("queueNumber queueIndex scheduledAt status title usedAt checkedIn checkedInAt")
      .sort({ scheduledAt: 1, queueIndex: 1 });

    return res.json({ success: true, data: bookings, dateKey });
  } catch (err) {
    console.error("getAppointmentsForDay error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// -------------------------
// POST /api/queue/:branchId/start?date=YYYY-MM-DD
// -------------------------
exports.startDay = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateKey = resolveDateKey(req);

    const accessError = assertStaffBranchAccess(req, branchId);
    if (accessError) {
      return res.status(accessError.status).json({ success: false, message: accessError.message });
    }

    const state = await QueueState.findOneAndUpdate(
      { branch: branchId, dateKey },
      {
        $setOnInsert: { branch: branchId, dateKey, currentServingIndex: 0 },
        $set: { started: true, startedAt: new Date(), updatedAtNepal: new Date() },
      },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: "Day started",
      data: {
        branchId,
        dateKey,
        started: state.started,
        currentServingIndex: state.currentServingIndex,
        currentServingNumber: state.currentServingIndex > 0 ? makeQueueNumber(state.currentServingIndex) : "--",
      },
    });
  } catch (err) {
    console.error("startDay error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// -------------------------
// POST /api/queue/:branchId/next?date=YYYY-MM-DD
// Atomic: prevents double-next
// -------------------------
exports.nextTicket = async (req, res) => {
  try {
    const { branchId } = req.params;
    const dateKey = resolveDateKey(req);

    const accessError = assertStaffBranchAccess(req, branchId);
    if (accessError) {
      return res.status(accessError.status).json({ success: false, message: accessError.message });
    }

    const totalIssued = await Booking.countDocuments({
      branch: branchId,
      dateKey,
      status: { $nin: ["cancelled"] },
    });

    if (totalIssued <= 0) {
      return res.status(400).json({ success: false, message: "No tickets issued for this date" });
    }

    const updated = await QueueState.findOneAndUpdate(
      {
        branch: branchId,
        dateKey,
        started: true,
        currentServingIndex: { $lt: totalIssued },
      },
      { $inc: { currentServingIndex: 1 }, $set: { updatedAtNepal: new Date() } },
      { new: true, upsert: false }
    );

    if (!updated) {
      const state = await QueueState.findOne({ branch: branchId, dateKey });
      if (!state?.started) {
        return res.status(400).json({ success: false, message: "Day not started. Press Start Day first." });
      }

      return res.json({
        success: true,
        message: "Queue finished",
        data: {
          branchId,
          dateKey,
          started: true,
          totalIssued,
          currentServingIndex: state.currentServingIndex,
          currentServingNumber: state.currentServingIndex > 0 ? makeQueueNumber(state.currentServingIndex) : "--",
          finished: true,
        },
      });
    }

    return res.json({
      success: true,
      message: "Advanced to next ticket",
      data: {
        branchId,
        dateKey,
        totalIssued,
        currentServingIndex: updated.currentServingIndex,
        currentServingNumber: makeQueueNumber(updated.currentServingIndex),
      },
    });
  } catch (err) {
    console.error("nextTicket error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// -------------------------
// POST /api/queue/verify-ticket
// body: { ticketToken, branchId, dateKey, consume: true/false }
// -------------------------
exports.verifyTicket = async (req, res) => {
  try {
    const { ticketToken, branchId, dateKey, consume } = req.body;

    if (!ticketToken || !branchId) {
      return res.status(400).json({ success: false, message: "ticketToken and branchId are required" });
    }

    // ✅ staff can only verify tickets for their own branch
    const accessError = assertStaffBranchAccess(req, branchId);
    if (accessError) {
      return res.status(accessError.status).json({ success: false, message: accessError.message });
    }

    let payload;
    try {
      payload = jwt.verify(ticketToken, process.env.JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ success: false, message: "Invalid QR (token failed)" });
    }

    if (payload?.role !== "ticket") {
      return res.status(401).json({ success: false, message: "Invalid QR (not a ticket token)" });
    }

    if (String(payload.branchId) !== String(branchId)) {
      return res.status(403).json({ success: false, message: "Ticket is for a different branch" });
    }

    if (dateKey && String(payload.dateKey) !== String(dateKey)) {
      return res.status(403).json({ success: false, message: "Ticket is for a different date" });
    }

    const booking = await Booking.findById(payload.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (String(booking.branch) !== String(branchId)) {
      return res.status(403).json({ success: false, message: "Booking branch mismatch" });
    }

    if (dateKey && String(booking.dateKey) !== String(dateKey)) {
      return res.status(403).json({ success: false, message: "Booking date mismatch" });
    }

    if (booking.usedAt) {
      return res.status(409).json({ success: false, message: "Ticket already used" });
    }

    if (!["upcoming", "checked_in"].includes(booking.status)) {
      return res.status(409).json({ success: false, message: `Ticket not valid (status: ${booking.status})` });
    }

    // ✅ check-in always on successful scan
    if (!booking.checkedIn) {
      booking.checkedIn = true;
      booking.checkedInAt = new Date();
      booking.status = "checked_in";
    }

    // ✅ consume only if requested
    if (consume === true) {
      booking.usedAt = new Date();
      booking.usedBy = req.user?._id || req.user?.id || null;
      booking.status = "completed";
    }

    await booking.save();

    return res.json({
      success: true,
      message: consume ? "Ticket verified and consumed" : "Ticket verified (checked-in)",
      data: {
        bookingId: String(booking._id),
        queueNumber: booking.queueNumber,
        queueIndex: booking.queueIndex,
        dateKey: booking.dateKey,
        status: booking.status,
        checkedIn: booking.checkedIn,
        usedAt: booking.usedAt,
      },
    });
  } catch (err) {
    console.error("verifyTicket error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
