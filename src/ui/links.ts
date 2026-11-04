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

/** What Copy puts on the clipboard: the name, then the address when there is one. */
export function copyText(place: Pick<Place, "name" | "address">): string {
  return place.address ? `${place.name}\n${place.address}` : place.name;
}

/** A link straight to one place: region and id, never the filter state. */
export function shareUrl(place: Pick<Place, "id" | "region">, origin: string): string {
  return `${origin}/?r=${encodeURIComponent(place.region)}&s=${encodeURIComponent(place.id)}`;
}

/** The share text: the name on its own line so the recipient can search for it in the app, then the link. */
export function shareText(place: Pick<Place, "name">, url: string): string {
  return `${place.name}\n${url}`;
}

/** "Instagram" for instagram.com links, "Website" for anything else. */
export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "Instagram";
  } catch {
    /* not a URL; fall through */
  }
  return "Website";
}

/** Place ids look like `<layer id>:<slug>`; layer ids are lowercase words and dashes. */
const BARE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*:\S+$/u;

/**
 * Recognise a shared link pasted into search, or a bare place id, and
 * return the place id. Links must be to this site (`host`); the place id
 * comes from their `s=` parameter. Anything else is just search text.
 */
export function parseSharedLink(text: string, host: string): string | undefined {
  const t = text.trim();
  if (t === "" || /\s/.test(t)) return undefined;
  if (BARE_ID.test(t) && !/^https?:/i.test(t)) return t;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return undefined;
  }
  if (url.hostname !== host) return undefined;
  const s = url.searchParams.get("s");
  return s && BARE_ID.test(s) ? s : undefined;
}
