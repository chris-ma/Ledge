const OPEN_METEO_MARINE_BASE_URL = "https://marine-api.open-meteo.com/v1/marine";

/**
 * UNVERIFIED — this build's sandbox is policy-blocked from reaching
 * marine-api.open-meteo.com (confirmed via the agent egress proxy: 403 on
 * CONNECT), so this could not be checked against a real response before
 * deploy. `swell_wave_direction` is virtually certainly "coming from"
 * (meteorological convention, matching every other Open-Meteo direction
 * field). `ocean_current_direction` is commonly "going to" (oceanographic
 * convention) with other providers, but Open-Meteo may follow its own
 * house convention instead.
 *
 * Flip this to "to" if computeCurrentLoad's cos(phi) term looks inverted
 * once real data flows — e.g. the East Australian Current runs south along
 * the NSW coast, so it should register as loading south/southeast-facing
 * Sydney ledges, not north-facing ones. If that's backwards, flip this.
 */
const OCEAN_CURRENT_DIRECTION_CONVENTION: "from" | "to" = "from";

export interface SwellCurrentHour {
  /** ISO 8601, top of hour, UTC. */
  ts: string;
  hsM: number | null;
  tpS: number | null;
  swellDirDeg: number | null;
  currentSpeedMs: number | null;
  currentDirDeg: number | null;
}

interface OpenMeteoMarineResponse {
  hourly?: {
    time?: string[];
    swell_wave_height?: (number | null)[];
    swell_wave_direction?: (number | null)[];
    swell_wave_period?: (number | null)[];
    ocean_current_velocity?: (number | null)[];
    ocean_current_direction?: (number | null)[];
  };
  hourly_units?: Record<string, string>;
}

function toMetersPerSecond(value: number, unit: string | undefined): number {
  switch (unit) {
    case "m/s":
    case "ms":
      return value;
    case "km/h":
    case "kmh":
      return value / 3.6;
    case "kn":
    case "kt":
      return value * 0.514444;
    default:
      throw new Error(
        `Unrecognized ocean_current_velocity unit "${unit}" from Open-Meteo Marine API — ` +
          "check the live hourly_units response and add a conversion case.",
      );
  }
}

function normalizeDirection(directionDeg: number): number {
  return OCEAN_CURRENT_DIRECTION_CONVENTION === "from"
    ? directionDeg
    : (directionDeg + 180) % 360;
}

/**
 * Fetches hourly swell (Hs, Tp, direction) and ocean current (speed,
 * direction) for a point from Open-Meteo's free Marine API. Throws with a
 * descriptive message (rather than returning silently-wrong data) if the
 * response shape or units don't match what's expected, so a first-deploy
 * mismatch is diagnosable from Vercel function logs.
 */
export async function fetchSwellAndCurrent(
  lat: number,
  lon: number,
  forecastDays: number,
): Promise<SwellCurrentHour[]> {
  const url = new URL(OPEN_METEO_MARINE_BASE_URL);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set(
    "hourly",
    [
      "swell_wave_height",
      "swell_wave_direction",
      "swell_wave_period",
      "ocean_current_velocity",
      "ocean_current_direction",
    ].join(","),
  );
  url.searchParams.set("timeformat", "iso8601");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", String(forecastDays));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Open-Meteo Marine API returned ${response.status} for (${lat}, ${lon}): ` +
        (await response.text()),
    );
  }

  const body = (await response.json()) as OpenMeteoMarineResponse;
  const hourly = body.hourly;
  if (!hourly?.time) {
    throw new Error(
      `Open-Meteo Marine API response for (${lat}, ${lon}) had no hourly.time array — ` +
        `response shape may differ from what was assumed at build time: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }

  const currentVelocityUnit = body.hourly_units?.ocean_current_velocity;

  return hourly.time.map((ts, i) => {
    const currentSpeedRaw = hourly.ocean_current_velocity?.[i] ?? null;
    const currentDirRaw = hourly.ocean_current_direction?.[i] ?? null;

    return {
      ts,
      hsM: hourly.swell_wave_height?.[i] ?? null,
      tpS: hourly.swell_wave_period?.[i] ?? null,
      swellDirDeg: hourly.swell_wave_direction?.[i] ?? null,
      currentSpeedMs:
        currentSpeedRaw === null
          ? null
          : toMetersPerSecond(currentSpeedRaw, currentVelocityUnit),
      currentDirDeg: currentDirRaw === null ? null : normalizeDirection(currentDirRaw),
    };
  });
}
