import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../server/db/client.js";
import { ledgeConditions } from "../server/db/schema.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const ledgeIdParam = url.searchParams.get("ledgeId");

  if (!fromParam || !toParam) {
    return Response.json(
      { error: "Both 'from' and 'to' query params are required (ISO 8601 timestamps)" },
      { status: 400 },
    );
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json(
      { error: "'from' and 'to' must be valid ISO 8601 timestamps" },
      { status: 400 },
    );
  }

  try {
    const whereClauses = [gte(ledgeConditions.ts, from), lte(ledgeConditions.ts, to)];
    if (ledgeIdParam) {
      whereClauses.push(eq(ledgeConditions.ledgeId, ledgeIdParam));
    }

    const rows = await db
      .select()
      .from(ledgeConditions)
      .where(and(...whereClauses))
      .orderBy(asc(ledgeConditions.ts));

    return Response.json({ conditions: rows });
  } catch (err) {
    console.error("GET /api/ledge-conditions failed:", err);
    return Response.json({ error: "Failed to load ledge conditions" }, { status: 500 });
  }
}
