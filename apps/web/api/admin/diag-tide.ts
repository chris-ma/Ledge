import { destinationPoint } from "../../server/geo.js";
import { fetchTide } from "../../server/sources/odbTide.js";

export const maxDuration = 60;

// Temporary diagnostic endpoint — not part of the app. Tests the ODB tide
// API against several candidate coordinates for a failing inner-harbour
// ledge, to find a fallback point that actually resolves. Delete once the
// real fix lands.

const CANDIDATES: { label: string; lat: number; lon: number }[] = [
  { label: "Kirribilli Point exact", lat: -33.851, lon: 151.219 },
  {
    label: "Kirribilli Point current 8km fallback (bearing 200)",
    ...destinationPoint(-33.851, 151.219, 200, 8),
  },
  { label: "Camp Cove exact (known-good, near Heads)", lat: -33.8402, lon: 151.2762 },
  { label: "Near South Head / harbour entrance", lat: -33.8398, lon: 151.28 },
  { label: "Mid-harbour open water (west of Bridge, off Balls Head)", lat: -33.846, lon: 151.2 },
  { label: "Cremorne Point exact", lat: -33.8488, lon: 151.233 },
  {
    label: "Cremorne Point current 8km fallback (bearing 220)",
    ...destinationPoint(-33.8488, 151.233, 220, 8),
  },
  { label: "Bradleys Head exact", lat: -33.8525, lon: 151.2458 },
  { label: "Chowder Bay exact", lat: -33.8421, lon: 151.2476 },
  { label: "Balmoral Point exact", lat: -33.8252, lon: 151.2465 },
];

// No secret gate: this is read-only (only calls the public ODB tide API,
// no DB access, no writes) and is deleted right after use.
export async function GET(): Promise<Response> {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const results = await Promise.all(
    CANDIDATES.map(async (c) => {
      try {
        const hours = await fetchTide(c.lat, c.lon, start, end);
        const nonNullCount = hours.filter((h) => h.tideHeightCm !== null).length;
        return {
          label: c.label,
          lat: c.lat,
          lon: c.lon,
          ok: true,
          hourCount: hours.length,
          nonNullTideCount: nonNullCount,
          sample: hours.slice(0, 3),
        };
      } catch (err) {
        return {
          label: c.label,
          lat: c.lat,
          lon: c.lon,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return Response.json({ results });
}
