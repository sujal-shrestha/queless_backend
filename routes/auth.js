// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// helper to create token
const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    // Helps you catch missing .env quickly
    throw new Error("JWT_SECRET is not set in .env");
  }

  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// simple validators
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const isValidUsername = (username) => {
  // allow letters, numbers, underscore, dash (good for IDs like S2024001 / ST2024001)
  const re = /^[a-zA-Z0-9_-]{3,20}$/;
  return re.test(String(username));
};

// POST /api/auth/signup  (for normal users)
router.post("/signup", async (req, res) => {
  try {
    let { username, email, password } = req.body;

    // basic required checks
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    username = String(username).trim();
    email = String(email).trim().toLowerCase();
    password = String(password);

    // username rules
    if (!isValidUsername(username)) {
      return res.status(400).json({
        message:
          "Username must be 3-20 chars and only letters/numbers/_/- allowed",
      });
    }

    // email rules
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    // password rules
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // check duplicates separately (better user feedback)
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: "Username already exists" });
    }

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
    // ✅ IMPORTANT: print full error + stack so we can fix the real issue
    console.error("Signup error FULL:", err);
    console.error("Signup error STACK:", err?.stack);

    return res.status(500).json({
      message: "Server error",
      error: err?.message ?? "Unknown error",
    });
  }
});

// POST /api/auth/login   (both user & staff)
router.post("/login", async (req, res) => {
  try {
    let { id, password, role } = req.body; // id = username (student/staff id)

    if (!id || !password || !role) {
      return res
        .status(400)
        .json({ message: "ID, password and role are required" });
    }

    id = String(id).trim();
    password = String(password);

    // role validation
    if (!["user", "staff"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // username rules (same as signup)
    if (!isValidUsername(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ username: id, role });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

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
    // ✅ print full error + stack
    console.error("Login error FULL:", err);
    console.error("Login error STACK:", err?.stack);

    return res.status(500).json({
      message: "Server error",
      error: err?.message ?? "Unknown error",
    });
  }
});

module.exports = router;
