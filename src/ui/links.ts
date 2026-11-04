import type { Place } from "../data/types.ts";

/**
 * Google Maps directions deep link. Coordinates, not a place search, so
 * the destination is never mis-matched; Google shows a dropped pin
 * rather than the business name. Opens the Maps app on iOS if installed.
 */
export function directionsUrl(place: Pick<Place, "lat" | "lng">): string {
  const dest = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}
