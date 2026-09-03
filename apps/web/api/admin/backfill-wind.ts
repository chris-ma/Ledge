import { db } from "../../server/db/client.js";
import { computeAndUpsertForLedge } from "../../server/computeAndUpsert.js";
import { ledges, type Ledge } from "../../server/db/schema.js";

export const maxDuration = 60;

// Same batching as api/cron/refresh.ts (25 ledges / 5 per batch = 5
// sequential batches, comfortably inside the Hobby-plan 60s ceiling).
const CONCURRENCY = 5;

interface LedgeRunResult {
  ledgeName: string;
  status: "fulfilled" | "rejected";
  rowsUpserted?: number;
  error?: string;
}

async function runBatch(batch: Ledge[]): Promise<LedgeRunResult[]> {
  const settled = await Promise.allSettled(batch.map((ledge) => computeAndUpsertForLedge(ledge)));
  return settled.map((outcome, i) => {
    const ledge = batch[i];
    if (outcome.status === "fulfilled") {
      return { ledgeName: ledge.name, status: "fulfilled", rowsUpserted: outcome.value.rowsUpserted };
    }
    return {
      ledgeName: ledge.name,
      status: "rejected",
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    };
  });
}

// Temporary one-off backfill: re-run computeAndUpsertForLedge for every
// ledge now that wind_speed_ms/wind_dir_deg exist, so the new overlay has
// data immediately instead of waiting for the next scheduled cron/refresh.
// No secret gate — same reasoning as prior temp admin endpoints this
// session: no sensitive data, only recomputes already-public forecast
// rows, deleted right after use.
export async function GET(): Promise<Response> {
  const allLedges = await db.select().from(ledges);
  const results: LedgeRunResult[] = [];

  for (let i = 0; i < allLedges.length; i += CONCURRENCY) {
    const batch = allLedges.slice(i, i + CONCURRENCY);
    results.push(...(await runBatch(batch)));
  }

  const ledgesProcessed = results.filter((r) => r.status === "fulfilled").length;
  const ledgesFailed = results.filter((r) => r.status === "rejected").length;
  const rowsUpserted = results.reduce((sum, r) => sum + (r.rowsUpserted ?? 0), 0);

  return Response.json({ ledgesProcessed, ledgesFailed, rowsUpserted, results });
}
