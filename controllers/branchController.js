const Branch = require("../models/Branch");

exports.getBranchesByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;

    const branches = await Branch.find({
      venue: venueId,
      isAvailable: true,
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      branches: branches.map((b) => ({
        _id: b._id,
        name: b.name,
        address: b.address || "",
        isAvailable: b.isAvailable,
      })),
    });
  } catch (e) {
    console.error("getBranchesByVenue error:", e);
    return res.status(500).json({ success: false, message: "Failed to load branches" });
  }
};
