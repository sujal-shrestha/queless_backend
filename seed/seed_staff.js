// seed/seed_staff.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Branch = require("../models/Branch");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE;
  if (!uri) {
    console.error("❌ Missing MONGO_URI / MONGODB_URI (or DATABASE) in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ DB connected");

  // Staff credentials
  const staffUsername = "ST2024001";
  const staffEmail = "staff1@queless.com";
  const staffPassword = "staff123";

  // ✅ Branch selection
  let branchId = (process.env.DEFAULT_STAFF_BRANCH_ID || "").trim();

  if (!isValidObjectId(branchId)) {
    // Auto pick first branch
    const firstBranch = await Branch.findOne().select("_id name venue").lean();

    if (!firstBranch) {
      console.error("❌ No branches found in DB. Seed branches first.");
      process.exit(1);
    }

    branchId = String(firstBranch._id);
    console.log(`✅ DEFAULT_STAFF_BRANCH_ID not set/invalid. Using first branch: ${branchId} (${firstBranch.name || "Unnamed"})`);
    console.log("👉 Tip: copy this into .env as DEFAULT_STAFF_BRANCH_ID to lock it.");
  }

  const existing = await User.findOne({ username: staffUsername });

  if (existing) {
    existing.role = "staff";
    existing.branch = branchId;

    // Uncomment if you want to reset password every run:
    existing.password = staffPassword;

    await existing.save();
    console.log("✅ Updated existing staff:", staffUsername);
  } else {
    await User.create({
      username: staffUsername,
      email: staffEmail,
      password: staffPassword,
      role: "staff",
      branch: branchId,
    });
    console.log("✅ Created staff:", staffUsername, "password:", staffPassword);
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

run().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
