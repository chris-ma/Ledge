import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { db } from "../../server/db/client.js";
import { coastlineSegments, ledges } from "../../server/db/schema.js";
import {
  assignCoastlineToLedges,
  fetchCoastlineWays,
  snapLedgesToCoastline,
} from "../../server/coastline.js";

// One-off endpoint that builds the stored coastline geometry: fetches OSM
// coastline near every ledge (Overpass is reachable from Vercel but not from
// the build sandbox), splits it into per-ledge runs, snaps each ledge to the
// water's edge, and persists both. Delete this file once it's been invoked
// successfully — same pattern as every other admin step in this project's
// history, never left live.
//
// Overpass is a slow public API and 20 around-clauses is a chunky query, so
// this asks for the longest duration the plan allows.
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  const url = new URL(request.url);
  const bearerOk = request.headers.get("authorization") === `Bearer ${expected}`;
  const queryOk = url.searchParams.get("cron_secret") === expected;
  if (!bearerOk && !queryOk) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return Response.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  try {
    // Migration 0004, applied here rather than through a separate endpoint —
    // this sandbox can't reach Neon directly, and there's no point deploying
    // two throwaway endpoints for one change. All statements are idempotent.
    const rawSql = neon(databaseUrl);
    await rawSql`CREATE TABLE IF NOT EXISTS "coastline_segments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "ledge_id" uuid NOT NULL REFERENCES "ledges"("id") ON DELETE CASCADE,
      "path" jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`;
    await rawSql`CREATE INDEX IF NOT EXISTS "coastline_segments_ledge_idx" ON "coastline_segments" USING btree ("ledge_id")`;
    await rawSql`ALTER TABLE "ledges" ADD COLUMN IF NOT EXISTS "shore_lat" double precision`;
    await rawSql`ALTER TABLE "ledges" ADD COLUMN IF NOT EXISTS "shore_lon" double precision`;

    const anchors = await db
      .select({ id: ledges.id, name: ledges.name, lat: ledges.lat, lon: ledges.lon })
      .from(ledges);
    if (anchors.length === 0) {
      return Response.json({ error: "No ledges to anchor coastline to" }, { status: 400 });
    }

    const ways = await fetchCoastlineWays(anchors);
    const runs = assignCoastlineToLedges(ways, anchors);
    const snapped = snapLedgesToCoastline(ways, anchors);

    // Rebuilt wholesale: this is derived geometry, so a stale run from a
    // previous build has no reason to survive.
    await db.delete(coastlineSegments);
    for (let i = 0; i < runs.length; i += 200) {
      const chunk = runs.slice(i, i + 200);
      if (chunk.length > 0) await db.insert(coastlineSegments).values(chunk);
    }

    for (const [ledgeId, point] of snapped) {
      await db
        .update(ledges)
        .set({ shoreLat: point.lat, shoreLon: point.lon, updatedAt: new Date() })
        .where(eq(ledges.id, ledgeId));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(coastlineSegments);

    return Response.json({
      waysFetched: ways.length,
      vertexCount: ways.reduce((n, w) => n + w.length, 0),
      runsStored: count,
      ledgesSnapped: snapped.size,
      ledgesTotal: anchors.length,
      unsnapped: anchors.filter((l) => !snapped.has(l.id)).map((l) => l.name),
      runsPerLedge: anchors
        .map((l) => ({
          name: l.name,
          runs: runs.filter((r) => r.ledgeId === l.id).length,
          vertices: runs.filter((r) => r.ledgeId === l.id).reduce((n, r) => n + r.path.length, 0),
        }))
        .filter((r) => r.runs > 0),
    });
  } catch (err) {
    console.error("build-coastline failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
