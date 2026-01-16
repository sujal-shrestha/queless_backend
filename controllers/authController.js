// controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Booking = require("../models/Booking");

// ----------------------
// helpers
// ----------------------
const signToken = (user) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in .env");

  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const isValidUsername = (username) => {
  const re = /^[a-zA-Z0-9_-]{3,20}$/;
  return re.test(String(username));
};

// ----------------------
// AUTH
// ----------------------

// POST /api/auth/signup  (users only)
async function signup(req, res) {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    username = String(username).trim();
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-20 chars and only letters/numbers/_/- allowed",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(409).json({ success: false, message: "Email already exists" });

    const usernameExists = await User.findOne({ username });
    if (usernameExists) return res.status(409).json({ success: false, message: "Username already exists" });

    const user = await User.create({
      username,
      email,
      password,
      role: "user",
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}

// POST /api/auth/login  (user & staff)
async function login(req, res) {
  try {
    let { id, password, role } = req.body; // id = username

    if (!id || !password || !role) {
      return res.status(400).json({ success: false, message: "ID, password and role are required" });
    }

    id = String(id).trim();
    password = String(password);
    role = String(role).trim();

    if (!["user", "staff"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    if (!isValidUsername(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    // keep this generic
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // ✅ Populate branch + venue so we can return:
    // - branchId
    // - branchName
    // - venueName
    const user = await User.findOne({ username: id, role }).populate({
      path: "branch",
      select: "name venue",
      populate: { path: "venue", select: "name" },
    });

    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials" });

    // ✅ Staff must have a branch assigned
    if (user.role === "staff") {
      const staffBranchId = user.branch?._id
        ? String(user.branch._id)
        : user.branch
          ? String(user.branch)
          : "";

      if (!staffBranchId) {
        return res.status(403).json({
          success: false,
          message: "Staff is not assigned to a branch. Contact admin.",
        });
      }
    }

    const token = signToken(user);

    // ✅ branch + venue info for UI
    const branchId = user.branch?._id
      ? String(user.branch._id)
      : user.branch
        ? String(user.branch)
        : null;

    const branchName = user.branch?.name ? String(user.branch.name) : null;
    const venueName = user.branch?.venue?.name ? String(user.branch.venue.name) : null;

    return res.json({
      success: true,
      message: "Login successful",
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          branchId,     // ✅ for staff queue screen
          branchName,   // ✅ for UI display
          venueName,    // ✅ for UI display (e.g., "Nabil Bank")
        },
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}

// ----------------------
// PROFILE
// ----------------------

// GET /api/auth/profile
async function getProfile(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // ✅ Populate branch + venue for profile too (nice for UI)
    const user = await User.findById(userId)
      .select("-password")
      .populate({
        path: "branch",
        select: "name venue",
        populate: { path: "venue", select: "name" },
      });

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

    const { name, username, email, phone, address } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // If email is changing, ensure unique
    if (typeof email === "string" && email.trim()) {
      const nextEmail = email.trim().toLowerCase();
      if (!isValidEmail(nextEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email" });
      }
      const emailExists = await User.findOne({ email: nextEmail, _id: { $ne: userId } });
      if (emailExists) return res.status(409).json({ success: false, message: "Email already exists" });
      user.email = nextEmail;
    }

    // If username is changing, ensure unique
    if (typeof username === "string" && username.trim()) {
      const nextUsername = username.trim();
      if (!isValidUsername(nextUsername)) {
        return res.status(400).json({ success: false, message: "Invalid username format" });
      }
      const usernameExists = await User.findOne({ username: nextUsername, _id: { $ne: userId } });
      if (usernameExists) return res.status(409).json({ success: false, message: "Username already exists" });
      user.username = nextUsername;
    }

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof address === "string") user.address = address.trim();

    await user.save();

    const safe = await User.findById(userId)
      .select("-password")
      .populate({
        path: "branch",
        select: "name venue",
        populate: { path: "venue", select: "name" },
      });

    return res.json({ success: true, message: "Profile updated", data: safe });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// PUT /api/auth/change-password
async function changePassword(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const ok = await user.matchPassword(String(currentPassword));
    if (!ok) return res.status(400).json({ success: false, message: "Wrong current password" });

    user.password = String(newPassword);
    await user.save();

    return res.json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// DELETE /api/auth/profile
async function deleteMyAccount(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    await Booking.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);

    return res.json({ success: true, message: "Account deleted" });
  } catch (err) {
    console.error("deleteMyAccount error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  changePassword,
  deleteMyAccount,
};
