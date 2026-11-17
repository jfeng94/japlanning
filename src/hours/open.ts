/**
 * Open / closed from an OpenStreetMap `opening_hours` string, evaluated in
 * the place's own city's time zone (its region's `timeZone`: Asia/Tokyo in
 * Japan, America/New_York in New York) whatever the device's.
 *
 * The opening_hours library reads the wall clock from a Date's *local*
 * getters (getDay, getHours...). So we hand it a Date whose local fields
 * equal the city's wall clock: on a phone in California that Date is
 * "wrong" as an instant but right as a clock, which is what the library
 * wants. Dates it returns (next change) are in the same frame, so their
 * local getters are wall-clock values too and can be formatted directly.
 */

/** Japan's zone: every region's but New York's. */
export const TOKYO_TZ = "Asia/Tokyo";

export type OpenState = "open" | "closed" | "unknown" | "unparsable";

export interface OpenStatus {
  state: OpenState;
  /** One line for the card, e.g. "Open · until 19:00". Empty when unknown. */
  label: string;
}

const formats = new Map<string, Intl.DateTimeFormat>();
function partsFormat(zone: string): Intl.DateTimeFormat {
  let f = formats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formats.set(zone, f);
  }
  return f;
}

/** A Date whose local fields are the zone's wall clock at `now`. */
export function zoneNow(zone: string, now: Date = new Date()): Date {
  const p: Record<string, number> = {};
  for (const part of partsFormat(zone).formatToParts(now)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return new Date(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!, p["second"]!);
}

/**
 * "YYYY-MM-DDTHH:MM" (a wall-clock moment in the city on screen, as the URL and Open at's pickers carry it) to the
 * same kind of Date, or undefined. No zone is involved: the string is already a wall clock.
 */
export function parseWallClock(s: string | undefined): Date | undefined {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s) : null;
  if (!m) return undefined;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi, 0);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The inverse: a wall-clock Date to "YYYY-MM-DDTHH:MM". */
export function wallClockString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type OpeningHoursCtor = new (value: string, nominatim?: null, options?: { locale?: string }) => {
  getState(date?: Date): boolean;
  getNextChange(date?: Date, maxdate?: Date): Date | undefined;
};

let ctor: Promise<OpeningHoursCtor> | undefined;

/** The parser is a few hundred kB with its helpers; load it on first use. */
export function loadParser(): Promise<OpeningHoursCtor> {
  return (ctor ??= import("opening_hours").then((m) => m.default as unknown as OpeningHoursCtor));
}

export const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Status for the card, in the place's zone. `at` is a wall-clock Date (from
 * parseWallClock, Open at's pick); without it, now in the zone. When it
 * isn't "now", the label says when it's for.
 */
export async function openStatus(hoursOsm: string | undefined, zone: string, at?: Date, isNow = at === undefined): Promise<OpenStatus> {
  if (!hoursOsm || hoursOsm.trim() === "") return { state: "unknown", label: "" };
  const OpeningHours = await loadParser();
  return evaluateLocal(OpeningHours, hoursOsm, at ?? zoneNow(zone), isNow);
}

/** Synchronous core taking an instant; converts to the zone's wall clock. For tests. */
export function evaluate(OpeningHours: OpeningHoursCtor, hoursOsm: string, now: Date, zone: string): OpenStatus {
  return evaluateLocal(OpeningHours, hoursOsm, zoneNow(zone, now), true);
}

/** Synchronous core taking a wall-clock Date. */
export function evaluateLocal(OpeningHours: OpeningHoursCtor, hoursOsm: string, t: Date, isNow = true): OpenStatus {
  let oh: InstanceType<OpeningHoursCtor>;
  try {
    oh = new OpeningHours(hoursOsm, null, { locale: "en" });
  } catch {
    return { state: "unparsable", label: "Hours unparsable" };
  }
  let open: boolean;
  let next: Date | undefined;
  try {
    open = oh.getState(t);
    next = oh.getNextChange(t, new Date(t.getTime() + WEEK_MS));
  } catch {
    return { state: "unparsable", label: "Hours unparsable" };
  }
  const when = isNow ? "" : ` at ${DAY[t.getDay()]} ${clock(t)}`;
  if (open) {
    return { state: "open", label: next ? `Open${when} · until ${clock(next)}` : `Open${when}` };
  }
  if (!next) return { state: "closed", label: `Closed${when}` };
  const sameDay = next.getFullYear() === t.getFullYear() && next.getMonth() === t.getMonth() && next.getDate() === t.getDate();
  if (sameDay) return { state: "closed", label: `Closed${when} · opens ${clock(next)}` };
  return { state: "closed", label: `Closed${isNow ? " today" : when} · opens ${DAY[next.getDay()]} ${clock(next)}` };
}

export function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
