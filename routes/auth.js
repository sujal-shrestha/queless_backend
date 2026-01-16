const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");
const authController = require("../controllers/authController");

// Auth
router.post("/signup", authController.signup);
router.post("/login", authController.login);

// Profile
router.get("/profile", protect, authController.getProfile);
router.patch("/profile", protect, authController.updateProfile);
router.delete("/profile", protect, authController.deleteMyAccount);

// Security
router.put("/change-password", protect, authController.changePassword);

module.exports = router;
