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
  /** The region's areas. */
  areas: AreaIndex;
  /** Here and Nearby, offered while the Location setting is on; undefined hides them. */
  here?: PositionChip;
  nearby?: PositionChip;
  onHere(on: boolean): void;
  onNearby(on: boolean): void;
  /** The radius slider: `final` is false while dragging (the map circle follows), true when let go. */
  onRadius(metres: number, final: boolean): void;
  /** An area chip tapped; the app applies tapArea's outcome. */
  onAreaTap(chip: string): void;
  dispatch(action: FilterAction): void;
}

/** The page's header in the strip: its name and the live count, with Clear in the upper right. */
export function renderPageStrip(strip: HTMLElement, page: FilterPage, count: string, canClear: boolean, onClear: () => void): void {
  const title = document.createElement("p");
  title.className = "page-title";
  const n = document.createElement("span");
  n.className = "page-count";
  n.textContent = count;
  title.append(PAGE_TITLES[page], " ", n);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "page-clear";
  clear.textContent = "Clear";
  clear.hidden = !canClear;
  clear.setAttribute("aria-label", `Clear the ${PAGE_TITLES[page]} page`);
  clear.addEventListener("click", onClear);
  strip.replaceChildren(title, clear);
}

/** Show only (each one on narrows the results), then Category. */
export function renderFiltersPage(body: HTMLElement, state: FilterState, ctx: PageContext): void {
  // Mid-drag on the radius slider: a rebuild would take the thumb from under the finger.
  if (body.dataset["sliding"] === "1") return;
  body.replaceChildren();
  const { dispatch } = ctx;
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
 * heading picks or clears its chips). Each chip shows its area's look:
 * picked (filled), added by + Adjacent (hatched, marked ∗), or out.
 */
export function renderAreaPage(body: HTMLElement, state: FilterState, ctx: PageContext): void {
  body.replaceChildren();
  const { areas, dispatch } = ctx;
  const lookOpts = { hereGroup: ctx.here?.group, areas };

  const top: HTMLElement[] = [];
  if (ctx.here) top.push(chip(ctx.here.label, { pressed: state.here, className: "here-chip", onClick: () => ctx.onHere(!state.here) }));
  top.push(chip("+ Adjacent", { pressed: state.adjacent, onClick: () => dispatch({ type: "setAdjacent", value: !state.adjacent }) }));
  body.append(row(top, "area-tools"));

  for (const s of areas.sections) {
    const labels = s.chips.map((c) => c.label);
    if (s.label) {
      const all = labels.every((l) => state.areas.has(l));
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "area-heading";
      heading.textContent = s.label;
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
          return b;
        }),
      ),
    );
  }
}

/** One row per layer: its header chip (every kind on or off), then a chip per kind. */
function categorySection(state: FilterState, ctx: PageContext): HTMLElement {
  const { dispatch } = ctx;
  const sec = section("Category");
  for (const layer of ctx.layers) {
    const own = categoriesOf(layer);
    const all = own.every((c) => state.categories.has(c));
    const chips = [
      chip(layer.label, {
        pressed: all,
        color: layer.color,
        className: "category-header",
        onClick: () => dispatch({ type: "setCategories", categories: own, on: !all }),
      }),
    ];
    for (const kind of layer.kinds ?? []) {
      const category = `${layer.id}/${kind}`;
      chips.push(
        chip(kind, {
          pressed: state.categories.has(category),
          onClick: () => dispatch({ type: "toggleCategory", category }),
        }),
      );
    }
    sec.append(row(chips));
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
