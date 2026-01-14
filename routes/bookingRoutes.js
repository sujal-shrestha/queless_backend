const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");

const {
  createBooking,
  getMyBookings,
  getMyTodayBooking,
  getBookingById,
  submitBookingReview,
} = require("../controllers/bookingController");

// ✅ Create a booking (assigns daily ticket A-01..A-50)
router.post("/", protect, createBooking);

// ✅ Get logged-in user's bookings list
router.get("/me", protect, getMyBookings);

// ✅ Get logged-in user's TODAY booking
router.get("/me/today", protect, getMyTodayBooking);

// ✅ Get booking by id (for upcoming history → show QR)
router.get("/:id", protect, getBookingById);

// ✅ Submit review for completed booking (past visit)
router.post("/:id/review", protect, submitBookingReview);

module.exports = router;
