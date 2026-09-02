import { eq } from "drizzle-orm";
import { db } from "../../server/db/client.js";
import { computeAndUpsertForLedge } from "../../server/computeAndUpsert.js";
import { ledges } from "../../server/db/schema.js";

export const maxDuration = 60;

// Temporary one-off backfill: re-run the tide fetch for every sheltered
// (harbour-interior) ledge now that fetchTideWithFallback actually detects
// a land-masked empty response and falls back correctly. No secret gate —
// same reasoning as the diagnostic endpoint this replaces: no sensitive
// data, only recomputes already-public forecast rows, deleted right after
// use.
export async function GET(): Promise<Response> {
  const shelteredLedges = await db.select().from(ledges).where(eq(ledges.sheltered, true));

  const results = await Promise.allSettled(shelteredLedges.map((ledge) => computeAndUpsertForLedge(ledge)));

  const summary = results.map((outcome, i) => {
    const ledge = shelteredLedges[i];
    if (outcome.status === "fulfilled") {
      return { ledgeName: ledge.name, status: "fulfilled", rowsUpserted: outcome.value.rowsUpserted };
    }
    return {
      ledgeName: ledge.name,
      status: "rejected",
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    };
  });

  return Response.json({ summary });
}
