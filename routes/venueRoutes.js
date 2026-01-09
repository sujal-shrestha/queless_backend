// routes/venueRoutes.js
const router = require("express").Router();
const { getVenues } = require("../controllers/venueController");

router.get("/", getVenues); // GET /api/venues?search=

module.exports = router;
