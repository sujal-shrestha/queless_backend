const express = require("express");
const router = express.Router();

// ✅ FIXED PATH
const staffAuth = require("../middleware/staffAuth");

// OPTIONAL (but recommended): users should be logged in to poll queue
const protect = require("../middleware/auth");

const {
  staffLogin,
  verifyTicket,
  getTodayQueueForStaff,
  nextQueue,
  getTodayQueueForUser,
} = require("../controllers/orgQueueController");

// -------------------
// STAFF
// -------------------

// staff login (super basic)
router.post("/login", staffLogin);

// staff protected routes
router.post("/verify-ticket", staffAuth, verifyTicket);
router.get("/queue/today/:venueId", staffAuth, getTodayQueueForStaff);
router.post("/queue/next/:venueId", staffAuth, nextQueue);

// -------------------
// USER (Polling Endpoint)
// -------------------
// ✅ Users can poll this every 3–5 seconds to get live queue updates
router.get("/queue/live/:venueId", protect, getTodayQueueForUser);

module.exports = router;
