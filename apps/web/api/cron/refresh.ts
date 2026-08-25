import { db } from "../../server/db/client";
import { computeAndUpsertForLedge } from "../../server/computeAndUpsert";
import { ledges, type Ledge } from "../../server/db/schema";

// Fetching+computing 12 ledges against two external APIs can comfortably
// exceed Vercel's default function timeout; this is well within what's
// configurable on the Hobby plan.
export const maxDuration = 60;

const CONCURRENCY = 4;

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
    console.error(`Refresh failed for ledge "${ledge.name}":`, outcome.reason);
    return {
      ledgeName: ledge.name,
      status: "rejected",
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    };
  });
}

/**
 * Called by Vercel Cron (see vercel.json) once daily. Rejects any request
 * whose bearer doesn't match CRON_SECRET, so this write-heavy endpoint
 * can't be triggered by a random public GET. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically when that env var is
 * set on the project.
 */
export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("CRON_SECRET is not set — refusing to run the refresh job.");
    return Response.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
