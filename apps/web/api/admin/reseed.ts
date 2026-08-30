import { seedLedges } from "../../server/db/seed.js";

// One-off endpoint to push corrected ledge coordinates to the live DB,
// since this sandbox can't reach Neon directly. Same pattern as every
// other admin migration step in this project's history — invoked once via
// web_fetch_vercel_url, then deleted.
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

  const seededCount = await seedLedges();
  return Response.json({ seededCount });
}
