// controllers/venueController.js
const Venue = require("../models/Venue");
const Branch = require("../models/Branch");

// GET /api/venues?search=
exports.getVenues = async (req, res) => {
  try {
    // ✅ Block staff from listing venues
    if (req.user?.role === "staff") {
      return res.status(403).json({
        success: false,
        message: "Staff cannot access venues list",
      });
    }

    const search = (req.query.search || "").toString().trim();

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const venues = await Venue.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: venues,
    });
  } catch (e) {
    console.error("getVenues error:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to load venues",
    });
  }
};

// GET /api/venues/:venueId/branches
exports.getVenueBranches = async (req, res) => {
  try {
    // ✅ Block staff from viewing branches via venue browsing
    if (req.user?.role === "staff") {
      return res.status(403).json({
        success: false,
        message: "Staff cannot access venue branches",
      });
    }

    const { venueId } = req.params;

    const branches = await Branch.find({
      venue: venueId,
      isAvailable: true,
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: branches.map((b) => ({
        _id: b._id,
        name: b.name,
        address: b.address || "",
        isAvailable: b.isAvailable,
      })),
    });
  } catch (e) {
    console.error("getVenueBranches error:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to load branches",
    });
  }
};
