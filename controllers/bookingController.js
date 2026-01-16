const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");

/**
 * ✅ Nepal-local date key: "YYYY-MM-DD" in Asia/Kathmandu
 */
function dateKeyFromDateNepal(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Build queue number like A-01, A-02...
 */
function makeQueueNumber(index) {
  return `A-${String(index).padStart(2, "0")}`;
}

/**
 * ✅ Generate ticket token for a booking
 */
function buildTicketToken(booking) {
  const bookingId = booking?._id ? String(booking._id) : null;
  const venueId = booking?.venue ? String(booking.venue?._id || booking.venue) : null;
  const branchId = booking?.branch ? String(booking.branch?._id || booking.branch) : null;

  if (!bookingId || !venueId || !branchId) return "";

  return jwt.sign(
    {
      role: "ticket",
      bookingId,
      venueId,
      branchId,
      dateKey: booking.dateKey,
      queueNumber: booking.queueNumber,
      queueIndex: booking.queueIndex,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * ✅ CREATE BOOKING (Branch-based daily 1..50)
 * Body requires: venueId, branchId, title, scheduledAt
 *
 * New rigidity:
 * - prevents overlapping bookings for same user+branch+dateKey (30 min slot)
 * - queueIndex allocated via max(queueIndex)+1 (not count)
 */
async function createBooking(req, res) {
  const session = await mongoose.startSession();

  try {
    const userId = req.user?._id || req.user?.id;
    const { venueId, branchId, title, scheduledAt } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!venueId || !branchId || !title || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "venueId, branchId, title, scheduledAt required",
      });
    }

    const dt = new Date(scheduledAt);
    if (isNaN(dt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "scheduledAt must be a valid date/time",
      });
    }

    const dateKey = dateKeyFromDateNepal(dt);

    // ✅ configurable slot minutes (keep simple for now)
    const SLOT_MINUTES = Number(process.env.BOOKING_SLOT_MINUTES || 30);
    const start = dt;
    const end = new Date(dt.getTime() + SLOT_MINUTES * 60 * 1000);

    // ✅ transaction ensures consistent checks + insert under concurrency
    await session.withTransaction(async () => {
      // 1) Block overlapping bookings (same user + branch + dateKey)
      // Overlap rule: newStart < existingEnd AND newEnd > existingStart
      const overlap = await Booking.findOne(
        {
          user: userId,
          branch: branchId,
          dateKey,
          status: { $in: ["upcoming", "checked_in"] }, // active bookings only
          scheduledAt: { $lt: end }, // existingStart < newEnd
          // existingEnd > newStart  => existingStart > newStart - SLOT
          // Since existingEnd = existingStart + SLOT, rearrange:
          // existingStart > newStart - SLOT
          // So: scheduledAt > newStart - SLOT
          // We'll implement with $gt on scheduledAt:
          // (newStart - SLOT_MINUTES)
          scheduledAt: {
            $gt: new Date(start.getTime() - SLOT_MINUTES * 60 * 1000),
            $lt: end,
          },
        },
        null,
        { session }
      );

      if (overlap) {
        throw Object.assign(new Error("You already have a booking overlapping this time"), { statusCode: 409 });
      }

      // 2) Allocate next queueIndex using max(queueIndex)+1 (ignore cancelled)
      const last = await Booking.findOne(
        {
          branch: branchId,
          dateKey,
          status: { $nin: ["cancelled"] },
        },
        { queueIndex: 1 },
        { sort: { queueIndex: -1 }, session }
      );

      const nextIndex = (last?.queueIndex || 0) + 1;

      if (nextIndex > 50) {
        throw Object.assign(new Error("Daily limit reached (50 tickets for this branch)"), { statusCode: 400 });
      }

      const queueNumber = makeQueueNumber(nextIndex);

      const booking = await Booking.create(
        [
          {
            user: userId,
            venue: venueId,
            branch: branchId,
            title,
            organizationName: title,
            scheduledAt: start,
            dateKey,
            queueIndex: nextIndex,
            queueNumber,
            status: "upcoming",
          },
        ],
        { session }
      );

      const created = booking[0];

      const ticketToken = jwt.sign(
        {
          role: "ticket",
          bookingId: String(created._id),
          venueId: String(created.venue),
          branchId: String(created.branch),
          dateKey,
          queueNumber,
          queueIndex: created.queueIndex,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        success: true,
        message: "Booking created",
        data: {
          booking: created,
          queueNumber,
          ticketToken,
        },
      });
    });

    return; // response already sent in transaction
  } catch (err) {
    const code = err.statusCode || (err?.code === 11000 ? 409 : 500);

    if (code === 11000 || err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Ticket allocation conflict, please try again",
      });
    }

    console.error("createBooking error:", err);
    return res.status(code).json({ success: false, message: err.message || "Server error" });
  } finally {
    session.endSession();
  }
}

/**
 * ✅ GET MY BOOKINGS
 */
async function getMyBookings(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const bookings = await Booking.find({ user: userId })
      .sort({ scheduledAt: -1 })
      .populate("venue", "name")
      .populate("branch", "name");

    const enriched = bookings.map((b) => {
      const obj = b.toObject();
      const status = String(obj.status || "").toLowerCase();
      const isUpcoming = status === "upcoming";
      const ticketToken = isUpcoming ? buildTicketToken(b) : "";

      return {
        ...obj,
        venueName: obj?.venue?.name || "",
        branchName: obj?.branch?.name || "",
        ticketToken,
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("getMyBookings error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * ✅ GET BOOKING BY ID
 */
async function getBookingById(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate("venue", "name")
      .populate("branch", "name");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (String(booking.user) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const status = String(booking.status || "").toLowerCase();
    const isUpcoming = status === "upcoming";
    const ticketToken = isUpcoming ? buildTicketToken(booking) : "";

    return res.json({
      success: true,
      data: {
        ...booking.toObject(),
        venueName: booking?.venue?.name || "",
        branchName: booking?.branch?.name || "",
        ticketToken,
      },
    });
  } catch (err) {
    console.error("getBookingById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * ✅ SUBMIT REVIEW
 */
async function submitBookingReview(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { rating, review } = req.body;

    const r = Number(rating);

    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: "rating must be an integer between 1 and 5" });
    }

    const text = (review ?? "").toString().trim();
    if (text.length < 2) {
      return res.status(400).json({ success: false, message: "review is required" });
    }
    if (text.length > 500) {
      return res.status(400).json({ success: false, message: "review too long (max 500 chars)" });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (String(booking.user) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const status = String(booking.status || "").toLowerCase();
    if (status !== "completed") {
      return res.status(400).json({ success: false, message: "You can only review completed bookings" });
    }

    booking.rating = r;
    booking.review = text;
    booking.reviewedAt = new Date();

    await booking.save();

    return res.json({
      success: true,
      message: "Review submitted",
      data: {
        bookingId: String(booking._id),
        rating: booking.rating,
        review: booking.review,
        reviewedAt: booking.reviewedAt,
      },
    });
  } catch (err) {
    console.error("submitBookingReview error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * ✅ GET MY TODAY BOOKING
 * Returns earliest upcoming booking for today
 */
async function getMyTodayBooking(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { branchId, venueId } = req.query;
    const todayKey = dateKeyFromDateNepal(new Date());

    const query = {
      user: userId,
      dateKey: todayKey,
      status: { $in: ["upcoming", "checked_in"] },
      usedAt: null,
    };

    if (branchId) query.branch = branchId;
    else if (venueId) query.venue = venueId;

    const booking = await Booking.findOne(query)
      .sort({ scheduledAt: 1, createdAt: 1 })
      .populate("venue", "name")
      .populate("branch", "name");

    if (!booking) {
      return res.json({
        success: true,
        data: null,
        message: "No active booking for today",
      });
    }

    const safeBookingId = booking?._id ? String(booking._id) : null;
    const safeVenueId = booking?.venue ? String(booking.venue?._id || booking.venue) : (venueId ? String(venueId) : null);
    const safeBranchId = booking?.branch ? String(booking.branch?._id || booking.branch) : (branchId ? String(branchId) : null);

    if (!safeBookingId || !safeVenueId || !safeBranchId) {
      return res.json({
        success: true,
        data: null,
        message: "Booking record missing branch/venue (old data). Please re-book.",
      });
    }

    const ticketToken = jwt.sign(
      {
        role: "ticket",
        bookingId: safeBookingId,
        venueId: safeVenueId,
        branchId: safeBranchId,
        dateKey: booking.dateKey,
        queueNumber: booking.queueNumber,
        queueIndex: booking.queueIndex,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      data: {
        booking,
        queueNumber: booking.queueNumber,
        queueIndex: booking.queueIndex,
        ticketToken,
        dateKey: booking.dateKey,
        venueName: booking?.venue?.name || "",
        branchName: booking?.branch?.name || "",
      },
    });
  } catch (err) {
    console.error("getMyTodayBooking error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  submitBookingReview,
  getMyTodayBooking,
};
