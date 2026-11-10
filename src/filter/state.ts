import type { LayerConfig, Place, RegionId } from "../data/types.ts";

/**
 * Filter state and its transitions. Pure: no DOM, no storage. The list,
 * the map and the URL all derive from one FilterState.
 *
 * Three groups, each a union inside and ANDed together
 * (docs/proposals/filters-and-areas.md): categories (what), areas
 * (where), flags (narrow). None selected in a group means everything.
 * Nothing here depends on another selection: filters do not cascade.
 * The two filter pages (docs/proposals/filter-pages-and-area-map.md)
 * split them: Filters holds the flags and categories, Area the areas.
 */
export interface FilterState {
  region: RegionId;
  /** Category chips: "layer/Kind" for a layer with kinds, the bare layer id for one without. Empty = every category. */
  categories: Set<string>;
  /** Area chips picked by hand (src/data/areas.ts). Empty, with Here off, = everywhere. */
  areas: Set<string>;
  /** Pick the area chip you are in (resolved from the position by the app). */
  here: boolean;
  /** + Adjacent: add the chips next to everything picked (one hop on the area graph). */
  adjacent: boolean;
  /** Nearby: only places within this many metres of you; undefined = off. */
  nearby?: number;
  text: string;
  starredOnly: boolean;
  /** Only the device's bookmarked places (the set itself lives outside this state). */
  bookmarkedOnly: boolean;
  /** Only places open (at `openAt`, else now) in Tokyo time; unknown hours stay in, sunk to the end. */
  openNow: boolean;
  /** "YYYY-MM-DDTHH:MM" Tokyo wall clock to evaluate at instead of now. */
  openAt?: string;
}

/** The state each filter page owns: Filters (flags and categories) and Area. */
export type FilterGroup = "filters" | "area";

export type FilterAction =
  | { type: "setRegion"; region: RegionId }
  | { type: "toggleCategory"; category: string }
  /** A layer header: every one of its kinds on, or all off. */
  | { type: "setCategories"; categories: string[]; on: boolean }
  | { type: "toggleArea"; area: string }
  /** A ward heading: every chip under it on, or all off. */
  | { type: "setAreas"; areas: string[]; on: boolean }
  /** The outcome of tapping an area (src/filter/apply.ts tapArea): the picks, Here and + Adjacent at once. */
  | { type: "setAreaChoice"; areas: string[]; here: boolean; adjacent: boolean }
  | { type: "setHere"; value: boolean }
  | { type: "setAdjacent"; value: boolean }
  | { type: "setNearby"; value: number | undefined }
  | { type: "setText"; text: string }
  | { type: "setStarredOnly"; value: boolean }
  | { type: "setBookmarkedOnly"; value: boolean }
  | { type: "setOpenNow"; value: boolean }
  | { type: "setOpenAt"; value: string | undefined }
  /** A page's Clear: that page's selections only. */
  | { type: "clearGroup"; group: FilterGroup }
  | { type: "clearFilters" };

export function layersInRegion(layers: LayerConfig[], region: RegionId): LayerConfig[] {
  // A layer with no fixed region spans every region (its rows say which).
  return layers.filter((l) => l.region === undefined || l.region === region);
}

/** A layer's category chips: one per kind ("drinks/Coffee"), or the layer itself when it has none. */
export function categoriesOf(layer: LayerConfig): string[] {
  return layer.kinds && layer.kinds.length > 0 ? layer.kinds.map((k) => `${layer.id}/${k}`) : [layer.id];
}

/**
 * The category chips with at least one place in the region: "layer/Kind"
 * for each kind a place has, the layer id for a layer without kinds. The
 * Filters page shows only these, so a city never offers a kind it has
 * none of (Tokyo has no tofu places; 2026-11-10).
 */
export function categoriesPresent(places: readonly Place[], layers: readonly LayerConfig[], region: RegionId): Set<string> {
  const withKinds = new Set(layers.filter((l) => l.kinds && l.kinds.length > 0).map((l) => l.id));
  const present = new Set<string>();
  for (const p of places) {
    if (p.region !== region) continue;
    if (!withKinds.has(p.layerId)) present.add(p.layerId);
    else for (const k of p.kinds) present.add(`${p.layerId}/${k}`);
  }
  return present;
}

/** The layers with anything selected, or every layer when no category is. */
export function layersInPlay(state: FilterState, layers: LayerConfig[]): LayerConfig[] {
  if (state.categories.size === 0) return layers;
  return layers.filter((l) => state.categories.has(l.id) || categoriesOf(l).some((c) => state.categories.has(c)));
}

/** Nothing selected: everything in the region shows. */
export function defaultState(region: RegionId): FilterState {
  return {
    region,
    categories: new Set(),
    areas: new Set(),
    here: false,
    adjacent: false,
    text: "",
    starredOnly: false,
    bookmarkedOnly: false,
    openNow: false,
  };
}

/**
 * Whether a page has anything that narrows the results: its footer dot
 * and its Clear. + Adjacent alone narrows nothing, so it doesn't count.
 */
export function hasGroupSelection(state: FilterState, group: FilterGroup): boolean {
  if (group === "area") return state.areas.size > 0 || state.here;
  return (
    state.categories.size > 0 ||
    state.starredOnly ||
    state.bookmarkedOnly ||
    state.openNow ||
    state.openAt !== undefined ||
    state.nearby !== undefined
  );
}

/** True when anything narrows the results, search included. Drives the empty state's Clear filters. */
export function hasActiveFilters(state: FilterState): boolean {
  return state.text !== "" || hasGroupSelection(state, "filters") || hasGroupSelection(state, "area");
}

export function reduce(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "setRegion":
      return action.region === state.region ? state : defaultState(action.region);
    case "toggleCategory":
      return { ...state, categories: toggled(state.categories, action.category) };
    case "setCategories":
      return { ...state, categories: withAll(state.categories, action.categories, action.on) };
    case "toggleArea":
      return { ...state, areas: toggled(state.areas, action.area) };
    case "setAreas":
      return { ...state, areas: withAll(state.areas, action.areas, action.on) };
    case "setAreaChoice":
      return { ...state, areas: new Set(action.areas), here: action.here, adjacent: action.adjacent };
    case "setHere":
      return { ...state, here: action.value };
    case "setAdjacent":
      return { ...state, adjacent: action.value };
    case "setNearby":
      return withOptional(state, "nearby", action.value);
    case "setText":
      return { ...state, text: action.text };
    case "setStarredOnly":
      return { ...state, starredOnly: action.value };
    case "setBookmarkedOnly":
      return { ...state, bookmarkedOnly: action.value };
    case "setOpenNow":
      return { ...state, openNow: action.value };
    case "setOpenAt":
      return withOptional(state, "openAt", action.value);
    case "clearGroup": {
      const fresh = defaultState(state.region);
      if (action.group === "area") return { ...state, areas: fresh.areas, here: false, adjacent: false };
      const { nearby: _n, openAt: _a, ...rest } = state;
      return { ...rest, categories: fresh.categories, starredOnly: false, bookmarkedOnly: false, openNow: false };
    }
    case "clearFilters":
      return defaultState(state.region);
  }
}

function toggled<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

function withAll<T>(set: Set<T>, items: T[], on: boolean): Set<T> {
  const next = new Set(set);
  for (const item of items) {
    if (on) next.add(item);
    else next.delete(item);
  }
  return next;
}

/** Set an optional key, or remove it for undefined, so a cleared state equals a fresh one. */
function withOptional<K extends "nearby" | "openAt">(state: FilterState, key: K, value: FilterState[K] | undefined): FilterState {
  const next = { ...state };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}
