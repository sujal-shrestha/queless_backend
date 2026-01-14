// routes/venueRoutes.js
const router = require("express").Router();
const { getVenues, getVenueBranches } = require("../controllers/venueController");

// GET /api/venues?search=
router.get("/", getVenues);

// ✅ NEW: GET /api/venues/:venueId/branches
router.get("/:venueId/branches", getVenueBranches);

module.exports = router;
