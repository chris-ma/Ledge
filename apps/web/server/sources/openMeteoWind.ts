// Open-Meteo's standard Forecast API (distinct from the Marine API used for
// swell/current — that one has no wind fields) — free, no key, no auth.
const OPEN_METEO_FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast";

export interface WindHour {
  /** ISO 8601, top of hour, UTC. */
  ts: string;
  windSpeedMs: number | null;
  /** Compass bearing the wind is blowing FROM (meteorological convention). */
  windDirDeg: number | null;
}

interface OpenMeteoForecastResponse {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
  };
}

/**
 * Fetches hourly 10m wind speed + direction for a point from Open-Meteo's
 * free Forecast API. Requests the unit directly as m/s (wind_speed_unit=ms)
 * so no client-side conversion is needed, matching every other speed field
 * in this codebase.
 */
export async function fetchWind(lat: number, lon: number, forecastDays: number): Promise<WindHour[]> {
  const url = new URL(OPEN_METEO_FORECAST_BASE_URL);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timeformat", "iso8601");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", String(forecastDays));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Open-Meteo Forecast API returned ${response.status} for (${lat}, ${lon}): ` + (await response.text()),
    );
  }

  const body = (await response.json()) as OpenMeteoForecastResponse;
  const hourly = body.hourly;
  if (!hourly?.time) {
    throw new Error(
      `Open-Meteo Forecast API response for (${lat}, ${lon}) had no hourly.time array — ` +
        `response shape may differ from what was assumed at build time: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }

  return hourly.time.map((ts, i) => ({
    ts,
    windSpeedMs: hourly.wind_speed_10m?.[i] ?? null,
    windDirDeg: hourly.wind_direction_10m?.[i] ?? null,
  }));
}
