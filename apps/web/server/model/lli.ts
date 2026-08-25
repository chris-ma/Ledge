import {
  CURRENT_LOAD_REF_MAX,
  CURRENT_WEIGHT,
  SEAWATER_DENSITY_KG_M3,
  TIDE_RATE_BOOST_K,
  TIDE_RATE_MAX_CM_PER_HR,
  TIDE_SIGMA_FRACTION,
  TIDE_TARGET_FRACTION,
  WAVE_LOAD_REF_MAX,
  WAVE_WEIGHT,
} from "./constants";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smallest-angle difference between two compass bearings, in [0, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** A ledge facing >90deg away from the source gets zero load, not a
 * physically meaningless negative value. */
export function directionalClamp(angleDiffDegrees: number): number {
  return Math.max(0, Math.cos((angleDiffDegrees * Math.PI) / 180));
}

/** wave_load = Hs^2 * Tp * cos(theta), theta = swell dir vs facing_bearing. */
export function computeWaveLoad(
  hsM: number,
  tpS: number,
  swellDirDeg: number,
  facingBearingDeg: number,
): number {
  const cosTheta = directionalClamp(angleDiffDeg(swellDirDeg, facingBearingDeg));
  return hsM ** 2 * tpS * cosTheta;
}

/** current_load = 0.5 * rho * v^2 * cos(phi), phi = current dir vs facing_bearing. */
export function computeCurrentLoad(
  currentSpeedMs: number,
  currentDirDeg: number,
  facingBearingDeg: number,
): number {
  const cosPhi = directionalClamp(angleDiffDeg(currentDirDeg, facingBearingDeg));
  return 0.5 * SEAWATER_DENSITY_KG_M3 * currentSpeedMs ** 2 * cosPhi;
}

/**
 * First-pass heuristic for "tide height + rate-of-change scale how much
 * energy reaches the productive depth band" (spec leaves the exact formula
 * open). A bell curve peaking at a platform-relative target tide height,
 * boosted (never inverted) by a fast rate of change.
 */
export function computeTideModulationFactor(
  tideHeightCm: number,
  tideRateCmPerHr: number,
  platformHeightM: number,
): number {
  const targetCm = TIDE_TARGET_FRACTION * platformHeightM * 100;
  const sigmaCm = Math.max(1, TIDE_SIGMA_FRACTION * platformHeightM * 100);
  const depthFactor = Math.exp(-((tideHeightCm - targetCm) ** 2) / (2 * sigmaCm ** 2));
  const rateFactor =
    1 +
    TIDE_RATE_BOOST_K * clamp(Math.abs(tideRateCmPerHr) / TIDE_RATE_MAX_CM_PER_HR, 0, 1);
  return depthFactor * rateFactor;
}

/** LLI = normalize(wave_load, current_load) * tide_modulation_factor, 0-100. */
export function computeLli(
  waveLoad: number,
  currentLoad: number,
  tideModulationFactor: number,
): number {
  const waveNorm = clamp(waveLoad / WAVE_LOAD_REF_MAX, 0, 1);
  const currentNorm = clamp(currentLoad / CURRENT_LOAD_REF_MAX, 0, 1);
  const combined = clamp(WAVE_WEIGHT * waveNorm + CURRENT_WEIGHT * currentNorm, 0, 1);
  return Math.round(clamp(combined * tideModulationFactor, 0, 1) * 100);
}

export interface LliInputs {
  hsM: number | null;
  tpS: number | null;
  swellDirDeg: number | null;
  currentSpeedMs: number | null;
  currentDirDeg: number | null;
  tideHeightCm: number | null;
  tideRateCmPerHr: number | null;
  facingBearingDeg: number;
  platformHeightM: number;
}

export interface LliResult {
  waveLoad: number;
  currentLoad: number;
  tideModulationFactor: number;
  lli: number;
}

/** Returns null if any required input for this hour is missing — a missing
 * reading should render as "no data" on the heat map, never as a fabricated 0. */
export function computeLliForHour(inputs: LliInputs): LliResult | null {
  const {
    hsM,
    tpS,
    swellDirDeg,
    currentSpeedMs,
    currentDirDeg,
    tideHeightCm,
    tideRateCmPerHr,
    facingBearingDeg,
    platformHeightM,
  } = inputs;

  if (
    hsM === null ||
    tpS === null ||
    swellDirDeg === null ||
    currentSpeedMs === null ||
    currentDirDeg === null ||
    tideHeightCm === null ||
    tideRateCmPerHr === null
  ) {
    return null;
  }

  const waveLoad = computeWaveLoad(hsM, tpS, swellDirDeg, facingBearingDeg);
  const currentLoad = computeCurrentLoad(currentSpeedMs, currentDirDeg, facingBearingDeg);
  const tideModulationFactor = computeTideModulationFactor(
    tideHeightCm,
    tideRateCmPerHr,
    platformHeightM,
  );
  const lli = computeLli(waveLoad, currentLoad, tideModulationFactor);

  return { waveLoad, currentLoad, tideModulationFactor, lli };
}
