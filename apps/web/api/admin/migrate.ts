import { sql } from "drizzle-orm";
import { db } from "../../server/db/client.js";

/**
 * One-off: applies the fishing-pressure column migration directly (rather
 * than drizzle-kit's migrate() against the drizzle/ folder, which risks
 * Vercel's file tracer not bundling the SQL files at runtime). Secret-gated
 * the same way as cron/refresh.ts. Delete this file once it's been run
 * successfully against production — it's not meant to be a permanent
 * admin surface.
 */
export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  const url = new URL(request.url);
  const bearerOk = request.headers.get("authorization") === `Bearer ${expected}`;
  const queryOk = url.searchParams.get("secret") === expected;
  if (!bearerOk && !queryOk) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.execute(
    sql`ALTER TABLE "ledge_conditions" ADD COLUMN IF NOT EXISTS "tide_current_speed_ms" double precision`,
  );
  await db.execute(
    sql`ALTER TABLE "ledge_conditions" ADD COLUMN IF NOT EXISTS "tide_current_dir_deg" double precision`,
  );
  await db.execute(
    sql`ALTER TABLE "ledge_conditions" ADD COLUMN IF NOT EXISTS "fishing_pressure" double precision`,
  );
  await db.execute(
    sql`ALTER TABLE "ledge_conditions" ADD COLUMN IF NOT EXISTS "fishing_tier" text`,
  );

  return Response.json({ ok: true });
}
