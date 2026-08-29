import { neon } from "@neondatabase/serverless";
import { seedLedges } from "../../server/db/seed.js";

// One-off endpoint to apply the `sheltered` column migration + reseed the 8
// new harbour ledges against the live Neon DB, since this sandbox can't
// reach Neon directly. Delete this file once it's been invoked successfully
// — same pattern as every other admin migration step in this project's
// history, never left live.
export const maxDuration = 60;

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
  const sql = neon(databaseUrl);

  await sql`ALTER TABLE "ledges" ADD COLUMN IF NOT EXISTS "sheltered" boolean DEFAULT false NOT NULL`;

  const seededCount = await seedLedges();

  return Response.json({ migrated: true, seededCount });
}
