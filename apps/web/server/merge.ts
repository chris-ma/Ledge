import type { SwellCurrentHour } from "./sources/openMeteo.js";
import type { TideHour } from "./sources/odbTide.js";

export interface MergedHour {
  /** Normalized: ISO 8601, UTC, top of hour, zero seconds/ms. */
  ts: string;
  hsM: number | null;
  tpS: number | null;
  swellDirDeg: number | null;
  currentSpeedMs: number | null;
  currentDirDeg: number | null;
  tideHeightCm: number | null;
  tideRateCmPerHr: number | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Rounds a timestamp down to the top of the hour and returns a canonical
 * ISO string. Used as the join key between the two upstream series, since
 * their raw timestamp formats aren't guaranteed to match string-for-string
 * (Open-Meteo and ODB are independent providers).
 */
export function normalizeHourKey(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Could not parse timestamp "${ts}" from an upstream API response.`);
  }
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

/**
 * Outer-joins the swell+current series against the tide series on the
 * normalized hour, and derives each hour's tide rate-of-change from the
 * previous hour's tide sample — which may come from a lookback day fetched
 * specifically so the first real forecast hour still has a prior sample to
 * diff against. A missing source for a given hour becomes nulls for those
 * fields, never a dropped row: a partial upstream outage shouldn't blank
 * out an entire hour's worth of otherwise-good data.
 */
export function mergeHourlySeries(
  swellCurrent: SwellCurrentHour[],
  tide: TideHour[],
): MergedHour[] {
  const tideByHour = new Map<string, TideHour>();
  for (const hour of tide) {
    tideByHour.set(normalizeHourKey(hour.ts), hour);
  }

  return swellCurrent.map((sc) => {
    const hourKey = normalizeHourKey(sc.ts);
    const tideHour = tideByHour.get(hourKey);

    const previousHourKey = new Date(new Date(hourKey).getTime() - ONE_HOUR_MS).toISOString();
    const previousTide = tideByHour.get(previousHourKey);

    const tideRateCmPerHr =
      tideHour?.tideHeightCm != null && previousTide?.tideHeightCm != null
        ? tideHour.tideHeightCm - previousTide.tideHeightCm
        : null;

    return {
      ts: hourKey,
      hsM: sc.hsM,
      tpS: sc.tpS,
      swellDirDeg: sc.swellDirDeg,
      currentSpeedMs: sc.currentSpeedMs,
      currentDirDeg: sc.currentDirDeg,
      tideHeightCm: tideHour?.tideHeightCm ?? null,
      tideRateCmPerHr,
    };
  });
}
