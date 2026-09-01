// Real coastline geometry for the map's Fishing Condition overlay.
//
// Every earlier iteration of that overlay drew a *synthetic* mark at each
// ledge's coordinate (a circle, a glow, a short line synthesized from
// facing_bearing, a rotated bar). All of them were wrong for the same
// reason: a rock ledge is a stretch of shoreline, not a point, and nothing
// synthesized from a single coordinate traces where the water's edge
// actually runs. So instead of inventing the shape, this fetches the real
// thing — OpenStreetMap's `natural=coastline` ways near each ledge — and
// the map paints those.
//
// Overpass can't be reached from the build sandbox (403 on CONNECT through
// the egress proxy), but it is reachable from a deployed Vercel function,
// which is where this runs: the same arrangement already used for
// Open-Meteo and ODB tide. The parsing/assignment functions below are pure
// and unit-tested; only fetchCoastlineWays does I/O.

import { distanceKm } from "./geo.js";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** How far around each ledge to pull coastline. Enough to read as a stretch of coast, not a dot. */
export const COASTLINE_FETCH_RADIUS_M = 2500;

/**
 * A coastline node further than this from every ledge is dropped: the app
 * only claims to describe the shoreline its ledges actually speak for, so
 * the overlay shouldn't bleed off down coast we have no data for.
 */
export const MAX_ASSIGN_DISTANCE_KM = 2.5;

/**
 * Consecutive nodes closer together than this are thinned out. OSM coastline
 * is mapped far finer than this overlay renders (sub-metre vertices in
 * places); keeping every vertex would bloat both the stored rows and the
 * JSON the browser downloads for no visible difference.
 */
export const MIN_VERTEX_SPACING_M = 15;

/** A run of coastline that belongs to one ledge, in coastline order. */
export interface CoastlineRun {
  ledgeId: string;
  path: [number, number][];
}

/** Minimal shape of a ledge needed here — avoids depending on the full DB row type. */
export interface LedgeAnchor {
  id: string;
  lat: number;
  lon: number;
}

/**
 * An Overpass QL query for coastline within COASTLINE_FETCH_RADIUS_M of any
 * of these ledges. `out geom` inlines each way's vertices, so one round trip
 * returns everything without a second node lookup.
 */
export function buildOverpassQuery(
  ledges: ReadonlyArray<LedgeAnchor>,
  radiusM: number = COASTLINE_FETCH_RADIUS_M,
): string {
  const clauses = ledges
    .map((l) => `way["natural"="coastline"](around:${radiusM},${l.lat},${l.lon});`)
    .join("\n  ");
  return `[out:json][timeout:180];\n(\n  ${clauses}\n);\nout geom;`;
}

/**
 * Pulls each way's vertex list out of an Overpass `out geom` response.
 * Ways with fewer than 2 vertices can't draw a line and are dropped.
 */
export function parseOverpassCoastline(body: unknown): [number, number][][] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { elements?: unknown }).elements)) {
    throw new Error(
      `Unexpected Overpass response shape: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  const ways: [number, number][][] = [];
  for (const element of (body as { elements: unknown[] }).elements) {
    if (!element || typeof element !== "object") continue;
    const geometry = (element as { geometry?: unknown }).geometry;
    if (!Array.isArray(geometry)) continue;

    const path: [number, number][] = [];
    for (const point of geometry) {
      if (!point || typeof point !== "object") continue;
      const { lat, lon } = point as { lat?: unknown; lon?: unknown };
      if (typeof lat === "number" && typeof lon === "number") path.push([lat, lon]);
    }
    if (path.length >= 2) ways.push(path);
  }
  return ways;
}

/** Nearest ledge to a point, or null if none is within maxDistanceKm. */
function nearestLedge(
  lat: number,
  lon: number,
  ledges: ReadonlyArray<LedgeAnchor>,
  maxDistanceKm: number,
): LedgeAnchor | null {
  let best: LedgeAnchor | null = null;
  let bestKm = Infinity;
  for (const ledge of ledges) {
    const km = distanceKm(lat, lon, ledge.lat, ledge.lon);
    if (km < bestKm) {
      bestKm = km;
      best = ledge;
    }
  }
  return bestKm <= maxDistanceKm ? best : null;
}

/** Drops vertices closer than minSpacingM to the previous kept one, always keeping the endpoints. */
function thinPath(path: [number, number][], minSpacingM: number): [number, number][] {
  if (path.length <= 2) return path;
  const kept: [number, number][] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const last = kept[kept.length - 1];
    if (distanceKm(last[0], last[1], path[i][0], path[i][1]) * 1000 >= minSpacingM) {
      kept.push(path[i]);
    }
  }
  kept.push(path[path.length - 1]);
  return kept;
}

/**
 * Splits the fetched coastline into runs, each owned by whichever ledge is
 * nearest to it. A run breaks whenever the nearest ledge changes or a node
 * falls outside every ledge's reach, so each ledge ends up painting the
 * stretch of shore closest to it and nothing else. Runs never span two ways
 * — separate ways aren't necessarily contiguous coastline.
 */
export function assignCoastlineToLedges(
  ways: ReadonlyArray<[number, number][]>,
  ledges: ReadonlyArray<LedgeAnchor>,
  maxDistanceKm: number = MAX_ASSIGN_DISTANCE_KM,
  minVertexSpacingM: number = MIN_VERTEX_SPACING_M,
): CoastlineRun[] {
  const runs: CoastlineRun[] = [];

  for (const way of ways) {
    let currentLedgeId: string | null = null;
    let currentPath: [number, number][] = [];

    const flush = () => {
      // A single point can't draw a line.
      if (currentLedgeId && currentPath.length >= 2) {
        runs.push({ ledgeId: currentLedgeId, path: thinPath(currentPath, minVertexSpacingM) });
      }
      currentLedgeId = null;
      currentPath = [];
    };

    for (const [lat, lon] of way) {
      const owner = nearestLedge(lat, lon, ledges, maxDistanceKm);
      if (!owner) {
        flush();
        continue;
      }
      if (owner.id !== currentLedgeId) {
        // Carry the boundary node into the next run too, so adjacent ledges'
        // stretches meet rather than leaving a one-segment gap between them.
        const boundary = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
        flush();
        currentLedgeId = owner.id;
        if (boundary) currentPath.push(boundary);
      }
      currentPath.push([lat, lon]);
    }
    flush();
  }

  return runs;
}

/**
 * Each ledge's coordinate snapped onto the nearest real coastline vertex.
 * Seed coordinates are landmark-level estimates and several sit inland (the
 * North Head one lands back on the headland, not on the cliff edge); this is
 * where the water's edge actually is for map-marker purposes. Ledges with no
 * coastline within maxDistanceKm are left out rather than snapped to
 * something implausibly far away.
 */
export function snapLedgesToCoastline(
  ways: ReadonlyArray<[number, number][]>,
  ledges: ReadonlyArray<LedgeAnchor>,
  maxDistanceKm: number = MAX_ASSIGN_DISTANCE_KM,
): Map<string, { lat: number; lon: number }> {
  const snapped = new Map<string, { lat: number; lon: number }>();

  for (const ledge of ledges) {
    let bestKm = Infinity;
    let best: { lat: number; lon: number } | null = null;
    for (const way of ways) {
      for (const [lat, lon] of way) {
        const km = distanceKm(ledge.lat, ledge.lon, lat, lon);
        if (km < bestKm) {
          bestKm = km;
          best = { lat, lon };
        }
      }
    }
    if (best && bestKm <= maxDistanceKm) snapped.set(ledge.id, best);
  }

  return snapped;
}

// Overpass asks clients to identify themselves, and some instances reject
// requests carrying a bare runtime default.
const USER_AGENT = "LedgeLords/1.0 (Sydney rock-fishing conditions; one-off coastline build)";

/**
 * Fetches coastline ways near the given ledges. Tries each mirror, and both
 * POST encodings Overpass accepts (form-encoded `data=`, and the raw query
 * as the body) — instances differ on which they'll take, and a rejection
 * from one shouldn't sink a one-off geometry build. Error bodies are carried
 * into the thrown message: Overpass explains syntax and load problems in the
 * body, and this can only be run against the live deployment, so a blind
 * "HTTP 400" would be very expensive to debug.
 */
export async function fetchCoastlineWays(
  ledges: ReadonlyArray<LedgeAnchor>,
  radiusM: number = COASTLINE_FETCH_RADIUS_M,
): Promise<[number, number][][]> {
  const query = buildOverpassQuery(ledges, radiusM);
  const errors: string[] = [];

  const attempts: { contentType: string; body: string }[] = [
    {
      contentType: "application/x-www-form-urlencoded",
      body: new URLSearchParams({ data: query }).toString(),
    },
    { contentType: "text/plain; charset=utf-8", body: query },
  ];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (const attempt of attempts) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": attempt.contentType,
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          body: attempt.body,
        });
        if (!response.ok) {
          const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 400);
          errors.push(`${endpoint} [${attempt.contentType}] -> HTTP ${response.status}: ${detail}`);
          continue;
        }
        const ways = parseOverpassCoastline(await response.json());
        if (ways.length === 0) {
          errors.push(`${endpoint} [${attempt.contentType}] -> 0 coastline ways`);
          continue;
        }
        return ways;
      } catch (err) {
        errors.push(
          `${endpoint} [${attempt.contentType}] -> ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  throw new Error(`Every Overpass attempt failed: ${errors.join(" | ")}`);
}
