import type { LedgeCondition } from "./types";

export interface TidePoint {
  ts: string;
  /** Averaged across every ledge with data at this hour — null if none had any. */
  heightCm: number | null;
  rateCmPerHr: number | null;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * One "regional tide" reading per hour, averaged across every ledge that has
 * data for that hour. Nearby Sydney ocean/harbour tide timing differs by
 * minutes, not hours, so an average is a reasonable single-glance reading
 * for the map's tide strip rather than picking one arbitrary ledge.
 */
export function computeRegionalTideSeries(conditions: LedgeCondition[], hours: string[]): TidePoint[] {
  const heightsByHour = new Map<string, number[]>();
  const ratesByHour = new Map<string, number[]>();

  for (const c of conditions) {
    if (c.tideHeightCm !== null) {
      const arr = heightsByHour.get(c.ts);
      if (arr) arr.push(c.tideHeightCm);
      else heightsByHour.set(c.ts, [c.tideHeightCm]);
    }
    if (c.tideRateCmPerHr !== null) {
      const arr = ratesByHour.get(c.ts);
      if (arr) arr.push(c.tideRateCmPerHr);
      else ratesByHour.set(c.ts, [c.tideRateCmPerHr]);
    }
  }

  return hours.map((ts) => {
    const heights = heightsByHour.get(ts);
    const rates = ratesByHour.get(ts);
    return {
      ts,
      heightCm: heights ? average(heights) : null,
      rateCmPerHr: rates ? average(rates) : null,
    };
  });
}

export type TideTrend = "rising" | "falling" | "steady";

/** Below this magnitude the tide reads as "steady" rather than a fabricated direction. */
const STEADY_THRESHOLD_CM_PER_HR = 1;

export function tideTrend(rateCmPerHr: number | null): TideTrend | null {
  if (rateCmPerHr === null) return null;
  if (Math.abs(rateCmPerHr) < STEADY_THRESHOLD_CM_PER_HR) return "steady";
  return rateCmPerHr > 0 ? "rising" : "falling";
}
