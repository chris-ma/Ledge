// Seeds the MVP's Sydney ledge cluster (README.md section 4a). Run via
// `npm run db:seed` after migrations have been applied. lat/lon/facing
// bearing are estimated from general geography, NOT surveyed on-site —
// height_verified stays false on every row until someone checks them
// against the real platform.
import "dotenv/config";
import { db } from "./client";
import { ledges, type NewLedge } from "./schema";

const SEED_LEDGES: NewLedge[] = [
  {
    name: "Cape Solander",
    area: "Kurnell / Royal National Park",
    lat: -34.0008,
    lon: 151.2325,
    facingBearing: 113,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.6,
    isDeclaredHazard: true,
    heightVerified: false,
    notes:
      "Estimated location/height, not surveyed. One of NSW's highest-profile rock-fishing hazard locations.",
  },
  {
    name: "Jibbon Point",
    area: "Bundeena",
    lat: -34.087,
    lon: 151.165,
    facingBearing: 113,
    platformHeightM: 5.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed. Moderate-exposure Royal NP ledge.",
  },
  {
    name: "Voodoo Point",
    area: "Malabar",
    lat: -33.97,
    lon: 151.257,
    facingBearing: 135,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed.",
  },
  {
    name: "Wedding Cake Island headland",
    area: "Coogee",
    lat: -33.923,
    lon: 151.262,
    facingBearing: 90,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed.",
  },
  {
    name: "Ben Buckler",
    area: "Bondi",
    lat: -33.8874,
    lon: 151.2822,
    facingBearing: 45,
    platformHeightM: 5.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed.",
  },
  {
    name: "Diamond Bay",
    area: "Vaucluse",
    lat: -33.858,
    lon: 151.282,
    facingBearing: 90,
    platformHeightM: 5.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed.",
  },
  {
    name: "The Gap",
    area: "Watsons Bay",
    lat: -33.8237,
    lon: 151.2814,
    facingBearing: 90,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.6,
    isDeclaredHazard: true,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed. Iconic, heavily fished, known hazard location.",
  },
  {
    name: "North Head",
    area: "Manly",
    lat: -33.821,
    lon: 151.299,
    facingBearing: 68,
    platformHeightM: 6.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed.",
  },
  {
    name: "Fairy Bower",
    area: "Manly",
    lat: -33.802,
    lon: 151.287,
    facingBearing: 23,
    platformHeightM: 3.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.8,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed. Sheltered — useful low-load control case.",
  },
  {
    name: "Long Reef Point",
    area: "Collaroy",
    lat: -33.735,
    lon: 151.316,
    facingBearing: 90,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.6,
    isDeclaredHazard: true,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed. Known hazard location.",
  },
  {
    name: "Dee Why Point",
    area: "Dee Why",
    lat: -33.753,
    lon: 151.298,
    facingBearing: 90,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes: "Estimated location/height, not surveyed.",
  },
  {
    name: "Barrenjoey Head",
    area: "Palm Beach",
    lat: -33.578,
    lon: 151.328,
    facingBearing: 23,
    platformHeightM: 6.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    notes:
      "Ocean-facing side only (MVP scope excludes the Pittwater-facing side). Estimated location/height, not surveyed.",
  },
];

async function main() {
  for (const ledge of SEED_LEDGES) {
    await db
      .insert(ledges)
      .values(ledge)
      .onConflictDoUpdate({
        target: ledges.name,
        set: {
          area: ledge.area,
          lat: ledge.lat,
          lon: ledge.lon,
          facingBearing: ledge.facingBearing,
          platformHeightM: ledge.platformHeightM,
          slopeEstimate: ledge.slopeEstimate,
          safetyMargin: ledge.safetyMargin,
          isDeclaredHazard: ledge.isDeclaredHazard,
          heightVerified: ledge.heightVerified,
          notes: ledge.notes,
          updatedAt: new Date(),
        },
      });
    console.log(`Upserted ${ledge.name}`);
  }
  console.log(`Seeded ${SEED_LEDGES.length} ledges.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
