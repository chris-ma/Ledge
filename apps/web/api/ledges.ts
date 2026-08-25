import { db } from "../server/db/client";
import { ledges } from "../server/db/schema";

export async function GET(): Promise<Response> {
  try {
    const rows = await db.select().from(ledges).orderBy(ledges.name);
    return Response.json({ ledges: rows });
  } catch (err) {
    console.error("GET /api/ledges failed:", err);
    return Response.json({ error: "Failed to load ledges" }, { status: 500 });
  }
}
