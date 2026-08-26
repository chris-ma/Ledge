// Ocean Data Bank (Institute of Oceanography, National Taiwan University)
// "Open Tide API", built on the TPXO global tide model. Free, no key, no
// auth. Point query span limit is documented as <=30 days of hourly data —
// FORECAST_DAYS (10) + 1 lookback day is well under that, so it's not
// actively enforced here.
const ODB_TIDE_BASE_URL = "https://eco.odb.ntu.edu.tw/api/tide";

export interface TideHour {
  /** ISO 8601, top of hour, UTC. */
  ts: string;
  tideHeightCm: number | null;
  /** Tidal current components from the TPXO model — not used for MVP's
   * current_load (Open-Meteo's ocean_current_velocity/direction is the
   * primary current source), kept for a possible future blended estimate. */
  currentUCmS: number | null;
  currentVCmS: number | null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseOdbRecord(row: unknown): TideHour {
  if (!row || typeof row !== "object") {
    throw new Error(`Unexpected ODB tide record shape: ${JSON.stringify(row)}`);
  }
  const record = row as Record<string, unknown>;
  const ts = record.time ?? record.t ?? record.datetime;
  if (typeof ts !== "string") {
    throw new Error(`ODB tide record missing a recognizable time field: ${JSON.stringify(record)}`);
  }
  return {
    ts,
    tideHeightCm: numberOrNull(record.z),
    currentUCmS: numberOrNull(record.u),
    currentVCmS: numberOrNull(record.v),
  };
}

/**
 * The ODB Open Tide API's exact JSON response shape could not be verified
 * from this build's sandbox (org policy blocks eco.odb.ntu.edu.tw — 403 on
 * CONNECT). This tries the two most likely shapes for a point hourly time
 * series (an array of per-hour records, or parallel arrays keyed by field)
 * and throws with a snippet of the raw body if neither matches, so the
 * first real mismatch is diagnosable from Vercel function logs rather than
 * silently producing wrong tide data.
 */
export function parseOdbTideResponse(raw: unknown): TideHour[] {
  if (Array.isArray(raw)) {
    return raw.map(parseOdbRecord);
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.time)) {
      const time = obj.time;
      const z = obj.z;
      const u = obj.u;
      const v = obj.v;
      return time.map((ts, i) => ({
        ts: String(ts),
        tideHeightCm: numberOrNull(Array.isArray(z) ? z[i] : undefined),
        currentUCmS: numberOrNull(Array.isArray(u) ? u[i] : undefined),
        currentVCmS: numberOrNull(Array.isArray(v) ? v[i] : undefined),
      }));
    }
  }

  throw new Error(
    "Unrecognized ODB Open Tide API response shape — expected either an array of " +
      "per-hour records or a {time,z,u,v} parallel-array object. Got: " +
      JSON.stringify(raw).slice(0, 500),
  );
}

// Observed in production: under concurrent load, ODB sometimes returns an
// HTTP 200 with an empty `{}` body instead of a proper error or the real
// payload — a free academic API apparently shedding load rather than
// rejecting it cleanly. A short retry with backoff resolves this in
// practice (confirmed against the live API, unlike the shape assumptions
// above which couldn't be).
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTide(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<TideHour[]> {
  const url = new URL(ODB_TIDE_BASE_URL);
  url.searchParams.set("lon0", lon.toFixed(4));
  url.searchParams.set("lat0", lat.toFixed(4));
  url.searchParams.set("start", startDate);
  url.searchParams.set("end", endDate);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `ODB Open Tide API returned ${response.status} for (${lat}, ${lon}): ` +
            (await response.text()),
        );
      }
      const body: unknown = await response.json();
      return parseOdbTideResponse(body);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
