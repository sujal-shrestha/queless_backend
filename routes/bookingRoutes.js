const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");
const { createBooking, getMyBookings } = require("../controllers/bookingController");

router.post("/", protect, createBooking);
router.get("/me", protect, getMyBookings);

module.exports = router;
