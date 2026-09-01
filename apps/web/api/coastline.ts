import { db } from "../server/db/client.js";
import { coastlineSegments } from "../server/db/schema.js";

/**
 * The real coastline runs the map paints Fishing Condition onto, each tagged
 * with the ledge it belongs to. Static geometry — it only changes when the
 * coastline is rebuilt — so it's cached hard at the edge rather than
 * re-queried on every map load.
 */
export async function GET(): Promise<Response> {
  try {
    const rows = await db
      .select({
        id: coastlineSegments.id,
        ledgeId: coastlineSegments.ledgeId,
        path: coastlineSegments.path,
      })
      .from(coastlineSegments);

    return Response.json(
      { segments: rows },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    console.error("GET /api/coastline failed:", err);
    return Response.json({ error: "Failed to load coastline" }, { status: 500 });
  }
}
