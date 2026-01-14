const User = require("../models/User");
const Booking = require("../models/Booking");

// GET /api/auth/profile
async function getProfile(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// PATCH /api/auth/profile
async function updateProfile(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { name, username, email, phone } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // support either name or username depending on your schema
    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof username === "string" && username.trim()) user.username = username.trim();
    if (typeof email === "string" && email.trim()) user.email = email.trim();
    if (typeof phone === "string") user.phone = phone.trim();

    await user.save();

    const safe = await User.findById(userId).select("-password");
    return res.json({ success: true, message: "Profile updated", data: safe });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// DELETE /api/auth/profile  (Delete Account)
async function deleteMyAccount(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // delete user's bookings too (recommended)
    await Booking.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);

    return res.json({ success: true, message: "Account deleted" });
  } catch (err) {
    console.error("deleteMyAccount error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  deleteMyAccount,
};
