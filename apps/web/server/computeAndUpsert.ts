import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { ledgeConditions, type Ledge } from "./db/schema.js";
import { FORECAST_DAYS, TREND_WINDOW_HOURS } from "./model/constants.js";
import { computeDangerSeries } from "./model/danger.js";
import { computeLliForHour } from "./model/lli.js";
import { mergeHourlySeries } from "./merge.js";
import { fetchSwellAndCurrent } from "./sources/openMeteo.js";
import { fetchTide } from "./sources/odbTide.js";

const UPSERT_CHUNK_SIZE = 500;
const ONE_HOUR_MS = 60 * 60 * 1000;

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

  const [swellCurrent, tide] = await Promise.all([
    fetchSwellAndCurrent(ledge.lat, ledge.lon, FORECAST_DAYS),
    fetchTide(ledge.lat, ledge.lon, tideStart, tideEnd),
  ]);

  const merged = mergeHourlySeries(swellCurrent, tide);

  const dangerResults = computeDangerSeries(
    {
      platformHeightM: ledge.platformHeightM,
      safetyMargin: ledge.safetyMargin,
      slopeEstimate: ledge.slopeEstimate,
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
        },
      });
  }
}
