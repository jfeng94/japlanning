import type { LayerConfig, RegionId } from "../data/types.ts";

/**
 * Filter state and its transitions. Pure: no DOM, no storage. The list,
 * the map and the URL all derive from one FilterState.
 *
 * Three groups, each a union inside and ANDed together
 * (docs/proposals/filters-and-areas.md): categories (what), areas
 * (where), flags (narrow). None selected in a group means everything.
 * Nothing here depends on another selection: filters do not cascade.
 */
export interface FilterState {
  region: RegionId;
  /** Category chips: "layer/Kind" for a layer with kinds, the bare layer id for one without. Empty = every category. */
  categories: Set<string>;
  /** Area chips (src/data/areas.ts). Empty, with Here off, = everywhere. */
  areas: Set<string>;
  /** Add the area chip you are in (resolved from the position by the app). */
  here: boolean;
  /** Add the chips next to everything chosen (one hop on the area graph). */
  nearby: boolean;
  text: string;
  starredOnly: boolean;
  /** Only the device's bookmarked places (the set itself lives outside this state). */
  bookmarkedOnly: boolean;
  /** Only places open (at `openAt`, else now) in Tokyo time; unknown hours stay in, sunk to the end. */
  openNow: boolean;
  /** "YYYY-MM-DDTHH:MM" Tokyo wall clock to evaluate at instead of now. */
  openAt?: string;
}

export type FilterAction =
  | { type: "setRegion"; region: RegionId }
  | { type: "toggleCategory"; category: string }
  /** A layer header: every one of its kinds on, or all off. */
  | { type: "setCategories"; categories: string[]; on: boolean }
  | { type: "toggleArea"; area: string }
  /** A ward heading: every chip under it on, or all off. */
  | { type: "setAreas"; areas: string[]; on: boolean }
  | { type: "setHere"; value: boolean }
  | { type: "setNearby"; value: boolean }
  | { type: "setText"; text: string }
  | { type: "setStarredOnly"; value: boolean }
  | { type: "setBookmarkedOnly"; value: boolean }
  | { type: "setOpenNow"; value: boolean }
  | { type: "setOpenAt"; value: string | undefined }
  | { type: "clearFilters" };

export function layersInRegion(layers: LayerConfig[], region: RegionId): LayerConfig[] {
  // A layer with no fixed region spans every region (its rows say which).
  return layers.filter((l) => l.region === undefined || l.region === region);
}

/** A layer's category chips: one per kind ("drinks/Coffee"), or the layer itself when it has none. */
export function categoriesOf(layer: LayerConfig): string[] {
  return layer.kinds && layer.kinds.length > 0 ? layer.kinds.map((k) => `${layer.id}/${k}`) : [layer.id];
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
    nearby: false,
    text: "",
    starredOnly: false,
    bookmarkedOnly: false,
    openNow: false,
  };
}

/**
 * True when anything narrows the results. Drives the Filters dot and the
 * Clear buttons. Include nearby alone narrows nothing, so it doesn't count.
 */
export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.categories.size > 0 ||
    state.areas.size > 0 ||
    state.here ||
    state.text !== "" ||
    state.starredOnly ||
    state.bookmarkedOnly ||
    state.openNow ||
    state.openAt !== undefined
  );
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
    case "setHere":
      return { ...state, here: action.value };
    case "setNearby":
      return { ...state, nearby: action.value };
    case "setText":
      return { ...state, text: action.text };
    case "setStarredOnly":
      return { ...state, starredOnly: action.value };
    case "setBookmarkedOnly":
      return { ...state, bookmarkedOnly: action.value };
    case "setOpenNow":
      return { ...state, openNow: action.value };
    case "setOpenAt": {
      const next = { ...state };
      if (action.value === undefined) delete next.openAt;
      else next.openAt = action.value;
      return next;
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
