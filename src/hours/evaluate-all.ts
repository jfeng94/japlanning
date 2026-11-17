import type { Place } from "../data/types.ts";
import { zoneNow, type OpeningHoursCtor } from "./open.ts";

/** What the filter needs per place: open, closed, or unknown (blank or unparsable hours). */
export type HoursState = "open" | "closed" | "unknown";

type Parsed = InstanceType<OpeningHoursCtor> | null; // null = unparsable
const cache = new Map<string, Parsed>();

function parsed(OpeningHours: OpeningHoursCtor, hours: string): Parsed {
  let p = cache.get(hours);
  if (p === undefined) {
    try {
      p = new OpeningHours(hours, null, { locale: "en" });
    } catch {
      p = null;
    }
    cache.set(hours, p);
  }
  return p;
}

/**
 * When each place is evaluated: the picked wall-clock moment (Open at, in
 * the city on screen), else now in the place's own zone, worked out once
 * per zone.
 */
export function momentFor(picked: Date | undefined, zoneOf: (p: Place) => string, now: Date = new Date()): (p: Place) => Date {
  if (picked) return () => picked;
  const byZone = new Map<string, Date>();
  return (p) => {
    const zone = zoneOf(p);
    let d = byZone.get(zone);
    if (!d) byZone.set(zone, (d = zoneNow(zone, now)));
    return d;
  };
}

/**
 * Open state of every place at its wall-clock moment (momentFor). One
 * parser instance per distinct hours string, cached across calls, so
 * refreshing every minute costs nothing noticeable.
 */
export function evaluateAll(OpeningHours: OpeningHoursCtor, places: Place[], at: (p: Place) => Date): Map<string, HoursState> {
  const out = new Map<string, HoursState>();
  for (const p of places) {
    const hours = p.hoursOsm?.trim();
    if (!hours) {
      out.set(p.id, "unknown");
      continue;
    }
    const oh = parsed(OpeningHours, hours);
    if (!oh) {
      out.set(p.id, "unknown");
      continue;
    }
    try {
      out.set(p.id, oh.getState(at(p)) ? "open" : "closed");
    } catch {
      out.set(p.id, "unknown");
    }
  }
  return out;
}
