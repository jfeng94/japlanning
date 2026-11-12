import type { AreaColour, RegionColours } from "../config/area-colors.ts";
import { iconAssetUrl, isIconId } from "../config/icons.ts";
import type { AreaIndex } from "../data/areas.ts";
import type { LayerConfig } from "../data/types.ts";
import { areaLook } from "../filter/apply.ts";
import { categoriesOf, type FilterAction, type FilterState } from "../filter/state.ts";
import { formatRadius, NEARBY_STOPS, walkMinutes } from "../geo/nearby.ts";
import { clock, DAY, tokyoNow, tokyoWallClock, wallClockString } from "../hours/open.ts";
import { chip } from "./chips.ts";

/**
 * The two filter pages, shown in the strip at Half
 * (docs/proposals/filter-pages-and-area-map.md): Filters (Show only and
 * Category) and Area. Filters do not cascade: nothing here appears,
 * disappears, greys out or recounts because of another selection; the
 * feedback is the count in the page's header. Rebuilt on every change,
 * which is cheap at this size.
 */
export type FilterPage = "filters" | "area";

export const PAGE_TITLES: Record<FilterPage, string> = { filters: "Filters", area: "Area" };

const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/** A chip the app labels from the position: Here and Nearby. */
export interface PositionChip {
  /** "Here · Shibuya", "Nearby · 1 km", "… · locating…". */
  label: string;
  /** Here only: the area chip it stands for, when it resolves to one. */
  group?: string;
}

export interface PageContext {
  /** The region's layers. */
  layers: LayerConfig[];
  /**
   * The category chips with a place in the region (categoriesPresent);
   * the others are hidden, and a layer with none at all. Undefined while
   * nothing has loaded: every chip shows.
   */
  present?: ReadonlySet<string>;
  /** The region's areas. */
  areas: AreaIndex;
  /** Their colours, shared with the map, so each chip is the legend for its shape. */
  colours?: RegionColours;
  /** Here and Nearby, offered while the Location setting is on; undefined hides them. */
  here?: PositionChip;
  nearby?: PositionChip;
  onHere(on: boolean): void;
  onNearby(on: boolean): void;
  /** The radius slider: `final` is false while dragging (the map circle follows), true when let go. */
  onRadius(metres: number, final: boolean): void;
  /** An area chip tapped; the app applies tapArea's outcome. */
  onAreaTap(chip: string): void;
  /** Whether the page has anything to clear, and Clear itself (that page's selections only). */
  canClear: boolean;
  onClear(): void;
  dispatch(action: FilterAction): void;
}

/** The page's header in the strip: its name and the live count, with an X in the upper right that closes it. */
export function renderPageStrip(strip: HTMLElement, page: FilterPage, count: string, onClose: () => void): void {
  const title = document.createElement("p");
  title.className = "page-title";
  const n = document.createElement("span");
  n.className = "page-count";
  n.textContent = count;
  title.append(PAGE_TITLES[page], " ", n);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "page-close";
  close.innerHTML = CLOSE_ICON;
  close.setAttribute("aria-label", `Close ${PAGE_TITLES[page]}`);
  close.addEventListener("click", onClose);
  strip.replaceChildren(title, close);
}

/**
 * The top of a page's body: Clear, for that page's selections, on the
 * right, after anything given to lead the row. Always in its place,
 * greyed when there is nothing to clear, so the first selection doesn't
 * push the chips down under the finger.
 */
function clearRow(page: FilterPage, ctx: PageContext, lead?: HTMLElement): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "page-top";
  if (lead) wrap.append(lead);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "page-clear";
  clear.textContent = "Clear";
  clear.disabled = !ctx.canClear;
  clear.setAttribute("aria-label", `Clear ${PAGE_TITLES[page]}`);
  clear.addEventListener("click", ctx.onClear);
  wrap.append(clear);
  return wrap;
}

/** Show only (each one on narrows the results), then Category. */
export function renderFiltersPage(body: HTMLElement, state: FilterState, ctx: PageContext): void {
  // Mid-drag on the radius slider: a rebuild would take the thumb from under the finger.
  if (body.dataset["sliding"] === "1") return;
  const { dispatch } = ctx;
  // Hide all: no places on the map or in the list, so the subway lines can be read; a category ends it.
  const hide = chip("Hide all", {
    className: "page-hide",
    pressed: state.hideAll,
    onClick: () => dispatch({ type: "setHideAll", value: !state.hideAll }),
  });
  body.replaceChildren(clearRow("filters", ctx, hide));
  const at = tokyoWallClock(state.openAt);
  const flags = [
    chip("Bookmarked", {
      pressed: state.bookmarkedOnly,
      onClick: () => dispatch({ type: "setBookmarkedOnly", value: !state.bookmarkedOnly }),
    }),
    chip(at ? `Open ${DAY[at.getDay()]} ${clock(at)}` : "Open now", {
      pressed: state.openNow,
      onClick: () => dispatch({ type: "setOpenNow", value: !state.openNow }),
    }),
  ];
  if (ctx.nearby) {
    flags.push(chip(ctx.nearby.label, { pressed: state.nearby !== undefined, onClick: () => ctx.onNearby(state.nearby === undefined) }));
  }
  flags.push(
    chip("Key branches", {
      pressed: state.starredOnly,
      onClick: () => dispatch({ type: "setStarredOnly", value: !state.starredOnly }),
    }),
  );
  const show = section("Show only", flags);
  if (state.openNow) show.append(openAtRow(state, dispatch));
  if (ctx.nearby && state.nearby !== undefined) show.append(radiusRow(body, state.nearby, ctx));
  body.append(show);
  if (ctx.layers.length > 0) body.append(categorySection(state, ctx));
}

/**
 * Here and + Adjacent, then the chips under their ward headings (a
 * heading picks or clears its chips). Each chip shows its area's look in
 * its area's colour, as the map draws it: outlined when out, filled when
 * picked, hatched (and marked ∗) when added by + Adjacent.
 */
export function renderAreaPage(body: HTMLElement, state: FilterState, ctx: PageContext): void {
  body.replaceChildren(clearRow("area", ctx));
  const { areas, dispatch } = ctx;
  const lookOpts = { hereGroup: ctx.here?.group, areas };
  const colourOf = (label: string | undefined): AreaColour | undefined => (label === undefined ? undefined : ctx.colours?.chips.get(label));

  const top: HTMLElement[] = [];
  if (ctx.here) {
    // Here takes the colour of the area it resolves to, and stays neutral until it does.
    top.push(tint(chip(ctx.here.label, { pressed: state.here, className: "here-chip", onClick: () => ctx.onHere(!state.here) }), colourOf(ctx.here.group)));
  }
  top.push(chip("+ Adjacent", { pressed: state.adjacent, onClick: () => dispatch({ type: "setAdjacent", value: !state.adjacent }) }));
  body.append(row(top, "area-tools"));

  for (const s of areas.sections) {
    const labels = s.chips.map((c) => c.label);
    if (s.label) {
      const all = labels.every((l) => state.areas.has(l));
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "area-heading";
      const swatch = ctx.colours?.sections.get(s.label);
      if (swatch) {
        const dot = document.createElement("span");
        dot.className = "area-swatch";
        dot.style.background = swatch.fill;
        heading.append(dot);
      }
      heading.append(s.label);
      heading.setAttribute("aria-pressed", String(all));
      heading.setAttribute("aria-label", `${all ? "Clear" : "Pick"} every area in ${s.label}`);
      heading.addEventListener("click", () => dispatch({ type: "setAreas", areas: labels, on: !all }));
      body.append(heading);
    }
    body.append(
      row(
        s.chips.map((c) => {
          const look = areaLook(state, c.label, lookOpts);
          const b = chip(look === "added" ? `∗ ${c.label}` : c.label, {
            pressed: look === "picked",
            ...(look === "added" ? { className: "is-added" } : {}),
            onClick: () => ctx.onAreaTap(c.label),
          });
          if (look === "added") b.setAttribute("aria-label", `${c.label}, added by + Adjacent`);
          return tint(b, colourOf(c.label));
        }),
      ),
    );
  }
}

/**
 * Each layer as the Area page lays out a ward section (2026-11-10): a
 * heading with the layer's icon that picks or clears all of its kinds,
 * then a chip per kind. A layer without kinds is one category: its one
 * chip carries the layer's name, so its state shows as plainly as a kind's.
 * Only chips with a place in the city show (`present`), plus any selected
 * one, so a shared link's selection can still be turned off.
 */
function categorySection(state: FilterState, ctx: PageContext): HTMLElement {
  const { dispatch } = ctx;
  const sec = section("Category");
  for (const layer of ctx.layers) {
    const own = categoriesOf(layer);
    const shown = new Set(own.filter((c) => !ctx.present || ctx.present.has(c) || state.categories.has(c)));
    if (shown.size === 0) continue;
    // The heading reads as on when every kind shown is; it still picks or clears all of them.
    const all = [...shown].every((c) => state.categories.has(c));
    const heading = document.createElement("button");
    heading.type = "button";
    heading.className = "area-heading category-heading";
    const icon = document.createElement("img");
    icon.alt = "";
    icon.draggable = false;
    icon.src = iconAssetUrl(isIconId(layer.icon) ? layer.icon : "question");
    heading.append(icon, layer.label);
    heading.setAttribute("aria-pressed", String(all));
    heading.setAttribute("aria-label", `${all ? "Clear" : "Pick"} every kind of ${layer.label}`);
    heading.addEventListener("click", () => dispatch({ type: "setCategories", categories: own, on: !all }));

    const kinds = layer.kinds && layer.kinds.length > 0 ? layer.kinds.filter((k) => shown.has(`${layer.id}/${k}`)) : undefined;
    const chips = kinds
      ? kinds.map((kind) => {
          const category = `${layer.id}/${kind}`;
          return chip(kind, { pressed: state.categories.has(category), onClick: () => dispatch({ type: "toggleCategory", category }) });
        })
      : [chip(layer.label, { pressed: all, onClick: () => dispatch({ type: "setCategories", categories: own, on: !all }) })];
    sec.append(heading, row(chips));
  }
  return sec;
}

/**
 * Under Nearby: the radius on a slider that snaps to the stops, with the
 * walk it means. Dragging moves the map's circle; letting go applies it.
 */
function radiusRow(body: HTMLElement, radius: number, ctx: PageContext): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "radius-row";
  const input = document.createElement("input");
  input.type = "range";
  input.className = "radius-input";
  input.min = "0";
  input.max = String(NEARBY_STOPS.length - 1);
  input.step = "1";
  input.value = String(Math.max(0, (NEARBY_STOPS as readonly number[]).indexOf(radius)));
  input.setAttribute("aria-label", "Nearby radius");
  const label = document.createElement("span");
  label.className = "radius-label";
  wrap.append(input, label);

  const metres = (): number => NEARBY_STOPS[Number(input.value)] ?? radius;
  const show = (): void => {
    const m = metres();
    label.textContent = `${formatRadius(m)} · about ${walkMinutes(m)} min on foot`;
    input.setAttribute("aria-valuetext", label.textContent);
  };
  let committed = radius;
  const commit = (): void => {
    delete body.dataset["sliding"];
    const m = metres();
    if (m === committed) return;
    committed = m;
    ctx.onRadius(m, true);
  };
  input.addEventListener("pointerdown", () => {
    body.dataset["sliding"] = "1";
    window.addEventListener("pointerup", commit, { once: true });
    window.addEventListener("pointercancel", commit, { once: true });
  });
  input.addEventListener("input", () => {
    show();
    ctx.onRadius(metres(), false);
  });
  // Keyboards and VoiceOver change it without a pointer.
  input.addEventListener("change", commit);
  show();
  return wrap;
}

/** Under Open now: the phone's own date and time pickers; one empty half is filled from Tokyo's current time. */
function openAtRow(state: FilterState, dispatch: (a: FilterAction) => void): HTMLElement {
  const at = tokyoWallClock(state.openAt);
  const wrap = document.createElement("div");
  wrap.className = "open-at";
  const title = document.createElement("span");
  title.className = "open-at-label";
  title.textContent = "Open at";
  const date = document.createElement("input");
  date.type = "date";
  date.className = "open-at-input";
  const time = document.createElement("input");
  time.type = "time";
  time.className = "open-at-input";
  if (at) {
    const s = wallClockString(at);
    date.value = s.slice(0, 10);
    time.value = s.slice(11, 16);
  }
  const commit = () => {
    if (!date.value && !time.value) return;
    const now = wallClockString(tokyoNow());
    dispatch({ type: "setOpenAt", value: `${date.value || now.slice(0, 10)}T${time.value || now.slice(11, 16)}` });
  };
  date.addEventListener("change", commit);
  time.addEventListener("change", commit);
  wrap.append(title, date, time);
  if (at) wrap.append(chip("Now", { className: "clear", onClick: () => dispatch({ type: "setOpenAt", value: undefined }) }));
  return wrap;
}

/**
 * Colour a chip as its area (the CSS in .chip.area-chip reads these): the
 * outline per theme, the fill when picked, the stripes when added. Without
 * a colour the chip stays neutral.
 */
function tint(b: HTMLButtonElement, colour: AreaColour | undefined): HTMLButtonElement {
  if (!colour) return b;
  b.classList.add("area-chip");
  b.style.setProperty("--area-fill", colour.fill);
  b.style.setProperty("--area-on", colour.on);
  b.style.setProperty("--area-hatch", colour.hatch);
  b.style.setProperty("--area-line-light", colour.line.light);
  b.style.setProperty("--area-line-dark", colour.line.dark);
  return b;
}

/** A titled section; with chips, its first row. */
function section(title: string, chips?: HTMLElement[]): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "filter-section";
  const h = document.createElement("h3");
  h.textContent = title;
  sec.append(h);
  if (chips) sec.append(row(chips));
  return sec;
}

function row(chips: HTMLElement[], extraClass?: string): HTMLElement {
  const r = document.createElement("div");
  r.className = extraClass ? `chip-row ${extraClass}` : "chip-row";
  r.append(...chips);
  return r;
}
