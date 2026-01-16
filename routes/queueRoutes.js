// routes/queueRoutes.js
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");
const staffOnly = require("../middleware/staffOnly");

const queueController = require("../controllers/queueController");

// Anyone logged-in can read live queue (user + staff)
router.get("/live/:branchId", protect, queueController.getLiveQueue);

// Staff-only
router.get("/:branchId/appointments", protect, staffOnly, queueController.getAppointmentsForDay);
router.post("/:branchId/start", protect, staffOnly, queueController.startDay);
router.post("/:branchId/next", protect, staffOnly, queueController.nextTicket);
router.post("/verify-ticket", protect, staffOnly, queueController.verifyTicket);

module.exports = router;
