/**
 * One-off diagnostic: returns ODB's raw JSON response for a single point, so
 * its real field names can be inspected from outside this sandbox's network
 * restrictions (Vercel's servers can reach eco.odb.ntu.edu.tw; this sandbox
 * cannot). Delete this file once the tide-current (u/v) field question is
 * resolved — it's not meant to be a permanent admin surface.
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

  const lat = url.searchParams.get("lat") ?? "-33.8237";
  const lon = url.searchParams.get("lon") ?? "151.2814";

  const odbUrl = new URL("https://eco.odb.ntu.edu.tw/api/tide");
  odbUrl.searchParams.set("lon0", lon);
  odbUrl.searchParams.set("lat0", lat);
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  odbUrl.searchParams.set("start", start);
  odbUrl.searchParams.set("end", end);

  const response = await fetch(odbUrl);
  const text = await response.text();

  return Response.json({
    requestedUrl: odbUrl.toString(),
    status: response.status,
    bodyLength: text.length,
    bodySample: text.slice(0, 3000),
  });
}
