// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Booking = require("../models/Booking"); // ✅ for cleanup on delete (recommended)
const protect = require("../middleware/auth");

const router = express.Router();

// helper to create token
const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in .env");
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// validators
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
const isValidUsername = (username) => /^[a-zA-Z0-9_-]{3,20}$/.test(String(username));

// --------------------
// SIGNUP
// --------------------
router.post("/signup", async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) return res.status(400).json({ message: "All fields are required" });

    username = String(username).trim();
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (!isValidUsername(username)) {
      return res.status(400).json({
        message: "Username must be 3-20 chars and only letters/numbers/_/- allowed",
      });
    }

    if (!isValidEmail(email)) return res.status(400).json({ message: "Please enter a valid email" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ message: "Email already exists" });

    const usernameExists = await User.findOne({ username });
    if (usernameExists) return res.status(400).json({ message: "Username already exists" });

    const user = await User.create({
      username,
      email,
      password,
      role: "user",
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Signup error FULL:", err);
    console.error("Signup error STACK:", err?.stack);
    return res.status(500).json({ message: "Server error", error: err?.message ?? "Unknown error" });
  }
});

// --------------------
// LOGIN
// --------------------
router.post("/login", async (req, res) => {
  try {
    let { id, password, role } = req.body;

    if (!id || !password || !role) return res.status(400).json({ message: "ID, password and role are required" });

    id = String(id).trim();
    password = String(password);

    if (!["user", "staff"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    if (!isValidUsername(id)) return res.status(400).json({ message: "Invalid ID format" });
    if (password.length < 6) return res.status(400).json({ message: "Invalid credentials" });

    const user = await User.findOne({ username: id, role });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Login error FULL:", err);
    console.error("Login error STACK:", err?.stack);
    return res.status(500).json({ message: "Server error", error: err?.message ?? "Unknown error" });
  }
});

// ==========================
// ✅ PROFILE (Flutter uses /api/auth/profile)
// ==========================

// GET /api/auth/profile
router.get("/profile", protect, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        phone: user.phone ?? "",
        address: user.address ?? "",
        createdAt: user.createdAt ?? null,
      },
    });
  } catch (e) {
    console.error("GET /profile error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/auth/profile
router.patch("/profile", protect, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { name, email, phone, address } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof name === "string") user.name = name.trim();
    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof address === "string") user.address = address.trim();

    if (typeof email === "string" && email.trim()) {
      const e = email.trim().toLowerCase();
      if (!isValidEmail(e)) return res.status(400).json({ message: "Please enter a valid email" });

      const emailExists = await User.findOne({ email: e, _id: { $ne: userId } });
      if (emailExists) return res.status(400).json({ message: "Email already exists" });

      user.email = e;
    }

    await user.save();

    const safe = await User.findById(userId).select("-password");

    return res.json({
      success: true,
      message: "Profile updated",
      data: {
        id: safe._id,
        username: safe.username,
        email: safe.email,
        role: safe.role,
        name: safe.name ?? "",
        phone: safe.phone ?? "",
        address: safe.address ?? "",
        createdAt: safe.createdAt ?? null,
      },
    });
  } catch (e) {
    console.error("PATCH /profile error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/auth/change-password
router.put("/change-password", protect, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await user.matchPassword(String(currentPassword));
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });

    user.password = String(newPassword);
    await user.save();

    return res.json({ success: true, message: "Password updated" });
  } catch (e) {
    console.error("PUT /change-password error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/auth/profile  ✅ delete account
router.delete("/profile", protect, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // cleanup bookings
    try {
      await Booking.deleteMany({ user: userId });
    } catch (e) {
      console.warn("Booking cleanup failed:", e?.message);
    }

    await User.findByIdAndDelete(userId);

    return res.json({ success: true, message: "Account deleted" });
  } catch (e) {
    console.error("DELETE /profile error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
