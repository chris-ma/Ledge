// Seeds the MVP's Sydney ledge cluster (README.md section 4a). Run via
// `npm run db:seed` after migrations have been applied. Coordinates are
// each ledge's own named-landmark location (cross-checked against public
// reference coordinates for that headland/point/beach — not a fresh guess),
// which is the same point used to query its swell/tide data; there is no
// separate "weather station" coordinate anywhere in this app. Still NOT a
// surveyed position of the actual rock platform anglers fish from, which
// can be tens of metres from the named landmark's own reference point —
// height_verified stays false on every row until someone checks it
// on-site.
import "dotenv/config";
import { fileURLToPath } from "url";
import { db } from "./client.js";
import { ledges, type NewLedge } from "./schema.js";

const SEED_LEDGES: NewLedge[] = [
  {
    name: "Cape Solander",
    area: "Kurnell / Royal National Park",
    lat: -34.0164,
    lon: 151.2317,
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
    lat: -34.083,
    lon: 151.157,
    facingBearing: 100,
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
    lat: -33.9606,
    lon: 151.2619,
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
    lat: -33.9215,
    lon: 151.2595,
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
    lat: -33.8842,
    lon: 151.2844,
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
    lat: -33.8435,
    lon: 151.2825,
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
    lat: -33.815,
    lon: 151.301,
    facingBearing: 75,
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
    lat: -33.8008,
    lon: 151.2944,
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
    lat: -33.7318,
    lon: 151.3179,
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
    lat: -33.7544,
    lon: 151.2854,
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
    lat: -33.5801,
    lon: 151.3298,
    facingBearing: 80,
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
    lat: -33.8402,
    lon: 151.2762,
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
    lat: -33.8525,
    lon: 151.2458,
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
    lat: -33.8421,
    lon: 151.2476,
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
    lat: -33.8252,
    lon: 151.2465,
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
    lat: -33.8521,
    lon: 151.2669,
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
    lat: -33.8488,
    lon: 151.233,
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
    lat: -33.851,
    lon: 151.219,
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
    lat: -33.8498,
    lon: 151.2038,
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
  // Anchor points added to close real coastline gaps the coastline builder
  // couldn't reach from any existing ledge, even at its widened 5km radius
  // (see COASTLINE_FETCH_RADIUS_M in server/coastline.ts): the northern
  // beaches between Barrenjoey Head and Long Reef Point, the harbour's south
  // shore between the Bridge/city and Vaucluse, and Middle Harbour/Balgowlah,
  // which no existing ledge's own coordinate sits anywhere near.
  {
    name: "Bungan Head",
    area: "Newport / Mona Vale",
    lat: -33.664,
    lon: 151.325,
    facingBearing: 95,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: false,
    notes:
      "Estimated location/height, not surveyed. Closes the northern-beaches gap between Barrenjoey Head and Turimetta Head.",
  },
  {
    name: "Turimetta Head",
    area: "Warriewood / Narrabeen",
    lat: -33.703,
    lon: 151.301,
    facingBearing: 95,
    platformHeightM: 4.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: false,
    notes:
      "Estimated location/height, not surveyed. Closes the northern-beaches gap between Bungan Head and Long Reef Point.",
  },
  {
    name: "Point Piper",
    area: "Point Piper",
    lat: -33.8698,
    lon: 151.2483,
    facingBearing: 20,
    platformHeightM: 1.5,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot. Closes the south-shore gap between the Harbour Bridge/city and Vaucluse.",
  },
  {
    name: "Grotto Point",
    area: "Clontarf / Middle Harbour",
    lat: -33.8027,
    lon: 151.2531,
    facingBearing: 180,
    platformHeightM: 2.0,
    slopeEstimate: 0.1,
    safetyMargin: 0.7,
    isDeclaredHazard: false,
    heightVerified: false,
    sheltered: true,
    notes:
      "Sheltered harbour ledge, estimated location/height, not surveyed. Fishing pressure is tide-only — ocean swell doesn't reach this spot. Anchors the Middle Harbour entrance.",
  },
  {
    name: "Balgowlah Heights",
    area: "North Harbour / Manly Cove",
    lat: -33.797,
    lon: 151.262,
    facingBearing: 230,
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
