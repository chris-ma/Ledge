const EARTH_RADIUS_KM = 6371;

/**
 * Destination point given a start coordinate, a bearing (degrees, clockwise
 * from true north), and a distance (km) — standard great-circle formula.
 * Used to nudge a ledge's query point out to sea before asking a global
 * tide model for data, since near-shore cells commonly land-mask out on
 * coarse global grids (see server/sources/odbTide.ts).
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): { lat: number; lon: number } {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    // Normalize to [-180, 180) in case a future ledge sits near the antimeridian.
    lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
  };
}
