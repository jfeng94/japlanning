import type { AreaIndex } from "../data/areas.ts";
import type { LayerConfig } from "../data/types.ts";
import { areaScope } from "../filter/apply.ts";
import { categoriesOf, hasActiveFilters, type FilterAction, type FilterState } from "../filter/state.ts";
import { clock, DAY, tokyoNow, tokyoWallClock, wallClockString } from "../hours/open.ts";
import { chip } from "./chips.ts";

/** The Here chip as the app resolves it from the position. */
export interface HereChip {
  /** "Here", "Here · Shibuya", "Here · locating…", "Here · outside Tokyo". */
  label: string;
  /** The area chip Here stands for, when it resolves to one. */
  group?: string;
}

export interface FilterSheetContext {
  /** The region's layers. */
  layers: LayerConfig[];
  /** The region's areas. */
  areas: AreaIndex;
  /** Offered while the Location setting is on; undefined hides it. */
  here?: HereChip;
  /** Here tapped; the app starts locating when it has no fix. */
  onHere: (on: boolean) => void;
  dispatch: (action: FilterAction) => void;
}

/**
 * The filter sheet: flags, areas, categories (docs/proposals/filters-and-areas.md).
 * Filters do not cascade: nothing here appears, disappears, greys out or
 * recounts because of another selection. The feedback is the result count
 * in the strip. Rebuilt on every change, which is cheap at this size.
 */
export function renderFilterSheet(body: HTMLElement, state: FilterState, ctx: FilterSheetContext): void {
  const { dispatch } = ctx;
  body.replaceChildren();

  // Flags: each one on narrows the results.
  const at = tokyoWallClock(state.openAt);
  const flags = section("Show only", [
    chip("Bookmarked", {
      pressed: state.bookmarkedOnly,
      onClick: () => dispatch({ type: "setBookmarkedOnly", value: !state.bookmarkedOnly }),
    }),
    chip(at ? `Open ${DAY[at.getDay()]} ${clock(at)}` : "Open now", {
      pressed: state.openNow,
      onClick: () => dispatch({ type: "setOpenNow", value: !state.openNow }),
    }),
    chip("Key branches", {
      pressed: state.starredOnly,
      onClick: () => dispatch({ type: "setStarredOnly", value: !state.starredOnly }),
    }),
  ]);
  if (state.openNow) flags.append(openAtRow(state, dispatch));
  body.append(flags);

  if (ctx.areas.chips.length > 0) body.append(areaSection(state, ctx));
  if (ctx.layers.length > 0) body.append(categorySection(state, ctx));

  if (hasActiveFilters(state)) {
    const wrap = document.createElement("div");
    wrap.className = "sheet-actions";
    wrap.append(chip("Clear all filters", { className: "clear", onClick: () => dispatch({ type: "clearFilters" }) }));
    body.append(wrap);
  }
}

/**
 * Here, then the chips under their ward headings (a heading selects or
 * clears its chips), then Include nearby. A chip that Here or Include
 * nearby pulls in gets a dotted outline without becoming selected, so the
 * result count is explainable.
 */
function areaSection(state: FilterState, ctx: FilterSheetContext): HTMLElement {
  const { areas, dispatch } = ctx;
  const sec = section("Area");
  const scope = areaScope(state, { hereGroup: ctx.here?.group, areas });
  const pulled = (label: string) => !state.areas.has(label) && (scope?.chosen.has(label) || scope?.nearby.has(label)) === true;

  if (ctx.here) {
    sec.append(row([chip(ctx.here.label, { pressed: state.here, className: "here-chip", onClick: () => ctx.onHere(!state.here) })]));
  }
  for (const s of areas.sections) {
    const labels = s.chips.map((c) => c.label);
    if (s.label) {
      const all = labels.every((l) => state.areas.has(l));
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "area-heading";
      heading.textContent = s.label;
      heading.setAttribute("aria-pressed", String(all));
      heading.setAttribute("aria-label", `${all ? "Clear" : "Select"} every area in ${s.label}`);
      heading.addEventListener("click", () => dispatch({ type: "setAreas", areas: labels, on: !all }));
      sec.append(heading);
    }
    sec.append(
      row(
        s.chips.map((c) =>
          chip(c.label, {
            pressed: state.areas.has(c.label),
            ...(pulled(c.label) ? { className: "is-pulled" } : {}),
            onClick: () => dispatch({ type: "toggleArea", area: c.label }),
          }),
        ),
      ),
    );
  }
  sec.append(switchRow("Include nearby areas", state.nearby, (value) => dispatch({ type: "setNearby", value })));
  return sec;
}

/** One row per layer: its header chip (every kind on or off), then a chip per kind. */
function categorySection(state: FilterState, ctx: FilterSheetContext): HTMLElement {
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

function row(chips: HTMLElement[]): HTMLElement {
  const r = document.createElement("div");
  r.className = "chip-row";
  r.append(...chips);
  return r;
}

/** A labelled on/off switch: a real checkbox (keyboard, VoiceOver) drawn as a track and knob. */
function switchRow(text: string, checked: boolean, onChange: (value: boolean) => void): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "switch-row";
  const span = document.createElement("span");
  span.textContent = text;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "switch-input";
  input.setAttribute("role", "switch");
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const track = document.createElement("span");
  track.className = "switch";
  track.setAttribute("aria-hidden", "true");
  label.append(span, input, track);
  return label;
}
