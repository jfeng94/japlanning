import type { LatLng } from "./distance.ts";

/**
 * Nearby: places within a radius of the device (docs/proposals/filter-pages-and-area-map.md).
 * The stops come from counting places around Tokyo landmarks: 1 km finds
 * six around Shibuya station but one around Kiyosumi, 250 m finds next to
 * nothing yet, and 3 km is a 50-minute walk.
 */
export const NEARBY_STOPS = [500, 1000, 1500, 2000, 3000] as const;

export const DEFAULT_NEARBY_M = 1000;

/** The stop closest to `m` (a URL can carry any number). */
export function snapRadius(m: number): number {
  let best: number = NEARBY_STOPS[0];
  for (const stop of NEARBY_STOPS) if (Math.abs(stop - m) < Math.abs(best - m)) best = stop;
  return best;
}

/** "500 m", "1 km", "1.5 km". */
export function formatRadius(m: number): string {
  return m < 1000 ? `${m} m` : `${Number((m / 1000).toFixed(1))} km`;
}

/** Minutes on foot: 80 m a minute (the Japanese estate-agent standard) on a route about 1.3 times the straight line. */
export function walkMinutes(m: number): number {
  return Math.round((m * 1.3) / 80);
}

const EARTH_RADIUS_M = 6_371_008.8;

/** A circle of `radiusM` around `center` as a closed GeoJSON ring of [lng, lat] points, for the map. */
export function circleRing(center: LatLng, radiusM: number, steps = 64): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(center.lat);
  const lng1 = toRad(center.lng);
  const d = radiusM / EARTH_RADIUS_M;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * (i % steps)) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([toDeg(lng2), toDeg(lat2)]);
  }
  return ring;
}
