import type { DangerTier } from "../db/schema.js";
import {
  CAUTION_THRESHOLD_FRACTION,
  DEFAULT_SLOPE_TANB,
  GRAVITY_M_S2,
  TP_SHARP_RISE_S,
} from "./constants.js";

export function computeDeepWaterWavelength(tpS: number): number {
  return (GRAVITY_M_S2 * tpS ** 2) / (2 * Math.PI);
}

/**
 * Stockdon et al. (2006) R2 (2%-exceedance wave runup elevation, metres).
 * Developed/validated on natural (mostly sandy) beaches — treated here as a
 * heuristic proxy for rock platforms, not a certified safety figure.
 */
export function computeStockdonR2(hsM: number, tpS: number, tanBeta: number): number {
  const l0 = computeDeepWaterWavelength(tpS);
  const setup = 0.35 * tanBeta * Math.sqrt(hsM * l0);
  const swash = Math.sqrt(hsM * l0 * (0.563 * tanBeta ** 2 + 0.004));
  return 1.1 * (setup + swash / 2);
}

/** `values[index] - values[index - lookback]`, or null if either point is
 * missing/out of range. */
export function trailingDelta(
  values: ReadonlyArray<number | null>,
  index: number,
  lookback: number,
): number | null {
  const current = values[index];
  const prior = values[index - lookback];
  if (current === null || current === undefined || prior === null || prior === undefined) {
    return null;
  }
  return current - prior;
}

export interface DangerHourInput {
  hsM: number | null;
  tpS: number | null;
  tideRateCmPerHr: number | null;
}

export interface DangerHourResult {
  r2EstimateM: number | null;
  dangerTier: DangerTier | null;
  dangerFlag: boolean | null;
}

export interface DangerLedgeInputs {
  platformHeightM: number;
  safetyMargin: number;
  slopeEstimate: number | null;
  /** Ocean swell doesn't reach this ledge — see the same flag's use in fishingPressure.ts. */
  sheltered: boolean;
}

/**
 * Danger tier/flag for every hour in `hours`, using a trailing window to
 * detect a sharp period rise or a rising-tide+rising-period combination —
 * the spec's own tier definitions (section 3) fold these trend signals in
 * alongside the raw R2-vs-threshold comparison, so this needs the whole
 * chronological series rather than one hour in isolation. `danger_flag`
 * mirrors `dangerTier === 'dangerous'`.
 *
 * Wave runup is entirely an ocean-swell phenomenon: the Hs/Tp fed in here
 * come from an open-water model queried at the ledge's own coordinate, which
 * for a sheltered harbour ledge returns whatever the nearest open-water grid
 * cell is doing — swell that never actually reaches in past the harbour
 * mouth. Stockdon R2 computed from that number is fiction, not a smaller
 * real danger, so a sheltered ledge gets null (no reading) rather than a
 * runup-driven caution/dangerous flag it can't physically earn.
 */
export function computeDangerSeries(
  ledge: DangerLedgeInputs,
  hours: ReadonlyArray<DangerHourInput>,
  trendWindowHours: number,
): DangerHourResult[] {
  if (ledge.sheltered) {
    return hours.map(() => ({ r2EstimateM: null, dangerTier: null, dangerFlag: null }));
  }

  const tanBeta = ledge.slopeEstimate ?? DEFAULT_SLOPE_TANB;
  const threshold = ledge.platformHeightM * ledge.safetyMargin;
  const cautionThreshold = threshold * CAUTION_THRESHOLD_FRACTION;
  const tpSeries = hours.map((h) => h.tpS);

  return hours.map((hour, i) => {
    if (hour.hsM === null || hour.tpS === null) {
      return { r2EstimateM: null, dangerTier: null, dangerFlag: null };
    }

    const r2EstimateM = computeStockdonR2(hour.hsM, hour.tpS, tanBeta);
    const tpDelta = trailingDelta(tpSeries, i, trendWindowHours);
    const tpSharpRise = tpDelta !== null && tpDelta >= TP_SHARP_RISE_S;
    const periodRising = tpDelta !== null && tpDelta > 0;
    const tideRising = (hour.tideRateCmPerHr ?? 0) > 0;

    let dangerTier: DangerTier;
    if (r2EstimateM >= threshold || tpSharpRise) {
      dangerTier = "dangerous";
    } else if (r2EstimateM >= cautionThreshold || (tideRising && periodRising)) {
      dangerTier = "caution";
    } else {
      dangerTier = "normal";
    }

    return { r2EstimateM, dangerTier, dangerFlag: dangerTier === "dangerous" };
  });
}
