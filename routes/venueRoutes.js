// routes/venueRoutes.js
const router = require("express").Router();
const { getVenues, getVenueBranches } = require("../controllers/venueController");
const protect = require("../middleware/auth");

// ✅ Venues should be visible for USERS only (not staff)
// So we protect the routes and let controller enforce role rule.
router.get("/", protect, getVenues);

// ✅ GET /api/venues/:venueId/branches (users only)
router.get("/:venueId/branches", protect, getVenueBranches);

module.exports = router;
