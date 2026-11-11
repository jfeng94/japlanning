import type { TransitLine } from "../config/transit.ts";
import type { TransitStationProps } from "../data/transit.ts";
import { iconAnchor, iconButton } from "./detail.ts";
import centerIcon from "./icons/center.webp";
import directionsIcon from "./icons/directions.webp";
import { directionsUrl } from "./links.ts";

/**
 * A subway station's card (docs/proposals/m8-transit.md, "Part 2,
 * revised"): the facts for planning a trip through it. Stations aren't
 * places: they never join the list or search, have no bookmark and no
 * Prev/Next. Train times and amenities come later (ODPT); until then the
 * card says so.
 */
export interface StationCard {
  props: TransitStationProps;
  /** [lng, lat] */
  at: [number, number];
  /** The lines that stop here, in config order. */
  lines: TransitLine[];
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

/** The card's body: what it is, Show on map, the lines, and a note for what isn't in yet. */
export function renderStationCard(body: HTMLElement, station: StationCard, onShowOnMap: () => void): void {
  body.replaceChildren();
  const meta = document.createElement("p");
  meta.className = "detail-meta";
  const n = station.lines.length;
  meta.textContent = `Subway station · ${n} line${n === 1 ? "" : "s"}`;

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  actions.append(iconButton("Show on map", centerIcon, onShowOnMap));

  // One row per line: room for that line's first and last trains once they're in.
  const lines = document.createElement("ul");
  lines.className = "station-lines";
  for (const line of station.lines) {
    const li = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = "line-badge";
    badge.style.background = line.colour;
    badge.textContent = line.code;
    const name = document.createElement("span");
    name.textContent = line.label;
    li.append(badge, name);
    lines.append(li);
  }

  const later = document.createElement("p");
  later.className = "note";
  later.textContent = "First and last trains and the station's amenities aren't in yet.";

  body.append(meta, actions, lines, later);
}
