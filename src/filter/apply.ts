import type { LayerConfig, Place } from "../data/types.ts";
import { activeFacetLayer, effectiveLayers, type FacetSelection, type FilterState } from "./state.ts";

/** Case-insensitive, width-insensitive comparison key (full-width "Ａ" == "a"). */
export function normalise(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim();
}

export function matchesText(place: Place, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return [place.name, place.neighborhood, place.notes]
    .filter((s): s is string => typeof s === "string")
    .some((s) => normalise(s).includes(q));
}

/**
 * A row's facet values against a selection. Blank cells pass iff
 * includeUnknown; otherwise any selected value matches, and no selection
 * matches everything.
 */
export function matchesFacet(values: string[], sel: FacetSelection): boolean {
  if (values.length === 0) return sel.includeUnknown;
  if (sel.values.size === 0) return true;
  return values.some((v) => sel.values.has(v));
}

export interface ApplyOptions {
  /** The device's bookmarked place ids; needed when `bookmarkedOnly` is on (none given = nothing matches). */
  bookmarks?: ReadonlySet<string>;
  /** Ignore this facet column's selection (used to count "what if I picked this"). */
  skipFacet?: string;
  /** Ignore the neighborhood selection (same reason). */
  skipNeighborhoods?: boolean;
}

/**
 * The rows the list and map show for a state. Layer membership, then the
 * shared filters, then the active layer's facets (only when exactly one
 * layer is selected). Open-now is ignored until M5.
 */
export function applyFilters(places: Place[], state: FilterState, opts: ApplyOptions = {}): Place[] {
  // "No layers selected" means every layer that has places in this region.
  const regionLayerIds = new Set(places.filter((p) => p.region === state.region).map((p) => p.layerId));
  const layersOn = effectiveLayers(state, regionLayerIds);
  const facetLayer = activeFacetLayer(state, regionLayerIds);
  const facets = facetLayer ? state.facets[facetLayer] : undefined;
  const byNeighborhood = !opts.skipNeighborhoods && state.neighborhoods.size > 0;

  return places.filter((p) => {
    if (p.region !== state.region || !layersOn.has(p.layerId)) return false;
    if (state.starredOnly && !p.starred) return false;
    if (state.bookmarkedOnly && !opts.bookmarks?.has(p.id)) return false;
    if (byNeighborhood && !(p.neighborhood !== undefined && state.neighborhoods.has(p.neighborhood))) return false;
    if (!matchesText(p, state.text)) return false;
    if (facets && p.layerId === facetLayer) {
      for (const [column, sel] of Object.entries(facets)) {
        if (column === opts.skipFacet) continue;
        if (!matchesFacet(p.facets[column] ?? [], sel)) return false;
      }
    }
    return true;
  });
}

export interface FacetCount {
  /** Configured values first (even at 0), then unlisted values the data holds. */
  values: Map<string, number>;
  /** Rows with a blank cell. */
  unknown: number;
}

/**
 * For each facet of `layer`: how many rows would match each value if it
 * were selected, given every other filter. Multi-value rows count once
 * under each value they hold.
 */
export function facetCounts(
  places: Place[],
  state: FilterState,
  layer: LayerConfig,
  opts: Pick<ApplyOptions, "bookmarks"> = {},
): Map<string, FacetCount> {
  const out = new Map<string, FacetCount>();
  for (const facet of layer.facets) {
    const base = applyFilters(places, state, { ...opts, skipFacet: facet.column }).filter((p) => p.layerId === layer.id);
    const values = new Map<string, number>(facet.values.map((v) => [v, 0]));
    let unknown = 0;
    for (const p of base) {
      const vs = p.facets[facet.column] ?? [];
      if (vs.length === 0) unknown++;
      else for (const v of vs) values.set(v, (values.get(v) ?? 0) + 1);
    }
    out.set(facet.column, { values, unknown });
  }
  return out;
}

/** Same idea for the shared Neighborhood filter. */
export function neighborhoodCounts(
  places: Place[],
  state: FilterState,
  neighborhoods: string[],
  opts: Pick<ApplyOptions, "bookmarks"> = {},
): Map<string, number> {
  const base = applyFilters(places, state, { ...opts, skipNeighborhoods: true });
  const counts = new Map<string, number>(neighborhoods.map((n) => [n, 0]));
  for (const p of base) {
    if (p.neighborhood !== undefined) counts.set(p.neighborhood, (counts.get(p.neighborhood) ?? 0) + 1);
  }
  return counts;
}
