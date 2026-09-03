// Pure helpers for turning a handful of point wind readings (one per ledge)
// into a smooth interpolated field — inverse-distance weighting, the same
// technique a real weather-model renderer (e.g. Windy) applies to its own
// grid, just applied to our much sparser set of real sample points instead
// of a dense GRIB grid.
import { distanceKm } from "./geo";

export interface WindSample {
  lat: number;
  lon: number;
  /** Eastward component (m/s) of where the wind is blowing TO. */
  u: number;
  /** Northward component (m/s) of where the wind is blowing TO. */
  v: number;
}

export interface WindFieldPoint {
  u: number;
  v: number;
  /** Magnitude of (u, v) — the interpolated wind speed at this point. */
  speed: number;
}

const IDW_POWER = 2;
// Keeps the weight finite exactly at a sample's own coordinate, without
// meaningfully affecting the blend anywhere more than ~250m away.
const IDW_EPSILON_KM = 0.25;

/**
 * Decomposes a meteorological "blowing FROM" bearing + speed into eastward/
 * northward components of where the wind is blowing TO — the form vector
 * interpolation (and averaging) needs, since averaging raw bearings directly
 * would be wrong across the 0/360 wrap.
 */
export function windToComponents(speedMs: number, dirFromDeg: number): { u: number; v: number } {
  const rad = (dirFromDeg * Math.PI) / 180;
  return { u: -speedMs * Math.sin(rad), v: -speedMs * Math.cos(rad) };
}

/** Bearing (degrees from north) that (u, v) points toward, for drawing a direction indicator. */
export function componentsToBearing(u: number, v: number): number {
  return ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
}

/**
 * Inverse-distance-weighted blend of every sample at (lat, lon) — every
 * sample contributes, more heavily the closer it is, so the field is smooth
 * and gap-free everywhere rather than only defined near a ledge. Returns
 * null only when there are no samples at all.
 */
export function interpolateWindField(
  samples: ReadonlyArray<WindSample>,
  lat: number,
  lon: number,
): WindFieldPoint | null {
  if (samples.length === 0) return null;

  let sumWeight = 0;
  let sumU = 0;
  let sumV = 0;
  for (const sample of samples) {
    const d = distanceKm(lat, lon, sample.lat, sample.lon);
    const weight = 1 / Math.pow(d + IDW_EPSILON_KM, IDW_POWER);
    sumWeight += weight;
    sumU += weight * sample.u;
    sumV += weight * sample.v;
  }
  const u = sumU / sumWeight;
  const v = sumV / sumWeight;
  return { u, v, speed: Math.hypot(u, v) };
}
