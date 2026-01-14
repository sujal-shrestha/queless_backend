// controllers/venueController.js
const Venue = require("../models/Venue");
const Branch = require("../models/Branch");

// ============================
// GET /api/venues?search=
// ============================
exports.getVenues = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    const query = {
      isActive: true,
      ...(search ? { name: { $regex: search, $options: "i" } } : {}),
    };

    const venues = await Venue.find(query).sort({ name: 1 });

    return res.status(200).json({
      venues: venues.map((v) => ({
        _id: v._id,
        name: v.name,
        logo: v.logo || "",
        isActive: v.isActive,
      })),
    });
  } catch (e) {
    console.error("getVenues error:", e);
    return res.status(500).json({ message: "Failed to load venues" });
  }
};

// =====================================
// ✅ NEW: GET /api/venues/:venueId/branches
// =====================================
// This makes branches dynamic per venue.
// - Bank can have many branches
// - Hospital can have only one branch
exports.getVenueBranches = async (req, res) => {
  try {
    const { venueId } = req.params;

    if (!venueId) {
      return res.status(400).json({ message: "venueId is required" });
    }

    // Optional: confirm venue exists and active
    const venue = await Venue.findById(venueId).select("_id name isActive");
    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }
    if (!venue.isActive) {
      return res.status(400).json({ message: "Venue is not active" });
    }

    // Get ONLY branches for this venue
    const branches = await Branch.find({
      venue: venueId,
      isAvailable: true, // show only available branches
    }).sort({ name: 1 });

    // Return consistent format
    return res.status(200).json({
      venue: {
        _id: venue._id,
        name: venue.name,
      },
      branches: branches.map((b) => ({
        _id: b._id,
        name: b.name,
        address: b.address || "",
        isAvailable: b.isAvailable,
      })),
    });
  } catch (e) {
    console.error("getVenueBranches error:", e);
    return res.status(500).json({ message: "Failed to load branches" });
  }
};
