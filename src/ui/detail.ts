import type { LayerConfig, Place } from "../data/types.ts";
import { distanceM, formatDistance, type LatLng } from "../geo/distance.ts";
import { openStatus } from "../hours/open.ts";
import { tag } from "./chips.ts";
import { detailFields, type DetailRow } from "./detail-fields.ts";
import bookmarkIcon from "./icons/bookmark.webp";
import centerIcon from "./icons/center.webp";
import directionsIcon from "./icons/directions.webp";
import linkIcon from "./icons/link.webp";
import shareIcon from "./icons/share.webp";
import starIcon from "./icons/star.webp";
import { directionsUrl, linkLabel, shareUrl } from "./links.ts";
import { showToast } from "./toast.ts";

export interface DetailHandlers {
  /** `location.origin`, for share links. */
  origin: string;
  /** Tokyo wall-clock moment to evaluate hours at; undefined means now. */
  at?: Date;
  /** The device's position, for "1.2 km away" in the meta line. */
  from?: LatLng;
}

const FLAG_TEXT = { approximate: "approximate", unverified: "unverified", unknown: "" } as const;

/** Monotonic token so a slow open-status lookup can't overwrite a newer card. */
let renderToken = 0;

/**
 * The selected place in the panel body: the rating snapshot, the notes,
 * the meta line, actions, the street-corner essentials (visible at half
 * height), then everything else. The name, Back, Bookmark and the map actions live in the panel's
 * header and footer (renderDetailStrip and the app).
 */
export function renderDetail(body: HTMLElement, place: Place, layer: LayerConfig | undefined, h: DetailHandlers): void {
  const token = ++renderToken;
  const fields = detailFields(place, layer);
  body.replaceChildren();

  const meta = document.createElement("p");
  meta.className = "detail-meta";
  const away = h.from ? `${formatDistance(distanceM(h.from, place))} away` : undefined;
  meta.textContent = [layer?.label, place.neighborhood, away].filter(Boolean).join(" · ");

  // ---- actions (Directions lives in the strip above the card) ----
  const actions = document.createElement("div");
  actions.className = "detail-actions";
  // Share copies the place's link, nothing else: no OS share sheet, no name prefix.
  actions.append(iconButton("Copy link to this place", shareIcon, () => copyToClipboard(shareUrl(place, h.origin), "Link copied")));
  // Always present so the row keeps its shape; greyed and inert when the sheet has no link.
  if (place.link) {
    actions.append(iconAnchor(linkLabel(place.link), linkIcon, place.link));
  } else {
    const none = iconButton("No link in the sheet", linkIcon, () => showToast("No link for this place"));
    none.classList.add("is-disabled");
    none.setAttribute("aria-disabled", "true");
    actions.append(none);
  }

  // ---- essentials ----
  const essentials = document.createElement("dl");
  essentials.className = "detail-rows detail-essentials";
  for (const row of fields.essentials) {
    const [dt, dd] = rowNodes(row);
    if (row.label === "Address" && place.address) {
      // Tapping the address copies it (the brief's "copy address" use, without a button).
      const address = place.address;
      dd.classList.add("copyable");
      dd.setAttribute("role", "button");
      dd.tabIndex = 0;
      dd.title = "Tap to copy";
      dd.addEventListener("click", () => copyToClipboard(address, "Address copied"));
    }
    essentials.append(dt, dd);
    if (row.label === "Hours" && place.hoursOsm) {
      const status = document.createElement("span");
      status.className = "open-status";
      dd.append(" ", status);
      void openStatus(place.hoursOsm, h.at, h.at === undefined).then((s) => {
        if (token !== renderToken) return;
        // Just the state ("Open", "Closed today"); the "until 18:00" / "opens 9:00" tail is noise next to the hours.
        status.textContent = s.label.split(" · ")[0] ?? s.label;
        status.dataset["state"] = s.state;
      });
    }
  }

  const chips = document.createElement("div");
  chips.className = "place-chips";
  for (const c of fields.chips) chips.append(tag(c));

  // ---- rating and notes first: the quickest read of what a place is like ----
  if (fields.rating) {
    const r = document.createElement("p");
    r.className = "detail-rating";
    r.textContent = fields.rating.count ? `★ ${fields.rating.value} (${formatCount(fields.rating.count)})` : `★ ${fields.rating.value}`;
    r.title = fields.rating.on ? `Google, as of ${fields.rating.on}` : "Google";
    body.append(r);
  }
  if (fields.notes) {
    const notes = document.createElement("p");
    notes.className = "detail-notes detail-notes--top";
    notes.textContent = fields.notes;
    body.append(notes);
  }

  body.append(meta, actions, essentials);
  if (fields.chips.length > 0) body.append(chips);

  // ---- details (full height) ----
  for (const section of fields.details) {
    const sec = document.createElement("section");
    sec.className = "detail-section";
    if (section.title) {
      const heading = document.createElement("h3");
      heading.textContent = section.title;
      sec.append(heading);
    }
    const notes = section.rows.length === 1 && section.rows[0]!.label === "";
    if (notes) {
      const p = document.createElement("p");
      p.className = "detail-notes";
      p.textContent = section.rows[0]!.value;
      sec.append(p);
    } else {
      const dl = document.createElement("dl");
      dl.className = "detail-rows";
      for (const row of section.rows) dl.append(...rowNodes(row));
      sec.append(dl);
    }
    body.append(sec);
  }
}

export interface DetailStripHandlers {
  /** Ease the map back to this place (after panning away). */
  onShowOnMap: () => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
}

/**
 * The panel header while a place is selected: the name (star, brand,
 * muted branch) on the left, then Directions, Show on map and Bookmark
 * as icons on the right, so every action on the place is in one row.
 */
export function renderDetailStrip(strip: HTMLElement, place: Place, h: DetailStripHandlers): void {
  strip.replaceChildren();
  const title = document.createElement("h2");
  title.className = "strip-title";
  if (place.starred) {
    const star = document.createElement("img");
    star.className = "row-mark row-mark--star";
    star.src = starIcon;
    star.alt = "Key branch";
    star.title = "Key branch";
    star.draggable = false;
    title.append(star);
  }
  title.append(place.name);

  const actions = document.createElement("div");
  actions.className = "strip-actions";
  const directions = iconAnchor("Directions", directionsIcon, directionsUrl(place));
  directions.className = "icon-button";
  // Show on map: back to the pin after panning away; the map eases, the card stays.
  const show = iconButton("Show on map", centerIcon, h.onShowOnMap);
  show.className = "icon-button";
  // Bookmark: the seal in colour when set, greyscale when not.
  const bookmarked = h.isBookmarked(place.id);
  const bookmark = iconButton(bookmarked ? "Remove bookmark" : "Bookmark this place", bookmarkIcon, () => h.onToggleBookmark(place.id));
  bookmark.className = "icon-button bookmark-button";
  bookmark.setAttribute("aria-pressed", String(bookmarked));
  actions.append(directions, show, bookmark);
  strip.append(title, actions);
}

function rowNodes(row: DetailRow): [HTMLElement, HTMLElement] {
  const dt = document.createElement("dt");
  dt.textContent = row.label;
  const dd = document.createElement("dd");
  dd.textContent = row.value;
  if (row.flag) {
    dd.dataset["flag"] = row.flag;
    const text = FLAG_TEXT[row.flag];
    if (text) dd.append(" ", tag(text, "tag tag--flag"));
  }
  return [dt, dd];
}

/** "1173" → "1,173" for the review count. */
function formatCount(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : raw;
}

function icon(src: string): HTMLImageElement {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.draggable = false;
  return img;
}

function iconButton(label: string, src: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "icon-button icon-button--action";
  b.setAttribute("aria-label", label);
  b.title = label;
  b.append(icon(src));
  b.addEventListener("click", onClick);
  return b;
}

function iconAnchor(label: string, src: string, href: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "icon-button icon-button--action";
  a.setAttribute("aria-label", label);
  a.title = label;
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.append(icon(src));
  return a;
}

/**
 * Clipboard writes need HTTPS and must start inside the tap handler;
 * iOS refuses them after an await, so nothing is awaited before this call.
 */
function copyToClipboard(text: string, done: string): void {
  if (!navigator.clipboard?.writeText) {
    showToast("Clipboard unavailable");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => showToast(done),
    () => showToast("Couldn't copy"),
  );
}

