const mongoose = require("mongoose");
require("dotenv").config();

const Venue = require("./models/Venue");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  await Venue.deleteMany();

  await Venue.insertMany([
    { name: "Hams Hospital", type: "hospital", logoUrl: "" },
    { name: "Nabil Bank", type: "bank", logoUrl: "" },
    { name: "Mediciti Hospital", type: "hospital", logoUrl: "" },
    { name: "Siddhartha Bank", type: "bank", logoUrl: "" },
    { name: "Laxmi Sunrise Bank", type: "bank", logoUrl: "" },
  ]);

  console.log("✅ Venues seeded");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
