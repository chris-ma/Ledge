// Duplicated from server/geo.ts — server/ code is never imported into src/
// (see apps/web CLAUDE instructions), so this small great-circle helper is
// kept in both places rather than shared.
const EARTH_RADIUS_KM = 6371;

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
