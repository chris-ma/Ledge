// Seeds the MVP's Sydney ledge cluster (README.md section 4a). Run via
// `npm run db:seed` after migrations have been applied. lat/lon/facing
// bearing are estimated from general geography, NOT surveyed on-site —
// height_verified stays false on every row until someone checks them
// against the real platform.
import "dotenv/config";
import { fileURLToPath } from "url";
import { db } from "./client.js";
import { ledges, type NewLedge } from "./schema.js";

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
  // Sheltered Sydney Harbour ledges — ocean swell doesn't reach these, so
  // facing_bearing points out toward open harbour water (not out to sea),
  // and Fishing Pressure is computed from tide alone. See
  // server/model/fishingPressure.ts's sheltered branch.
  {
    name: "Camp Cove",
    area: "Watsons Bay (harbour side)",
    lat: -33.8404,
    lon: 151.2807,
    facingBearing: 250,
    platformHeightM: 2.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Bradleys Head",
    area: "Mosman",
    lat: -33.8402,
    lon: 151.2472,
    facingBearing: 75,
    platformHeightM: 2.5,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Chowder Bay / Clifton Gardens",
    area: "Mosman",
    lat: -33.8377,
    lon: 151.2494,
    facingBearing: 165,
    platformHeightM: 1.5,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Balmoral Point",
    area: "Balmoral",
    lat: -33.8266,
    lon: 151.2508,
    facingBearing: 185,
    platformHeightM: 2.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Nielsen Park",
    area: "Vaucluse",
    lat: -33.8551,
    lon: 151.2679,
    facingBearing: 350,
    platformHeightM: 2.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Cremorne Point",
    area: "Mosman",
    lat: -33.8425,
    lon: 151.2312,
    facingBearing: 220,
    platformHeightM: 2.5,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Kirribilli Point",
    area: "Kirribilli",
    lat: -33.8503,
    lon: 151.2159,
    facingBearing: 200,
    platformHeightM: 1.5,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
  {
    name: "Blues Point",
    area: "McMahons Point",
    lat: -33.8478,
    lon: 151.2098,
    facingBearing: 110,
    platformHeightM: 1.5,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot.",
  },
];

/** Upserts every seed ledge. Exported so both the CLI entrypoint below and a one-off admin endpoint can reuse it without duplicating the upsert logic. */
export async function seedLedges(): Promise<number> {
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
          sheltered: ledge.sheltered,
          notes: ledge.notes,
          updatedAt: new Date(),
        },
      });
    console.log(`Upserted ${ledge.name}`);
  }
  console.log(`Seeded ${SEED_LEDGES.length} ledges.`);
  return SEED_LEDGES.length;
}

// Only run as a CLI script (`npm run db:seed`), not when imported by another module.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedLedges().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
