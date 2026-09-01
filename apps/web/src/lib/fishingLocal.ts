// Re-scores an hour's Fishing Condition for a *local* shoreline aspect.
//
// The backend stores one fishingPressure per ledge per hour, computed
// against that ledge's single facing_bearing. But a ledge is a stretch of
// coast that curves: around a headland one part faces west and another
// faces east, and the same tide pushes onto one while running off the
// other. Colouring the whole stretch with one number throws that away.
//
// Everything that varies hour to hour (tide current vector, swell height /
// period / direction) is already on the wire per ledge, and the only thing
// that varies *along* the shore is the facing bearing — so the gradient can
// be recomputed in the browser per vertex from data already fetched, with
// no extra requests and no per-vertex rows in the database.
//
// This mirrors server/model/fishingPressure.ts. It's duplicated rather than
// imported because server/ code is never pulled into src/ (see the apps/web
// CLAUDE instructions), the same arrangement as geo.ts. The constants below
// must stay in step with server/model/constants.ts.

import type { LedgeCondition } from "./types";

// Deliberately lower than the LLI (safety) model's own wave-load reference
// would be — that one's pinned to a rare, genuinely extreme swell, which
// would leave this "how good is the fishing" scale's orange/red end
// unreachable under any realistic Sydney swell. See the matching comment in
// server/model/constants.ts for the reasoning and the reference figure.
const FISHING_WAVE_LOAD_REF_MAX = 60;
const TIDE_CURRENT_PRESSURE_REF_MAX_MS = 0.03;
const SWELL_WEIGHT = 0.5;
const TIDE_WEIGHT = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smallest-angle difference between two compass bearings, in [0, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Shore facing >90deg away from the source takes zero load, not a negative one. */
export function directionalClamp(angleDiffDegrees: number): number {
  return Math.max(0, Math.cos((angleDiffDegrees * Math.PI) / 180));
}

/**
 * Fishing Condition (0-100) for one hour at one facing bearing, or null when
 * the hour has no usable reading — never a fabricated zero, matching the
 * backend's policy.
 *
 * Sheltered harbour ledges score on tide alone: ocean swell doesn't reach
 * inside the harbour, so folding in a near-zero swell term would only dilute
 * the signal.
 */
export function localFishingCondition(
  condition: LedgeCondition,
  facingBearingDeg: number,
  sheltered: boolean,
): number | null {
  const { tideCurrentSpeedMs, tideCurrentDirDeg, hsM, tpS, swellDirDeg } = condition;

  if (tideCurrentSpeedMs === null || tideCurrentDirDeg === null) return null;

  // Tide current is stored as the bearing it flows FROM, so a current
  // running straight onto this bit of shore lines up with its facing
  // bearing and scores highest — an ebb running off it scores low.
  const tidePressure =
    tideCurrentSpeedMs * directionalClamp(angleDiffDeg(tideCurrentDirDeg, facingBearingDeg));
  const tideNorm = clamp(tidePressure / TIDE_CURRENT_PRESSURE_REF_MAX_MS, 0, 1);

  if (sheltered) return Math.round(tideNorm * 100);

  if (hsM === null || tpS === null || swellDirDeg === null) return null;

  // Swell hitting square on counts fully; swell running past the aspect
  // counts for progressively less, and nothing from behind it.
  const waveLoad = hsM ** 2 * tpS * directionalClamp(angleDiffDeg(swellDirDeg, facingBearingDeg));
  const swellNorm = clamp(waveLoad / FISHING_WAVE_LOAD_REF_MAX, 0, 1);

  return Math.round(clamp(SWELL_WEIGHT * swellNorm + TIDE_WEIGHT * tideNorm, 0, 1) * 100);
}
