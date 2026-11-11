import type { TransitLine } from "../config/transit.ts";
import type { DirectionTimes, LineFacts, Service, StationFacts, StationsFile, TransitStationProps } from "../data/transit.ts";
import { iconAnchor, iconButton } from "./detail.ts";
import centerIcon from "./icons/center.webp";
import directionsIcon from "./icons/directions.webp";
import { directionsUrl } from "./links.ts";

/**
 * A subway station's card (docs/proposals/m8-transit.md, "Part 2,
 * revised"): the facts for planning a trip through it. Each line that
 * stops there gets a row: its station code, and the first and last trains
 * each way (`npm run stations`). Stations aren't places: they never join
 * the list or search and have no bookmark. The footer's arrows step to the
 * next station along one line, the row marked here; tapping another row
 * switches line.
 */
export interface StationCard {
  props: TransitStationProps;
  /** [lng, lat] */
  at: [number, number];
  /** The lines that stop here, in config order. */
  lines: TransitLine[];
  /** Codes and train times, once built for this station. */
  facts?: StationFacts;
  sources: StationsFile["sources"];
  /** The line the arrows follow. */
  following: string;
}

export interface StationCardHandlers {
  onShowOnMap: () => void;
  /** A line's row tapped: the arrows follow that line. */
  onFollow: (lineId: string) => void;
}

/** The panel header: the station's marker and name on the left; Directions and the panel's chevron on the right. */
export function renderStationStrip(strip: HTMLElement, station: StationCard, toggle: HTMLElement): void {
  strip.replaceChildren();
  const mark = document.createElement("span");
  mark.className = "station-mark";
  mark.setAttribute("aria-hidden", "true");

  const title = document.createElement("h2");
  title.className = "strip-title";
  title.append(station.props.en);
  if (station.props.name !== station.props.en) {
    const ja = document.createElement("span");
    ja.className = "strip-title-ja";
    ja.lang = "ja";
    ja.textContent = station.props.name;
    title.append(" ", ja);
  }

  const lead = document.createElement("div");
  lead.className = "strip-lead";
  lead.append(mark, title);

  const actions = document.createElement("div");
  actions.className = "strip-actions";
  const [lng, lat] = station.at;
  const directions = iconAnchor("Directions", directionsIcon, directionsUrl({ lat, lng }));
  directions.className = "icon-button";
  actions.append(directions, toggle);
  strip.append(lead, actions);
}

/** The card's body: what it is, Show on map, a row per line with its times, then the credit or what isn't in yet. */
export function renderStationCard(body: HTMLElement, station: StationCard, h: StationCardHandlers): void {
  body.replaceChildren();
  const meta = document.createElement("p");
  meta.className = "detail-meta";
  const n = station.lines.length;
  meta.textContent = `Subway station · ${n} line${n === 1 ? "" : "s"}`;

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  actions.append(iconButton("Show on map", centerIcon, h.onShowOnMap));

  const lines = document.createElement("ul");
  lines.className = "station-lines";
  const choosing = station.lines.length > 1;
  for (const line of station.lines) {
    const facts = station.facts?.lines[line.id];
    const li = document.createElement("li");
    li.className = "station-line";
    // The row's head picks the line the arrows follow, where there's a choice.
    const head = document.createElement(choosing ? "button" : "div");
    head.className = "station-line-head";
    if (head instanceof HTMLButtonElement) {
      head.type = "button";
      const on = line.id === station.following;
      head.setAttribute("aria-pressed", String(on));
      head.title = on ? "The arrows step along this line" : "Step along this line with the arrows";
      head.addEventListener("click", () => h.onFollow(line.id));
    }
    const badge = document.createElement("span");
    badge.className = "line-badge";
    badge.style.background = line.colour;
    badge.textContent = line.code;
    const name = document.createElement("span");
    name.className = "station-line-name";
    name.textContent = line.label;
    head.append(badge, name);
    if (facts?.code) {
      const code = document.createElement("span");
      code.className = "station-code";
      code.textContent = facts.code;
      head.append(code);
    }
    li.append(head);
    if (facts) li.append(timesTable(facts));
    else if (station.facts || hasAnyTimes(station)) li.append(note("Train times not in yet.", "station-line-note"));
    lines.append(li);
  }

  body.append(meta, actions, lines);
  if (!hasAnyTimes(station)) {
    body.append(note("First and last trains and the station's amenities aren't in yet."));
    return;
  }
  if (!station.facts?.amenities) body.append(note("The station's amenities aren't in yet."));
  body.append(credit(station));
}

const hasAnyTimes = (station: StationCard) => station.lines.some((l) => station.facts?.lines[l.id]);

/** "05:00" → "5:00", "00:10" → "0:10". */
export const clock = (t: string) => t.replace(/^0(\d)/, "$1");

const sameService = (a?: Service, b?: Service) => a?.first === b?.first && a?.last === b?.last && a?.lastTo === b?.lastTo;

/** First and last trains, a row per direction; weekdays and weekends split only where they differ. */
function timesTable(facts: LineFacts): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "station-times";
  table.innerHTML = `<thead><tr><th></th><th scope="col">First</th><th scope="col">Last</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const d of facts.directions) {
    for (const [day, svc] of rowsFor(d)) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      // The direction names the first row; a split's second row carries only its day.
      if (day !== "holiday" || sameService(d.weekday, d.holiday) || !d.weekday) th.append(d.label);
      if (day) {
        const tag = document.createElement("span");
        tag.className = "station-day";
        tag.textContent = day === "weekday" ? "Weekdays" : "Weekends & holidays";
        th.append(tag);
      }
      const first = document.createElement("td");
      first.textContent = clock(svc.first);
      const last = document.createElement("td");
      last.textContent = clock(svc.last);
      if (svc.lastTo) {
        const to = document.createElement("span");
        to.className = "station-last-to";
        to.textContent = `to ${svc.lastTo}`;
        last.append(" ", to);
      }
      tr.append(th, first, last);
      tbody.append(tr);
    }
  }
  table.append(tbody);
  return table;
}

/** One row when the days agree (no day named), else a row each; a day with no timetable is left out. */
function rowsFor(d: DirectionTimes): ["weekday" | "holiday" | undefined, Service][] {
  if (d.weekday && d.holiday && sameService(d.weekday, d.holiday)) return [[undefined, d.weekday]];
  const rows: ["weekday" | "holiday" | undefined, Service][] = [];
  if (d.weekday) rows.push(["weekday", d.weekday]);
  if (d.holiday) rows.push(["holiday", d.holiday]);
  return rows;
}

/** Where the times come from, and the disclaimer ODPT's licence asks for. */
function credit(station: StationCard): HTMLParagraphElement {
  const used = station.lines.flatMap((l) => {
    const f = station.facts?.lines[l.id];
    return f ? [f] : [];
  });
  const bySource = new Map<string, Set<string>>();
  for (const f of used) {
    const dates = bySource.get(f.source) ?? new Set<string>();
    if (f.from) dates.add(f.from);
    bySource.set(f.source, dates);
  }
  const parts = [...bySource].map(([id, dates]) => {
    const s = station.sources[id];
    const who = s ? `${s.label}, ${s.licence}` : id;
    const when = [...dates].sort().map(formatDate);
    return when.length ? `${who}; timetable${when.length > 1 ? "s" : ""} from ${when.join(" and ")}` : who;
  });
  return note(
    `Train times: ${parts.join(". ")}, via the Public Transportation Open Data Center (ODPT). ODPT and the operators aren't responsible for their accuracy.`,
    "station-credit",
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2025-03-15" → "15 Mar 2025". */
const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
};

function note(text: string, extra = ""): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = `note ${extra}`.trim();
  p.textContent = text;
  return p;
}
