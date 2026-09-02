import { eq, sql } from "drizzle-orm";
import { db } from "../../server/db/client.js";
import { coastlineSegments, ledges } from "../../server/db/schema.js";
import {
  assignCoastlineToLedges,
  fetchCoastlineWays,
  snapLedgesToCoastline,
} from "../../server/coastline.js";

// One-off endpoint that rebuilds the stored coastline geometry now that 5
// new anchor ledges have been seeded (Bungan Head, Turimetta Head, Point
// Piper, Grotto Point, Balgowlah Heights) to close coastline gaps no
// existing ledge's own coordinate was close enough to claim: the northern
// beaches between Barrenjoey Head and Long Reef Point, the harbour's south
// shore between the Bridge/city and Vaucluse, and Middle Harbour/Balgowlah.
// Delete this file once it's been invoked successfully — same pattern as
// every other admin step in this project's history, never left live.
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

  try {
    const anchors = await db
      .select({
        id: ledges.id,
        name: ledges.name,
        lat: ledges.lat,
        lon: ledges.lon,
        facingBearing: ledges.facingBearing,
      })
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
