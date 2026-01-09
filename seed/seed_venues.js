// seed/seed_venues.js
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const Venue = require("../models/Venue");
const Branch = require("../models/Branch");

const venuesData = [
  {
    name: "Hams Hospital",
    logo: "hams.png",
    branches: [
      { name: "Hattigauda", address: "Budhanilkantha" },
      { name: "New Road", address: "New Road, KTM" },
    ],
  },
  {
    name: "Nabil Bank",
    logo: "nabil.png",
    branches: [
      { name: "Durbar Marg", address: "Kathmandu" },
      { name: "Kalimati", address: "Kathmandu" },
    ],
  },
  {
    name: "Medicity Hospital",
    logo: "medicity.png",
    branches: [
      { name: "Bhaisepati", address: "Lalitpur" },
      { name: "Satdobato", address: "Lalitpur" },
    ],
  },
  {
    name: "Siddhartha Bank",
    logo: "siddhartha.png",
    branches: [
      { name: "Putalisadak", address: "Kathmandu" },
      { name: "Bhaktapur", address: "Bhaktapur" },
    ],
  },
  {
    name: "Laxmi Sunrise Bank",
    logo: "laxmi.png",
    branches: [
      { name: "Baneshwor", address: "Kathmandu" },
      { name: "Lazimpat", address: "Kathmandu" },
    ],
  },
];

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI is missing in .env");

  await mongoose.connect(uri);

  await Branch.deleteMany({});
  await Venue.deleteMany({});

  for (const v of venuesData) {
    const venue = await Venue.create({
      name: v.name,
      logo: v.logo,
      isActive: true,
    });

    const branches = v.branches.map((b) => ({
      venue: venue._id,
      name: b.name,
      address: b.address,
      isAvailable: true,
    }));

    await Branch.insertMany(branches);
  }

  console.log("✅ Seeded 5 venues + branches");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
