import {
  FISHING_FAIR_THRESHOLD,
  FISHING_GOOD_THRESHOLD,
  FISHING_GREAT_THRESHOLD,
  FISHING_SWELL_WEIGHT,
  FISHING_TIDE_WEIGHT,
  FISHING_WAVE_LOAD_REF_MAX,
  TIDE_CURRENT_PRESSURE_REF_MAX_MS,
} from "./constants.js";
import { angleDiffDeg, clamp, computeWaveLoad, directionalClamp } from "./lli.js";

export const fishingTiers = ["poor", "fair", "good", "great"] as const;
export type FishingTier = (typeof fishingTiers)[number];

/**
 * Speed of the tidal current vector (u = eastward, v = northward, both
 * cm/s from ODB), converted to m/s.
 */
export function computeTideCurrentSpeedMs(currentUCmS: number, currentVCmS: number): number {
  return Math.sqrt(currentUCmS ** 2 + currentVCmS ** 2) / 100;
}

/**
 * Compass bearing the tidal current is flowing FROM, derived from its u/v
 * components. u/v give the direction the water moves TOWARD (the standard
 * oceanographic current convention) — this flips it 180deg so it uses the
 * same "source bearing" convention as swellDirDeg elsewhere in the model,
 * letting the ledge's facing_bearing (which already points out to sea) line
 * up the same way for both: an angle diff of 0 means the flow/swell is
 * arriving square onto the ledge face.
 */
export function computeTideCurrentDirFromDeg(currentUCmS: number, currentVCmS: number): number {
  const towardDeg = (Math.atan2(currentUCmS, currentVCmS) * 180) / Math.PI;
  const fromDeg = towardDeg + 180;
  return ((fromDeg % 360) + 360) % 360;
}

/**
 * Tide term of the Fishing Pressure Index: tidal current speed, scaled down
 * the further its "from" bearing is from the ledge's facing_bearing — a
 * flood tide pushing straight onto the ledge face scores highest, an ebb (or
 * a current running parallel to the face) scores low, without hard-coding
 * any particular compass direction as "the" flood direction.
 */
export function computeTidePressure(
  tideCurrentSpeedMs: number,
  tideCurrentDirFromDeg: number,
  facingBearingDeg: number,
): number {
  const cosPhi = directionalClamp(angleDiffDeg(tideCurrentDirFromDeg, facingBearingDeg));
  return tideCurrentSpeedMs * cosPhi;
}

/** Fishing Pressure Index = weighted blend of the swell and tide terms, 0-100. */
export function computeFishingPressureIndex(swellPressure: number, tidePressure: number): number {
  const swellNorm = clamp(swellPressure / FISHING_WAVE_LOAD_REF_MAX, 0, 1);
  const tideNorm = clamp(tidePressure / TIDE_CURRENT_PRESSURE_REF_MAX_MS, 0, 1);
  const combined = clamp(FISHING_SWELL_WEIGHT * swellNorm + FISHING_TIDE_WEIGHT * tideNorm, 0, 1);
  return Math.round(combined * 100);
}

export function fishingPressureToTier(fishingPressure: number): FishingTier {
  if (fishingPressure >= FISHING_GREAT_THRESHOLD) return "great";
  if (fishingPressure >= FISHING_GOOD_THRESHOLD) return "good";
  if (fishingPressure >= FISHING_FAIR_THRESHOLD) return "fair";
  return "poor";
}

export interface FishingPressureInputs {
  hsM: number | null;
  tpS: number | null;
  swellDirDeg: number | null;
  tideCurrentUCmS: number | null;
  tideCurrentVCmS: number | null;
  facingBearingDeg: number;
}

export interface FishingPressureResult {
  tideCurrentSpeedMs: number;
  tideCurrentDirDeg: number;
  fishingPressure: number;
  fishingTier: FishingTier;
}

/** Returns null if any required input for this hour is missing — same "no
 * data, never a fabricated value" policy as computeLliForHour. */
export function computeFishingPressureForHour(
  inputs: FishingPressureInputs,
): FishingPressureResult | null {
  const { hsM, tpS, swellDirDeg, tideCurrentUCmS, tideCurrentVCmS, facingBearingDeg } = inputs;

  if (
    hsM === null ||
    tpS === null ||
    swellDirDeg === null ||
    tideCurrentUCmS === null ||
    tideCurrentVCmS === null
  ) {
    return null;
  }

  const swellPressure = computeWaveLoad(hsM, tpS, swellDirDeg, facingBearingDeg);
  const tideCurrentSpeedMs = computeTideCurrentSpeedMs(tideCurrentUCmS, tideCurrentVCmS);
  const tideCurrentDirDeg = computeTideCurrentDirFromDeg(tideCurrentUCmS, tideCurrentVCmS);
  const tidePressure = computeTidePressure(tideCurrentSpeedMs, tideCurrentDirDeg, facingBearingDeg);
  const fishingPressure = computeFishingPressureIndex(swellPressure, tidePressure);

  return {
    tideCurrentSpeedMs,
    tideCurrentDirDeg,
    fishingPressure,
    fishingTier: fishingPressureToTier(fishingPressure),
  };
}
