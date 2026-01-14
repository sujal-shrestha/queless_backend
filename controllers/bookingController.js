const jwt = require("jsonwebtoken");
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
  // safe guards for old docs
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
 */
async function createBooking(req, res) {
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

    const MAX_RETRIES = 6;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // ✅ count by BRANCH + dateKey (not venue)
      const countToday = await Booking.countDocuments({ branch: branchId, dateKey });
      const nextIndex = countToday + 1;

      if (nextIndex > 50) {
        return res.status(400).json({
          success: false,
          message: "Daily limit reached (50 tickets for this branch)",
        });
      }

      const queueNumber = makeQueueNumber(nextIndex);

      try {
        const booking = await Booking.create({
          user: userId,
          venue: venueId,
          branch: branchId,
          title,
          organizationName: title,
          scheduledAt: dt,
          dateKey,
          queueIndex: nextIndex,
          queueNumber,
          status: "upcoming",
        });

        const ticketToken = jwt.sign(
          {
            role: "ticket",
            bookingId: String(booking._id),
            venueId: String(booking.venue),
            branchId: String(booking.branch),
            dateKey,
            queueNumber,
            queueIndex: booking.queueIndex,
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.status(201).json({
          success: true,
          message: "Booking created",
          data: {
            booking,
            queueNumber,
            ticketToken,
          },
        });
      } catch (err) {
        // Unique index collision retry
        if (err && err.code === 11000) {
          if (attempt === MAX_RETRIES) {
            console.error("createBooking duplicate retry failed:", err);
            return res.status(409).json({
              success: false,
              message: "Ticket allocation conflict, please try again",
            });
          }
          continue;
        }

        console.error("createBooking error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
      }
    }
  } catch (err) {
    console.error("createBooking outer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * ✅ GET MY BOOKINGS
 * Adds:
 * - ticketToken for upcoming bookings (so History can show QR)
 * - branchName + venueName (easy UI)
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

      // Only generate QR token for upcoming (you can allow completed too if you want)
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
 * ✅ GET BOOKING BY ID (Fixes your 404)
 * GET /api/bookings/:id
 * Used by History upcoming click → fetch token/details
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

    // ✅ owner check
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
 * ✅ SUBMIT REVIEW (Past visit)
 * POST /api/bookings/:id/review
 * body: { rating: 1..5, review: "..." }
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

    // ✅ owner check
    if (String(booking.user) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const status = String(booking.status || "").toLowerCase();

    // ✅ allow review only for completed (past)
    if (status !== "completed") {
      return res.status(400).json({ success: false, message: "You can only review completed bookings" });
    }

    // ✅ store review fields
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
 * ✅ GET MY TODAY BOOKING (for Live Queue screen)
 * GET /api/bookings/me/today?branchId=... (preferred) OR ?venueId=...
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
      status: "upcoming",
      usedAt: null,
    };

    // ✅ Prefer branch filtering (new system)
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

    // ✅ Prevent crash if old DB docs are missing new fields
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
