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

/**
 * How far around each ledge to pull coastline. Originally 2500 (just enough
 * to read as a stretch of coast, not a dot), but at that radius the 20
 * ledges' claimed stretches don't reach each other — most neighbouring
 * ledges are 1-7km apart along the coast (see the nearest-neighbour survey
 * in the calibration history), so the map showed isolated coloured patches
 * with bare gaps between them at named beaches with no seeded ledge nearby.
 * Doubled so adjacent ledges' 5km reaches overlap and meet, closing every
 * gap under ~10km. Barrenjoey Head is the one ledge still isolated (its
 * nearest neighbour is 16.9km away, up the whole unseeded northern-beaches
 * stretch) — no reach short of a new anchor ledge closes that one.
 */
export const COASTLINE_FETCH_RADIUS_M = 5000;

/**
 * A coastline node further than this from every ledge is dropped: the app
 * only claims to describe the shoreline its ledges actually speak for, so
 * the overlay shouldn't bleed off down coast we have no data for. Kept equal
 * to the fetch radius so nothing fetched goes unassigned right at the edge.
 */
export const MAX_ASSIGN_DISTANCE_KM = 5;

/**
 * Consecutive nodes closer together than this are thinned out. OSM coastline
 * is mapped far finer than this overlay renders (sub-metre vertices in
 * places); keeping every vertex would bloat both the stored rows and the
 * JSON the browser downloads for no visible difference.
 */
export const MIN_VERTEX_SPACING_M = 30;

/**
 * A water area is a closed ring, and part of that ring is the artificial
 * edge drawn straight across a bay mouth or river entrance to close the
 * polygon — open water, not shoreline. Those closing edges show up as a
 * single huge hop between consecutive vertices (they were rendering as long
 * straight lines cutting across the harbour), whereas genuine mapped
 * shoreline steps along in much smaller increments. Breaking a run wherever
 * consecutive vertices are further apart than this drops them.
 */
export const MAX_VERTEX_GAP_M = 400;

/** A run of coastline that belongs to one ledge, in coastline order. */
export interface CoastlineRun {
  ledgeId: string;
  path: [number, number][];
  /**
   * Per-vertex compass bearing pointing out to sea, parallel to `path`. The
   * shore curves, so a single stored facing_bearing can't describe a whole
   * run: around a headland one stretch faces west while another faces east,
   * and the same tide pushes onto one and away from the other. This is what
   * lets the map colour each bit of shore by its own aspect.
   */
  bearings: number[];
}

/** Minimal shape of a ledge needed here — avoids depending on the full DB row type. */
export interface LedgeAnchor {
  id: string;
  lat: number;
  lon: number;
  /** Points out to sea; disambiguates which side of the shoreline is seaward. */
  facingBearing: number;
}

/**
 * OSM only runs `natural=coastline` around the open coast and the harbour
 * mouth; deeper inside Port Jackson the water is mapped as areas instead, so
 * a coastline-only query leaves every inner-harbour ledge (Bradleys Head,
 * Cremorne, Kirribilli, Blues Point, Balmoral, Chowder Bay) with no shore at
 * all — confirmed on the first live build. Water-area rings fill that gap;
 * their outline *is* the harbour's shoreline.
 */
const WATER_FILTERS = ['["natural"="water"]', '["waterway"="riverbank"]'];

/**
 * Water areas are pulled in by tag, which also catches ponds and reservoirs
 * that happen to sit within reach of a harbour ledge. Anything whose bounding
 * box is smaller than this across isn't harbour shoreline and would just
 * paint a coloured ring around a park pond.
 */
export const MIN_WATER_RING_EXTENT_M = 300;

/** One way's geometry, tagged by whether it came from `natural=coastline`. */
export interface CoastlineWay {
  path: [number, number][];
  /** False for water-area rings, which are size-filtered before use. */
  isCoastline: boolean;
}

/**
 * An Overpass QL query for shoreline within COASTLINE_FETCH_RADIUS_M of any
 * of these ledges — open-coast `natural=coastline` plus harbour water-area
 * rings. `out geom` inlines vertices (including relation members'), so one
 * round trip returns everything without a second node lookup.
 */
export function buildOverpassQuery(
  ledges: ReadonlyArray<LedgeAnchor>,
  radiusM: number = COASTLINE_FETCH_RADIUS_M,
): string {
  const clauses: string[] = [];
  for (const l of ledges) {
    const around = `(around:${radiusM},${l.lat},${l.lon})`;
    clauses.push(`way["natural"="coastline"]${around};`);
    for (const filter of WATER_FILTERS) {
      clauses.push(`way${filter}${around};`);
      clauses.push(`relation${filter}${around};`);
    }
  }
  return `[out:json][timeout:180];\n(\n  ${clauses.join("\n  ")}\n);\nout geom;`;
}

function readGeometry(geometry: unknown): [number, number][] {
  if (!Array.isArray(geometry)) return [];
  const path: [number, number][] = [];
  for (const point of geometry) {
    if (!point || typeof point !== "object") continue;
    const { lat, lon } = point as { lat?: unknown; lon?: unknown };
    if (typeof lat === "number" && typeof lon === "number") path.push([lat, lon]);
  }
  return path;
}

/**
 * Pulls each way's vertex list out of an Overpass `out geom` response,
 * including the member ways of water multipolygon relations (Port Jackson is
 * mapped that way). Ways with fewer than 2 vertices can't draw a line and
 * are dropped.
 */
export function parseOverpassCoastline(body: unknown): CoastlineWay[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { elements?: unknown }).elements)) {
    throw new Error(
      `Unexpected Overpass response shape: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }

  const ways: CoastlineWay[] = [];
  for (const element of (body as { elements: unknown[] }).elements) {
    if (!element || typeof element !== "object") continue;
    const el = element as { tags?: Record<string, unknown>; geometry?: unknown; members?: unknown };
    const isCoastline = el.tags?.natural === "coastline";

    const own = readGeometry(el.geometry);
    if (own.length >= 2) ways.push({ path: own, isCoastline });

    // Relations carry their geometry per member way.
    if (Array.isArray(el.members)) {
      for (const member of el.members) {
        if (!member || typeof member !== "object") continue;
        const path = readGeometry((member as { geometry?: unknown }).geometry);
        if (path.length >= 2) ways.push({ path, isCoastline });
      }
    }
  }
  return ways;
}

/** Rough bounding-box diagonal of a path, in metres. */
function extentM(path: ReadonlyArray<[number, number]>): number {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of path) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return distanceKm(minLat, minLon, maxLat, maxLon) * 1000;
}

/**
 * Drops water rings too small to be harbour shoreline (park ponds and the
 * like). Coastline ways are kept regardless — they're the open coast by
 * definition, however short a given fragment happens to be.
 */
export function filterShorelineWays(
  ways: ReadonlyArray<CoastlineWay>,
  minWaterExtentM: number = MIN_WATER_RING_EXTENT_M,
): [number, number][][] {
  return ways
    .filter((w) => w.isCoastline || extentM(w.path) >= minWaterExtentM)
    .map((w) => w.path);
}

/** Compass bearing (0-360, clockwise from north) from one coordinate to another. */
function bearingBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Smallest angle between two bearings, in [0, 180]. */
function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * The outward-facing bearing at every vertex of a run: the shoreline's local
 * tangent turned 90deg, on whichever side points out to sea. The tangent
 * alone is ambiguous (either normal is perpendicular to the shore), so the
 * ledge's own facing_bearing — defined as pointing out to sea — picks the
 * seaward side for the first vertex.
 *
 * Every vertex after that follows the previous one rather than the reference.
 * The vertices are in shoreline order, so the seaward side stays on the same
 * hand the whole way along; picking each vertex independently off the
 * reference instead would flip to the landward normal wherever a headland
 * curves more than 90deg away from it — which is precisely the tip of the
 * headland, where the aspect matters most.
 */
export function computeVertexBearings(
  path: ReadonlyArray<[number, number]>,
  seawardReferenceDeg: number,
): number[] {
  const bearings: number[] = [];

  for (let i = 0; i < path.length; i++) {
    // Use the neighbours either side where possible: a chord across the
    // vertex follows the shore's local run better than one short segment,
    // which can jitter on finely-mapped coast.
    const before = path[Math.max(0, i - 1)];
    const after = path[Math.min(path.length - 1, i + 1)];
    const tangent = bearingBetween(before[0], before[1], after[0], after[1]);

    const left = (tangent + 270) % 360;
    const right = (tangent + 90) % 360;
    const against = i === 0 ? seawardReferenceDeg : bearings[i - 1];
    bearings.push(angleDiff(left, against) <= angleDiff(right, against) ? left : right);
  }

  return bearings;
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
  maxVertexGapM: number = MAX_VERTEX_GAP_M,
): CoastlineRun[] {
  const runs: CoastlineRun[] = [];

  const byId = new Map(ledges.map((l) => [l.id, l]));

  for (const way of ways) {
    let currentLedgeId: string | null = null;
    let currentPath: [number, number][] = [];
    let previous: [number, number] | null = null;

    const flush = () => {
      // A single point can't draw a line.
      if (currentLedgeId && currentPath.length >= 2) {
        const path = thinPath(currentPath, minVertexSpacingM);
        const owner = byId.get(currentLedgeId);
        runs.push({
          ledgeId: currentLedgeId,
          path,
          bearings: computeVertexBearings(path, owner ? owner.facingBearing : 0),
        });
      }
      currentLedgeId = null;
      currentPath = [];
    };

    for (const [lat, lon] of way) {
      // A jump this large isn't shoreline — it's a polygon's closing edge
      // across open water. Never draw across it.
      const jumped =
        previous !== null && distanceKm(previous[0], previous[1], lat, lon) * 1000 > maxVertexGapM;
      previous = [lat, lon];

      const owner = nearestLedge(lat, lon, ledges, maxDistanceKm);
      if (!owner) {
        flush();
        continue;
      }
      if (jumped) {
        flush();
        currentLedgeId = owner.id;
      } else if (owner.id !== currentLedgeId) {
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
        const ways = filterShorelineWays(parseOverpassCoastline(await response.json()));
        if (ways.length === 0) {
          errors.push(`${endpoint} [${attempt.contentType}] -> 0 shoreline ways`);
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
