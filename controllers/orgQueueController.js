const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const QueueState = require("../models/QueueState");

// ✅ Nepal-local date key "YYYY-MM-DD"
function dateKeyNepal(d = new Date()) {
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

async function getOrCreateQueueState(venueId, dateKey) {
  // ✅ Upsert = safe + no duplicate creation crash
  const state = await QueueState.findOneAndUpdate(
    { venue: venueId, dateKey },
    { $setOnInsert: { currentIndex: 0 } },
    { new: true, upsert: true }
  );

  return state;
}

// ----------------------
// STAFF LOGIN
// ----------------------
exports.staffLogin = async (req, res) => {
  try {
    const { staffId, password } = req.body;

    if (!staffId || !password) {
      return res
        .status(400)
        .json({ success: false, message: "staffId and password required" });
    }

    if (staffId !== process.env.STAFF_ID || password !== process.env.STAFF_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid staff credentials" });
    }

    const staffToken = jwt.sign({ role: "staff", staffId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({ success: true, staffToken });
  } catch (err) {
    console.error("staffLogin error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------------
// VERIFY TICKET (SCAN QR)
// ----------------------
exports.verifyTicket = async (req, res) => {
  try {
    const { ticketToken } = req.body;

    if (!ticketToken) {
      return res.status(400).json({ success: false, message: "ticketToken required" });
    }

    const decoded = jwt.verify(ticketToken, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "ticket") {
      return res.status(400).json({ success: false, message: "Invalid ticket" });
    }

    const booking = await Booking.findById(decoded.bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // ✅ Token must match booking
    if (booking.queueNumber !== decoded.queueNumber || booking.dateKey !== decoded.dateKey) {
      return res.status(400).json({ success: false, message: "Ticket mismatch" });
    }

    // ✅ Must be today's ticket (Nepal)
    const todayKey = dateKeyNepal(new Date());
    if (booking.dateKey !== todayKey) {
      return res.status(400).json({ success: false, message: "Ticket is not for today" });
    }

    // ✅ Not already used
    if (booking.usedAt) {
      return res.status(400).json({ success: false, message: "Ticket already used" });
    }

    // ✅ Booking must still be upcoming
    if (booking.status !== "upcoming") {
      return res.status(400).json({ success: false, message: `Booking is ${booking.status}` });
    }

    return res.json({
      success: true,
      message: "VALID",
      data: {
        bookingId: booking._id,
        queueNumber: booking.queueNumber,
        scheduledAt: booking.scheduledAt,
        organizationName: booking.organizationName,
        checkedIn: booking.checkedIn,
      },
    });
  } catch (err) {
    console.error("verifyTicket error:", err);
    return res.status(401).json({ success: false, message: "Invalid/expired ticketToken" });
  }
};

// ----------------------
// STAFF: GET TODAY QUEUE (dashboard)
// ----------------------
exports.getTodayQueueForStaff = async (req, res) => {
  try {
    const { venueId } = req.params;
    const dateKey = dateKeyNepal(new Date());

    const total = await Booking.countDocuments({ venue: venueId, dateKey });

    const state = await getOrCreateQueueState(venueId, dateKey);

    return res.json({
      success: true,
      data: {
        dateKey,
        totalBookings: total,
        currentIndex: state.currentIndex,
        currentQueueNumber: makeQueueNumber(state.currentIndex),
      },
    });
  } catch (err) {
    console.error("getTodayQueueForStaff error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------------
// STAFF: NEXT BUTTON
// ----------------------
exports.nextQueue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const dateKey = dateKeyNepal(new Date());

    const total = await Booking.countDocuments({ venue: venueId, dateKey });

    const state = await getOrCreateQueueState(venueId, dateKey);

    if (state.currentIndex >= total) {
      return res.json({
        success: true,
        message: "No more tickets for today",
        data: {
          dateKey,
          totalBookings: total,
          currentIndex: state.currentIndex,
          currentQueueNumber: makeQueueNumber(state.currentIndex),
        },
      });
    }

    // ✅ increment now serving
    const updated = await QueueState.findOneAndUpdate(
      { venue: venueId, dateKey },
      { $inc: { currentIndex: 1 } },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Advanced queue",
      data: {
        dateKey,
        totalBookings: total,
        currentIndex: updated.currentIndex,
        currentQueueNumber: makeQueueNumber(updated.currentIndex),
      },
    });
  } catch (err) {
    console.error("nextQueue error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------------
// USER: LIVE QUEUE (polling endpoint)
// ----------------------
exports.getTodayQueueForUser = async (req, res) => {
  try {
    const { venueId } = req.params;
    const dateKey = dateKeyNepal(new Date());

    const total = await Booking.countDocuments({ venue: venueId, dateKey });

    const state = await getOrCreateQueueState(venueId, dateKey);

    return res.json({
      success: true,
      data: {
        dateKey,
        totalBookings: total,
        nowServingIndex: state.currentIndex,
        nowServingNumber: makeQueueNumber(state.currentIndex),
      },
    });
  } catch (err) {
    console.error("getTodayQueueForUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
