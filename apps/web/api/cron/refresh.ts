import { db } from "../../server/db/client.js";
import { computeAndUpsertForLedge } from "../../server/computeAndUpsert.js";
import { ledges, type Ledge } from "../../server/db/schema.js";

// 60 is the actual hard ceiling on the Hobby plan (confirmed live: raising
// this export to 180 had no effect — the function still got killed at 60s
// on the wall clock, per Vercel's runtime logs). Anything beyond 60 here is
// dead configuration on this plan, so don't raise it again without first
// confirming the project has moved to Pro; the real lever for handling more
// ledges is CONCURRENCY below, not this number.
export const maxDuration = 60;

// Raised from 2 now that 25 ledges (2 * 13 = 13 sequential batches) was
// running past the 60s ceiling and getting cut off mid-run — confirmed live:
// several ledges never got their weatherStationLat/Lon set because the
// function was killed before reaching them. 5 keeps it to 5 sequential
// batches with real margin, while still well short of firing all 25 ledges'
// worth of ODB tide requests at once, which is what the free ODB API has
// shown signs of shedding load under (an HTTP 200 with an empty body) — see
// the retry in server/sources/odbTide.ts.
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
