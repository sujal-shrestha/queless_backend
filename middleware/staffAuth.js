// middlewares/staffAuth.js
const jwt = require("jsonwebtoken");

module.exports = function staffAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ We only allow staff tokens here
    if (!decoded || decoded.role !== "staff") {
      return res.status(403).json({ success: false, message: "Staff access only" });
    }

    req.staff = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
