/**
 * Open / closed from an OpenStreetMap `opening_hours` string, evaluated in
 * Asia/Tokyo whatever the device's time zone.
 *
 * The opening_hours library reads the wall clock from a Date's *local*
 * getters (getDay, getHours...). So we hand it a Date whose local fields
 * equal Tokyo's wall clock: on a phone in California that Date is "wrong"
 * as an instant but right as a clock, which is what the library wants.
 * Dates it returns (next change) are in the same frame, so their local
 * getters are Tokyo wall-clock values too and can be formatted directly.
 */

export const TOKYO_TZ = "Asia/Tokyo";

export type OpenState = "open" | "closed" | "unknown" | "unparsable";

export interface OpenStatus {
  state: OpenState;
  /** One line for the card, e.g. "Open · until 19:00". Empty when unknown. */
  label: string;
}

const tokyoParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TOKYO_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** A Date whose local fields are Tokyo's wall clock at `now`. */
export function tokyoNow(now: Date = new Date()): Date {
  const p: Record<string, number> = {};
  for (const part of tokyoParts.formatToParts(now)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return new Date(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!, p["second"]!);
}

type OpeningHoursCtor = new (value: string, nominatim?: null, options?: { locale?: string }) => {
  getState(date?: Date): boolean;
  getNextChange(date?: Date, maxdate?: Date): Date | undefined;
};

let ctor: Promise<OpeningHoursCtor> | undefined;

/** The parser is a few hundred kB with its helpers; load it on first use. */
function loadParser(): Promise<OpeningHoursCtor> {
  return (ctor ??= import("opening_hours").then((m) => m.default as unknown as OpeningHoursCtor));
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function openStatus(hoursOsm: string | undefined, now: Date = new Date()): Promise<OpenStatus> {
  if (!hoursOsm || hoursOsm.trim() === "") return { state: "unknown", label: "" };
  const OpeningHours = await loadParser();
  return evaluate(OpeningHours, hoursOsm, now);
}

/** Synchronous core, for tests and for callers that already have the parser. */
export function evaluate(OpeningHours: OpeningHoursCtor, hoursOsm: string, now: Date): OpenStatus {
  let oh: InstanceType<OpeningHoursCtor>;
  try {
    oh = new OpeningHours(hoursOsm, null, { locale: "en" });
  } catch {
    return { state: "unparsable", label: "Hours unparsable" };
  }
  const t = tokyoNow(now);
  let open: boolean;
  let next: Date | undefined;
  try {
    open = oh.getState(t);
    next = oh.getNextChange(t, new Date(t.getTime() + WEEK_MS));
  } catch {
    return { state: "unparsable", label: "Hours unparsable" };
  }
  if (open) {
    return { state: "open", label: next ? `Open · until ${clock(next)}` : "Open" };
  }
  if (!next) return { state: "closed", label: "Closed" };
  const sameDay = next.getFullYear() === t.getFullYear() && next.getMonth() === t.getMonth() && next.getDate() === t.getDate();
  return { state: "closed", label: sameDay ? `Closed · opens ${clock(next)}` : `Closed today · opens ${DAY[next.getDay()]} ${clock(next)}` };
}

function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
