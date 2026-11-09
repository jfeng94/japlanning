import type { FacetConfig, LayerConfig, Place } from "../data/types.ts";
import { activeFacetLayer, effectiveLayers, type FacetSelection, type FilterState } from "./state.ts";

/** Case-insensitive, width-insensitive comparison key (full-width "Ａ" == "a"). */
export function normalise(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim();
}

export function matchesText(place: Place, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return [place.name, place.branch, place.area, place.areaGroup, place.notes]
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

/** Per-place hours state for the open-now filter; which layers carry hours at all. */
export interface HoursInput {
  states: ReadonlyMap<string, "open" | "closed" | "unknown">;
  layersWithHours: ReadonlySet<string>;
}

export interface ApplyOptions {
  /** The device's bookmarked place ids; needed when `bookmarkedOnly` is on (none given = nothing matches). */
  bookmarks?: ReadonlySet<string>;
  /** Evaluated hours; while absent (parser still loading) the open-now filter passes everything. */
  hours?: HoursInput;
  /** Ignore the open-now filter (to count what it would keep). */
  skipOpenNow?: boolean;
  /** Ignore this facet column's selection (used to count "what if I picked this"). */
  skipFacet?: string;
  /** Ignore the area selection (same reason). */
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
    if (state.openNow && !opts.skipOpenNow && !passesOpenNow(p, state, opts.hours)) return false;
    if (byNeighborhood && !(p.areaGroup !== undefined && state.neighborhoods.has(p.areaGroup))) return false;
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

/**
 * The open-now rule for one place: layers without hours are untouched;
 * open passes, closed fails, unknown passes iff includeUnknownHours. With
 * no evaluation yet, everything passes so the list never blanks.
 */
export function passesOpenNow(place: Place, state: FilterState, hours: HoursInput | undefined): boolean {
  if (!hours) return true;
  if (!hours.layersWithHours.has(place.layerId)) return true;
  const s = hours.states.get(place.id) ?? "unknown";
  if (s === "open") return true;
  if (s === "closed") return false;
  return state.includeUnknownHours;
}

/**
 * With the open-now filter on: rows whose hours are unknown go after the
 * rest, keeping their relative order, so the shops we know are open lead.
 * Layers without hours (lodging) are not "unknown" and stay where they are.
 */
export function sinkUnknownHours(places: Place[], hours: HoursInput | undefined): Place[] {
  if (!hours) return places;
  const unknown = (p: Place) => hours.layersWithHours.has(p.layerId) && (hours.states.get(p.id) ?? "unknown") === "unknown";
  return [...places.filter((p) => !unknown(p)), ...places.filter(unknown)];
}

export interface OpenNowCounts {
  open: number;
  unknown: number;
}

/** Among the rows the other filters keep: how many are open, and how many have unknown hours. */
export function openNowCounts(places: Place[], state: FilterState, opts: Omit<ApplyOptions, "skipOpenNow">): OpenNowCounts {
  const base = applyFilters(places, state, { ...opts, skipOpenNow: true });
  let open = 0;
  let unknown = 0;
  for (const p of base) {
    if (!opts.hours || !opts.hours.layersWithHours.has(p.layerId)) continue;
    const s = opts.hours.states.get(p.id) ?? "unknown";
    if (s === "open") open++;
    else if (s === "unknown") unknown++;
  }
  return { open, unknown };
}

/**
 * For a facet with `scopeBy`: the values held by rows of `layer` in the
 * region that match the scoping column's current selection (all rows when
 * nothing is selected there). Undefined for an unscoped facet. The sheet
 * offers only these, plus anything already selected.
 */
export function scopedFacetValues(places: Place[], state: FilterState, layer: LayerConfig, facet: FacetConfig): Set<string> | undefined {
  if (!facet.scopeBy) return undefined;
  const scope = facet.scopeBy;
  const picked = state.facets[layer.id]?.[scope]?.values;
  const values = new Set<string>();
  for (const p of places) {
    if (p.region !== state.region || p.layerId !== layer.id) continue;
    if (picked && picked.size > 0 && !(p.facets[scope] ?? []).some((v) => picked.has(v))) continue;
    for (const v of p.facets[facet.column] ?? []) values.add(v);
  }
  return values;
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
  opts: Pick<ApplyOptions, "bookmarks" | "hours"> = {},
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

/** Same idea for the area chips (src/data/areas.ts): counts by the chip each place falls under. */
export function neighborhoodCounts(
  places: Place[],
  state: FilterState,
  neighborhoods: string[],
  opts: Pick<ApplyOptions, "bookmarks" | "hours"> = {},
): Map<string, number> {
  const base = applyFilters(places, state, { ...opts, skipNeighborhoods: true });
  const counts = new Map<string, number>(neighborhoods.map((n) => [n, 0]));
  for (const p of base) {
    if (p.areaGroup !== undefined) counts.set(p.areaGroup, (counts.get(p.areaGroup) ?? 0) + 1);
  }
  return counts;
}
