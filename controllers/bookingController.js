const Booking = require("../models/Booking");
const Venue = require("../models/Venue");

const computeStatus = (b) => {
  if (b.status === "cancelled") return "cancelled";
  return new Date(b.scheduledAt) < new Date() ? "completed" : "upcoming";
};

exports.createBooking = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authorized" });

    const { venueId, title, scheduledAt } = req.body;

    if (!venueId || !title || !scheduledAt) {
      return res.status(400).json({
        message: "venueId, title, scheduledAt are required",
      });
    }

    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ message: "Venue not found" });

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ message: "scheduledAt must be a valid date" });
    }

    const booking = await Booking.create({
      user: userId,
      venue: venue._id,
      title: title.trim(),
      organizationName: venue.name,
      scheduledAt: scheduledDate,
      status: "upcoming",
    });

    return res.status(201).json({
      booking: {
        id: booking._id,
        title: booking.title,
        organizationName: booking.organizationName,
        dateTime: booking.scheduledAt,
        status: computeStatus(booking),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authorized" });

    const bookings = await Booking.find({ user: userId })
      .sort({ scheduledAt: -1 })
      .lean();

    const items = bookings.map((b) => ({
      id: b._id,
      title: b.title,
      organizationName: b.organizationName,
      dateTime: b.scheduledAt,
      status: computeStatus(b),
    }));

    return res.json({ items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
