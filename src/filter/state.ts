import type { LayerConfig, LayerId, RegionId } from "../data/types.ts";

/**
 * Filter state and its transitions. Pure: no DOM, no storage. The list,
 * the map and the URL all derive from one FilterState.
 * See docs/design/regions-layers-filters.md.
 */

export interface FacetSelection {
  /** Selected values; empty means "any". OR'd within the facet. */
  values: Set<string>;
  /** Whether rows with a blank cell pass this facet. Default true. */
  includeUnknown: boolean;
}

export interface FilterState {
  region: RegionId;
  /** Selected layers; pins and rows come only from these. */
  layers: Set<LayerId>;
  text: string;
  /** Selected neighborhoods; empty means "any". */
  neighborhoods: Set<string>;
  starredOnly: boolean;
  /** Evaluated from M5 on; carried in state now so the URL codec is stable. */
  openNow: boolean;
  /** layer id -> facet column -> selection. Absent means the default selection. */
  facets: Record<string, Record<string, FacetSelection>>;
}

export type FilterAction =
  | { type: "setRegion"; region: RegionId }
  | { type: "toggleLayer"; layer: LayerId }
  | { type: "setLayers"; layers: LayerId[] }
  | { type: "setText"; text: string }
  | { type: "toggleNeighborhood"; neighborhood: string }
  | { type: "setStarredOnly"; value: boolean }
  | { type: "setOpenNow"; value: boolean }
  | { type: "toggleFacetValue"; layer: LayerId; column: string; value: string }
  | { type: "setIncludeUnknown"; layer: LayerId; column: string; value: boolean }
  | { type: "clearFilters" };

export function layersInRegion(layers: LayerConfig[], region: RegionId): LayerConfig[] {
  return layers.filter((l) => l.region === region);
}

/** All of the region's layers selected, nothing else set. */
export function defaultState(region: RegionId, layers: LayerConfig[]): FilterState {
  return {
    region,
    layers: new Set(layersInRegion(layers, region).map((l) => l.id)),
    text: "",
    neighborhoods: new Set(),
    starredOnly: false,
    openNow: false,
    facets: {},
  };
}

export function defaultSelection(): FacetSelection {
  return { values: new Set(), includeUnknown: true };
}

export function isDefaultSelection(sel: FacetSelection): boolean {
  return sel.values.size === 0 && sel.includeUnknown;
}

export function getSelection(state: FilterState, layer: LayerId, column: string): FacetSelection {
  return state.facets[layer]?.[column] ?? defaultSelection();
}

/** The layer whose facets apply: exactly one selected, otherwise none. */
export function activeFacetLayer(state: FilterState): LayerId | undefined {
  return state.layers.size === 1 ? [...state.layers][0] : undefined;
}

/** True when anything beyond region and layers is set. Drives the Clear button. */
export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.text !== "" ||
    state.neighborhoods.size > 0 ||
    state.starredOnly ||
    state.openNow ||
    Object.keys(state.facets).length > 0
  );
}

export function reduce(state: FilterState, action: FilterAction, layers: LayerConfig[]): FilterState {
  switch (action.type) {
    case "setRegion":
      return action.region === state.region ? state : defaultState(action.region, layers);
    case "toggleLayer":
      return { ...state, layers: toggled(state.layers, action.layer) };
    case "setLayers":
      return { ...state, layers: new Set(action.layers) };
    case "setText":
      return { ...state, text: action.text };
    case "toggleNeighborhood":
      return { ...state, neighborhoods: toggled(state.neighborhoods, action.neighborhood) };
    case "setStarredOnly":
      return { ...state, starredOnly: action.value };
    case "setOpenNow":
      return { ...state, openNow: action.value };
    case "toggleFacetValue": {
      const sel = getSelection(state, action.layer, action.column);
      return withSelection(state, action.layer, action.column, {
        values: toggled(sel.values, action.value),
        includeUnknown: sel.includeUnknown,
      });
    }
    case "setIncludeUnknown": {
      const sel = getSelection(state, action.layer, action.column);
      return withSelection(state, action.layer, action.column, {
        values: sel.values,
        includeUnknown: action.value,
      });
    }
    case "clearFilters":
      return {
        ...state,
        text: "",
        neighborhoods: new Set(),
        starredOnly: false,
        openNow: false,
        facets: {},
      };
  }
}

function toggled<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

/** Return a state with one facet selection replaced; default selections are removed, not stored. */
function withSelection(state: FilterState, layer: LayerId, column: string, sel: FacetSelection): FilterState {
  const layerFacets = { ...(state.facets[layer] ?? {}) };
  if (isDefaultSelection(sel)) delete layerFacets[column];
  else layerFacets[column] = sel;

  const facets = { ...state.facets };
  if (Object.keys(layerFacets).length === 0) delete facets[layer];
  else facets[layer] = layerFacets;
  return { ...state, facets };
}
