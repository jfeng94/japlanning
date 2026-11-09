/** Distances on the ground, for "what's close". */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres (haversine). Good to well under 0.1% at city scale. */
export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** "350 m" under a kilometre, "1.2 km" under ten, "12 km" beyond. */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "";
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

/** Whether a point is inside [west, south, east, north] (a RegionConfig bbox). */
export function inBbox(p: LatLng, bbox: readonly [number, number, number, number]): boolean {
  const [west, south, east, north] = bbox;
  return p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north;
}

/** Nearest first; ties keep their incoming order. */
export function sortByDistance<T extends LatLng>(items: T[], from: LatLng): T[] {
  return items
    .map((item, i) => ({ item, i, d: distanceM(from, item) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ item }) => item);
}
