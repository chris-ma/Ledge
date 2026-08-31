// Duplicated from server/geo.ts — server/ code is never imported into src/
// (see apps/web CLAUDE instructions), so this small great-circle helper is
// kept in both places rather than shared.
const EARTH_RADIUS_KM = 6371;

/**
 * Destination point given a start coordinate, a bearing (degrees, clockwise
 * from true north), and a distance (km) — standard great-circle formula.
 * Used to compute a shoreline line segment's endpoints from a ledge's
 * facing_bearing (see PressureHeatmap.tsx).
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

/** Great-circle (haversine) distance in km between two coordinates. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
