// controllers/venueController.js
const Venue = require("../models/Venue");

exports.getVenues = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    const query = {
      isActive: true,
      ...(search
        ? { name: { $regex: search, $options: "i" } }
        : {}),
    };

    const venues = await Venue.find(query).sort({ name: 1 });

    // build base url for logo links
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const mapped = venues.map((v) => ({
      _id: v._id,
      name: v.name,
      logoUrl: v.logo ? `${baseUrl}/logos/${v.logo}` : "",
    }));

    return res.status(200).json(mapped);
  } catch (e) {
    return res.status(500).json({ message: "Failed to load venues" });
  }
};
