import type { SortKey } from "../config/settings.ts";
import type { LayerConfig, Place, RegionConfig } from "../data/types.ts";
import { facetCounts, neighborhoodCounts, openNowCounts, scopedFacetValues, type HoursInput } from "../filter/apply.ts";
import { clock, DAY, tokyoNow, tokyoWallClock, wallClockString } from "../hours/open.ts";
import {
  activeFacetLayer,
  effectiveLayers,
  getSelection,
  hasActiveFilters,
  type FilterAction,
  type FilterState,
} from "../filter/state.ts";
import { chip } from "./chips.ts";

export interface FilterSheetContext {
  region: RegionConfig;
  /** The region's layers. */
  layers: LayerConfig[];
  places: Place[];
  /** This device's bookmarked place ids. */
  bookmarks: ReadonlySet<string>;
  /** Evaluated hours, once the open-now filter is on and the parser has loaded. */
  hours?: HoursInput;
  dispatch: (action: FilterAction) => void;
  /** List order (a setting, not filter state) and whether distance order is possible yet. */
  sort: SortKey;
  hasPosition: boolean;
  onSort: (sort: SortKey) => void;
}

/**
 * Rebuild the filter sheet body for a state. Neighborhood chips, the
 * starred toggle, then one section per facet of the active layer with a
 * count on every value and an include-unknown checkbox. Cheap enough to
 * rebuild on every change at this data size.
 */
export function renderFilterSheet(body: HTMLElement, state: FilterState, ctx: FilterSheetContext): void {
  const { region, places, dispatch, bookmarks } = ctx;
  const opts = { bookmarks, hours: ctx.hours };
  body.replaceChildren();

  const regionLayerIds = ctx.layers.map((l) => l.id);
  if (ctx.layers.length > 0) {
    const sec = section(
      "Layers",
      ctx.layers.map((l) =>
        chip(l.label, {
          pressed: state.layers.has(l.id),
          color: l.color,
          count: places.filter((p) => p.layerId === l.id).length,
          onClick: () => dispatch({ type: "toggleLayer", layer: l.id }),
        }),
      ),
    );
    if (state.layers.size === 0 && ctx.layers.length > 1) sec.append(note("None picked: all layers show."));
    body.append(sec);
  }

  if (region.neighborhoods.length > 0) {
    const counts = neighborhoodCounts(places, state, region.neighborhoods, opts);
    body.append(
      section(
        "Neighborhood",
        region.neighborhoods.map((n) =>
          chip(n, {
            pressed: state.neighborhoods.has(n),
            count: counts.get(n) ?? 0,
            disabled: (counts.get(n) ?? 0) === 0 && !state.neighborhoods.has(n),
            onClick: () => dispatch({ type: "toggleNeighborhood", neighborhood: n }),
          }),
        ),
      ),
    );
  }

  // Sort: a preference rather than a filter, but it belongs with "what am I looking at".
  const byDistance = ctx.sort === "distance" && ctx.hasPosition;
  body.append(
    section("Sort", [
      chip("Name", { pressed: !byDistance, onClick: () => ctx.onSort("name") }),
      chip(ctx.hasPosition ? "Distance" : "Distance · locate first", {
        pressed: byDistance,
        disabled: !ctx.hasPosition,
        onClick: () => ctx.onSort("distance"),
      }),
    ]),
  );

  const bookmarkedInRegion = places.filter((p) => p.region === region.id && bookmarks.has(p.id)).length;
  body.append(
    section("Flags", [
      chip("★ Key branches only", {
        pressed: state.starredOnly,
        onClick: () => dispatch({ type: "setStarredOnly", value: !state.starredOnly }),
      }),
      chip(bookmarkedInRegion === 0 && !state.bookmarkedOnly ? "Bookmarked only · none yet" : "Bookmarked only", {
        pressed: state.bookmarkedOnly,
        count: bookmarkedInRegion,
        disabled: bookmarkedInRegion === 0 && !state.bookmarkedOnly,
        onClick: () => dispatch({ type: "setBookmarkedOnly", value: !state.bookmarkedOnly }),
      }),
      openNowChip(state, places, opts, dispatch),
    ]),
  );
  if (state.openNow) body.append(openNowDetails(state, places, opts, dispatch));

  const activeId = activeFacetLayer(state, regionLayerIds);
  const layer = ctx.layers.find((l) => l.id === activeId);
  if (layer) {
    const counts = facetCounts(places, state, layer, opts);
    for (const facet of layer.facets) {
      const count = counts.get(facet.column);
      if (!count) continue;
      const sel = getSelection(state, layer.id, facet.column);
      // A scoped facet (Specialty by Kind) offers only the values the chosen kinds actually have.
      const inScope = scopedFacetValues(places, state, layer, facet);
      const offered = [...count.values].filter(([value]) => !inScope || inScope.has(value) || sel.values.has(value));
      const chips = offered.map(([value, n]) =>
        chip(value, {
          pressed: sel.values.has(value),
          count: n,
          disabled: n === 0 && !sel.values.has(value),
          onClick: () => dispatch({ type: "toggleFacetValue", layer: layer.id, column: facet.column, value }),
        }),
      );
      const sec = section(facet.label ?? facet.column, chips);
      if (count.unknown > 0 || !sel.includeUnknown) {
        sec.append(
          unknownToggle(count.unknown, sel.includeUnknown, (value) =>
            dispatch({ type: "setIncludeUnknown", layer: layer.id, column: facet.column, value }),
          ),
        );
      }
      body.append(sec);
    }
  } else if (effectiveLayers(state, regionLayerIds).size > 1) {
    body.append(note("Pick a single layer to filter by its details."));
  }

  if (hasActiveFilters(state)) {
    const clear = chip("Clear all filters", { className: "clear", onClick: () => dispatch({ type: "clearFilters" }) });
    const wrap = document.createElement("div");
    wrap.className = "sheet-actions";
    wrap.append(clear);
    body.append(wrap);
  }
}

type Opts = { bookmarks: ReadonlySet<string>; hours?: HoursInput };

function openNowChip(state: FilterState, places: Place[], opts: Opts, dispatch: (a: FilterAction) => void): HTMLElement {
  const at = tokyoWallClock(state.openAt);
  const label = at ? `Open ${DAY[at.getDay()]} ${clock(at)}` : "Open now";
  const counts = opts.hours ? openNowCounts(places, state, opts) : undefined;
  return chip(label, {
    pressed: state.openNow,
    ...(counts ? { count: counts.open } : {}),
    onClick: () => dispatch({ type: "setOpenNow", value: !state.openNow }),
  });
}

/** Under the Open now chip: the unknown-hours toggle and the "open at" pickers. */
function openNowDetails(state: FilterState, places: Place[], opts: Opts, dispatch: (a: FilterAction) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "open-now-details";

  const counts = opts.hours ? openNowCounts(places, state, opts) : undefined;
  wrap.append(
    unknownToggle(counts?.unknown ?? 0, state.includeUnknownHours, (value) => dispatch({ type: "setIncludeUnknownHours", value }), "Include unknown hours"),
  );
  if (!opts.hours) wrap.append(note("Checking hours…"));

  // "Open at…": the phone's own date and time pickers; one empty half is filled from Tokyo's current time.
  const at = tokyoWallClock(state.openAt);
  const row = document.createElement("div");
  row.className = "open-at";
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
    const now = wallClockString(tokyoNow());
    const d = date.value || now.slice(0, 10);
    const t = time.value || now.slice(11, 16);
    if (!date.value && !time.value) return;
    dispatch({ type: "setOpenAt", value: `${d}T${t}` });
  };
  date.addEventListener("change", commit);
  time.addEventListener("change", commit);
  row.append(title, date, time);
  if (at) {
    row.append(
      chip("Now", {
        className: "clear",
        onClick: () => dispatch({ type: "setOpenAt", value: undefined }),
      }),
    );
  }
  wrap.append(row);
  return wrap;
}

function section(title: string, chips: HTMLElement[]): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "filter-section";
  const h = document.createElement("h3");
  h.textContent = title;
  const row = document.createElement("div");
  row.className = "chip-row";
  row.append(...chips);
  sec.append(h, row);
  return sec;
}

function unknownToggle(n: number, checked: boolean, onChange: (value: boolean) => void, text = "Include unknown"): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "unknown-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input, ` ${text} (${n})`);
  return label;
}

function note(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = text;
  return p;
}
