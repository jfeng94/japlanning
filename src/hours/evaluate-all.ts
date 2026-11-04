import type { Place } from "../data/types.ts";
import type { OpeningHoursCtor } from "./open.ts";

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
 * Open state of every place at a Tokyo wall-clock Date. One parser
 * instance per distinct hours string, cached across calls, so refreshing
 * every minute costs nothing noticeable.
 */
export function evaluateAll(OpeningHours: OpeningHoursCtor, places: Place[], at: Date): Map<string, HoursState> {
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
      out.set(p.id, oh.getState(at) ? "open" : "closed");
    } catch {
      out.set(p.id, "unknown");
    }
  }
  return out;
}
