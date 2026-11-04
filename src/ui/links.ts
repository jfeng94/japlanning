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

/** A link straight to one place: region and id, never the filter state. This is what Share copies. */
export function shareUrl(place: Pick<Place, "id" | "region">, origin: string): string {
  return `${origin}/?r=${encodeURIComponent(place.region)}&s=${encodeURIComponent(place.id)}`;
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

/** Place ids look like `<layer id>:<slug>`; layer ids start with a letter (so "08:00-19:00" isn't one). */
const BARE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*:\S+$/u;

/**
 * Recognise a shared link pasted into search, or a bare place id, and
 * return the place id. The link may sit inside other text (a message
 * with a name above it); each whitespace-separated token is tried. Links
 * must be to this site (`host`); the place id comes from their `s=`
 * parameter. Anything else is just search text.
 */
export function parseSharedLink(text: string, host: string): string | undefined {
  for (const token of text.trim().split(/\s+/)) {
    if (token === "") continue;
    if (BARE_ID.test(token) && !/^https?:/i.test(token)) return token;
    if (!/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?)/i.test(token)) continue;
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(token) ? token : `https://${token}`);
    } catch {
      continue;
    }
    if (url.hostname !== host) continue;
    const s = url.searchParams.get("s");
    if (s && BARE_ID.test(s)) return s;
  }
  return undefined;
}
