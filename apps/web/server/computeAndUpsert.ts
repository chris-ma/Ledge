import { eq, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { ledgeConditions, ledges, type Ledge } from "./db/schema.js";
import { destinationPoint } from "./geo.js";
import { FORECAST_DAYS, TREND_WINDOW_HOURS } from "./model/constants.js";
import { computeDangerSeries } from "./model/danger.js";
import { computeFishingPressureForHour } from "./model/fishingPressure.js";
import { computeLliForHour } from "./model/lli.js";
import { mergeHourlySeries } from "./merge.js";
import { fetchSwellAndCurrent } from "./sources/openMeteo.js";
import { fetchTide, type TideHour } from "./sources/odbTide.js";

const UPSERT_CHUNK_SIZE = 500;
const ONE_HOUR_MS = 60 * 60 * 1000;

// ODB's underlying TPXO model resolves ~1/30deg (~3-4km) even at its
// highest-resolution "atlas" tier, and near-shore cells commonly land-mask
// out right at the coastline. Confirmed against the live API in both
// directions: 6 of 12 Sydney ledges failed at their exact coordinate but
// succeeded once nudged this far offshore along facing_bearing (which
// already encodes "which way is out to sea") — while one ledge at the tip
// of a peninsula (Barrenjoey Head) was the opposite: fine at its exact
// coordinate, but the offshore nudge landed on a different bad cell nearby.
// So try the exact coordinate first (semantically correct), and only fall
// back to the offset if that fails — never force the nudge unconditionally.
const TIDE_QUERY_OFFSET_KM = 8;

interface TideFetchResult {
  hours: TideHour[];
  usedLat: number;
  usedLon: number;
}

/**
 * Tries the ledge's exact coordinate first, falls back to a point nudged
 * `TIDE_QUERY_OFFSET_KM` out to sea if that fails — see the constant's
 * comment for why neither alone covers every ledge. Reports back which
 * coordinate actually succeeded so the caller can persist it as the ledge's
 * "weather station" point.
 */
async function fetchTideWithFallback(
  ledge: Ledge,
  startDate: string,
  endDate: string,
): Promise<TideFetchResult> {
  try {
    const hours = await fetchTide(ledge.lat, ledge.lon, startDate, endDate);
    return { hours, usedLat: ledge.lat, usedLon: ledge.lon };
  } catch (exactErr) {
    const offshore = destinationPoint(ledge.lat, ledge.lon, ledge.facingBearing, TIDE_QUERY_OFFSET_KM);
    try {
      const hours = await fetchTide(offshore.lat, offshore.lon, startDate, endDate);
      return { hours, usedLat: offshore.lat, usedLon: offshore.lon };
    } catch (offshoreErr) {
      console.error(
        `Tide fetch failed for "${ledge.name}" at both its exact coordinate and the offshore fallback:`,
        exactErr,
        offshoreErr,
      );
      throw offshoreErr;
    }
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ComputeAndUpsertResult {
  ledgeId: string;
  ledgeName: string;
  hoursComputed: number;
  rowsUpserted: number;
}

/**
 * The core daily job for one ledge: fetch swell+current and tide, merge,
 * compute LLI + danger for every hour, upsert. Throws on a fetch/shape
 * failure for this ledge — callers processing multiple ledges should use
 * Promise.allSettled so one ledge's upstream failure doesn't take down the
 * whole batch.
 */
export async function computeAndUpsertForLedge(ledge: Ledge): Promise<ComputeAndUpsertResult> {
  const now = new Date();
  // One lookback day so the first real forecast hour still has a prior tide
  // sample to diff for rate-of-change.
  const tideStart = toDateOnly(new Date(now.getTime() - 24 * ONE_HOUR_MS));
  const tideEnd = toDateOnly(new Date(now.getTime() + (FORECAST_DAYS + 1) * 24 * ONE_HOUR_MS));

  // allSettled rather than all: a tide-source failure for this ledge
  // shouldn't discard swell/current data that DID succeed. mergeHourlySeries
  // already treats a missing source as nulls for those fields per hour, not
  // a dropped row — an empty tide series degrades every hour's tide fields
  // to null (LLI then also comes out null, since it needs tide), but danger
  // tier/R2 still computes from Hs/Tp alone, which matters more to keep than
  // to lose.
  const [swellCurrentResult, tideResult] = await Promise.allSettled([
    fetchSwellAndCurrent(ledge.lat, ledge.lon, FORECAST_DAYS),
    fetchTideWithFallback(ledge, tideStart, tideEnd),
  ]);

  if (swellCurrentResult.status === "rejected") {
    throw swellCurrentResult.reason;
  }
  const swellCurrent = swellCurrentResult.value;

  if (tideResult.status === "rejected") {
    console.error(
      `Tide fetch failed for ledge "${ledge.name}" — proceeding with null tide fields for this run:`,
      tideResult.reason,
    );
  }
  const tide = tideResult.status === "fulfilled" ? tideResult.value.hours : [];

  if (tideResult.status === "fulfilled") {
    const { usedLat, usedLon } = tideResult.value;
    await db
      .update(ledges)
      .set({ weatherStationLat: usedLat, weatherStationLon: usedLon, updatedAt: new Date() })
      .where(eq(ledges.id, ledge.id));
  }

  const merged = mergeHourlySeries(swellCurrent, tide);

  const dangerResults = computeDangerSeries(
    {
      platformHeightM: ledge.platformHeightM,
      safetyMargin: ledge.safetyMargin,
      slopeEstimate: ledge.slopeEstimate,
      sheltered: ledge.sheltered,
    },
    merged,
    TREND_WINDOW_HOURS,
  );

  const rows = merged.map((hour, i) => {
    const lliResult = computeLliForHour({
      hsM: hour.hsM,
      tpS: hour.tpS,
      swellDirDeg: hour.swellDirDeg,
      currentSpeedMs: hour.currentSpeedMs,
      currentDirDeg: hour.currentDirDeg,
      tideHeightCm: hour.tideHeightCm,
      tideRateCmPerHr: hour.tideRateCmPerHr,
      facingBearingDeg: ledge.facingBearing,
      platformHeightM: ledge.platformHeightM,
    });
    const danger = dangerResults[i];
    const fishingResult = computeFishingPressureForHour({
      hsM: hour.hsM,
      tpS: hour.tpS,
      swellDirDeg: hour.swellDirDeg,
      tideCurrentUCmS: hour.tideCurrentUCmS,
      tideCurrentVCmS: hour.tideCurrentVCmS,
      facingBearingDeg: ledge.facingBearing,
      sheltered: ledge.sheltered,
    });

    return {
      ledgeId: ledge.id,
      ts: new Date(hour.ts),
      hsM: hour.hsM,
      tpS: hour.tpS,
      swellDirDeg: hour.swellDirDeg,
      currentSpeedMs: hour.currentSpeedMs,
      currentDirDeg: hour.currentDirDeg,
      tideHeightCm: hour.tideHeightCm,
      tideRateCmPerHr: hour.tideRateCmPerHr,
      waveLoad: lliResult?.waveLoad ?? null,
      currentLoad: lliResult?.currentLoad ?? null,
      tideModulationFactor: lliResult?.tideModulationFactor ?? null,
      lli: lliResult?.lli ?? null,
      r2EstimateM: danger.r2EstimateM,
      dangerFlag: danger.dangerFlag,
      dangerTier: danger.dangerTier,
      tideCurrentSpeedMs: fishingResult?.tideCurrentSpeedMs ?? null,
      tideCurrentDirDeg: fishingResult?.tideCurrentDirDeg ?? null,
      fishingPressure: fishingResult?.fishingPressure ?? null,
      fishingTier: fishingResult?.fishingTier ?? null,
    };
  });

  await upsertConditions(rows);

  return {
    ledgeId: ledge.id,
    ledgeName: ledge.name,
    hoursComputed: rows.length,
    rowsUpserted: rows.length,
  };
}

async function upsertConditions(rows: (typeof ledgeConditions.$inferInsert)[]): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db
      .insert(ledgeConditions)
      .values(chunk)
      .onConflictDoUpdate({
        target: [ledgeConditions.ledgeId, ledgeConditions.ts],
        set: {
          sourceRunAt: sql`excluded.source_run_at`,
          hsM: sql`excluded.hs_m`,
          tpS: sql`excluded.tp_s`,
          swellDirDeg: sql`excluded.swell_dir_deg`,
          currentSpeedMs: sql`excluded.current_speed_ms`,
          currentDirDeg: sql`excluded.current_dir_deg`,
          tideHeightCm: sql`excluded.tide_height_cm`,
          tideRateCmPerHr: sql`excluded.tide_rate_cm_per_hr`,
          waveLoad: sql`excluded.wave_load`,
          currentLoad: sql`excluded.current_load`,
          tideModulationFactor: sql`excluded.tide_modulation_factor`,
          lli: sql`excluded.lli`,
          r2EstimateM: sql`excluded.r2_estimate_m`,
          dangerFlag: sql`excluded.danger_flag`,
          dangerTier: sql`excluded.danger_tier`,
          tideCurrentSpeedMs: sql`excluded.tide_current_speed_ms`,
          tideCurrentDirDeg: sql`excluded.tide_current_dir_deg`,
          fishingPressure: sql`excluded.fishing_pressure`,
          fishingTier: sql`excluded.fishing_tier`,
        },
      });
  }
}
