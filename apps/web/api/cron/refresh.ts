import { db } from "../../server/db/client.js";
import { computeAndUpsertForLedge } from "../../server/computeAndUpsert.js";
import { ledges, type Ledge } from "../../server/db/schema.js";

// Fetching+computing every ledge against two external APIs can comfortably
// exceed Vercel's default function timeout; this is well within what's
// configurable on the Hobby plan. Was 60 — fine at 20 ledges, but 25 (after
// the 5 new anchor ledges) started running right up against it and getting
// cut off mid-batch, leaving the last few ledges' weatherStationLat/Lon
// unset for that run. Given real headroom instead of tuning it right to the
// edge again every time the ledge count grows.
export const maxDuration = 180;

// Kept low: the free ODB tide API has shown signs of shedding load (an
// HTTP 200 with an empty body) under higher concurrency — see the retry
// in server/sources/odbTide.ts. Comfortably fits inside maxDuration even
// with retries at this concurrency, for the current 25 ledges.
const CONCURRENCY = 2;

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
 * set on the project. Also accepts the same secret as a `?cron_secret=`
 * query param, for manual triggering from contexts (a browser tab, a tool
 * that can't set custom headers) that can't send a bearer header — knowing
 * the secret is knowing the secret either way, so this isn't a weaker check.
 */
export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("CRON_SECRET is not set — refusing to run the refresh job.");
    return Response.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  const url = new URL(request.url);
  const bearerOk = request.headers.get("authorization") === `Bearer ${expected}`;
  const queryOk = url.searchParams.get("cron_secret") === expected;
  if (!bearerOk && !queryOk) {
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
