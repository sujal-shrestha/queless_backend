// middleware/staffOnly.js
module.exports = function staffOnly(req, res, next) {
  const role = req.user?.role;
  if (role !== "staff") {
    return res.status(403).json({ success: false, message: "Staff access only" });
  }
  next();
};
