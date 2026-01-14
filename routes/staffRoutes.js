const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

/**
 * POST /api/staff/login
 * body: { staffId, password }
 */
router.post("/login", (req, res) => {
  const { staffId, password } = req.body;

  if (!staffId || !password) {
    return res.status(400).json({ success: false, message: "staffId and password required" });
  }

  const ok =
    staffId === process.env.STAFF_ID && password === process.env.STAFF_PASSWORD;

  if (!ok) {
    return res.status(401).json({ success: false, message: "Invalid staff credentials" });
  }

  const token = jwt.sign(
    { role: "staff", staffId },
    process.env.STAFF_JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    success: true,
    token,
    role: "staff",
    staffId,
  });
});

module.exports = router;
