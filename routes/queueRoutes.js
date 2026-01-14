const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");
const { getLiveQueue } = require("../controllers/queueController");

// ✅ user can view live queue for their branch
router.get("/live/:branchId", protect, getLiveQueue);

module.exports = router;
