// middleware/restrictTo.js
module.exports = (...roles) => {
  return (req, res, next) => {
    // your protect middleware should attach req.user
    const role = req.user?.role || req.userRole; // support either
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: "Forbidden: staff only" });
    }
    next();
  };
};
