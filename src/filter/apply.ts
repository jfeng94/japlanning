import type { AreaIndex } from "../data/areas.ts";
import type { Place } from "../data/types.ts";
import type { FilterState } from "./state.ts";

/**
 * The algebra (docs/proposals/filters-and-areas.md):
 *
 *   shown = places in the region
 *     ∩ (no categories ? all : ∪ selected categories)
 *     ∩ (no areas and no Here ? all : area ∈ chosen ∪ (nearby ? their neighbours : ∅))
 *     ∩ every flag that is on
 *     ∩ text match
 */

/** Case-insensitive, width-insensitive comparison key (full-width "Ａ" == "a"). */
export function normalise(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim();
}

/**
 * Search covers what the sheet no longer filters: the name and branch, the
 * raw area and its chip, the kinds, the notes, every facet value
 * ("pour-over", "kissaten") and the Japanese address ("渋谷").
 */
export function matchesText(place: Place, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  const fields = [place.name, place.branch, place.area, place.areaGroup, place.notes, place.address, ...place.kinds, ...Object.values(place.facets).flat()];
  return fields.some((s) => typeof s === "string" && normalise(s).includes(q));
}

/** A place against the category chips: any of its kinds selected, or its layer (a layer without kinds). */
export function matchesCategories(place: Place, categories: ReadonlySet<string>): boolean {
  if (categories.size === 0) return true;
  if (categories.has(place.layerId)) return true;
  return place.kinds.some((k) => categories.has(`${place.layerId}/${k}`));
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
  /** Here's area chip, when Here can be resolved (src/data/areas.ts areaAt). */
  hereGroup?: string;
  /** The region's areas, for Include nearby. */
  areas?: Pick<AreaIndex, "neighbours">;
}

/** What the area filter keeps. */
export interface AreaScope {
  /** Chips chosen: the selection, plus Here's. */
  chosen: ReadonlySet<string>;
  /** Chips pulled in by Include nearby; never one of `chosen`. */
  nearby: ReadonlySet<string>;
}

/**
 * The area filter for a state, or undefined when it keeps everything: no
 * chip selected and Here off or unresolved (no fix yet, or away from every
 * area). The sheet uses it too, to outline the chips pulled in.
 */
export function areaScope(state: FilterState, opts: Pick<ApplyOptions, "hereGroup" | "areas">): AreaScope | undefined {
  const chosen = new Set(state.areas);
  if (state.here && opts.hereGroup !== undefined) chosen.add(opts.hereGroup);
  if (chosen.size === 0) return undefined;
  const nearby = state.nearby && opts.areas ? opts.areas.neighbours(chosen) : new Set<string>();
  return { chosen, nearby };
}

/** The rows the list and map show for a state. */
export function applyFilters(places: Place[], state: FilterState, opts: ApplyOptions = {}): Place[] {
  const scope = areaScope(state, opts);
  return places.filter((p) => {
    if (p.region !== state.region) return false;
    if (!matchesCategories(p, state.categories)) return false;
    if (scope && !(p.areaGroup !== undefined && (scope.chosen.has(p.areaGroup) || scope.nearby.has(p.areaGroup)))) return false;
    if (state.starredOnly && !p.starred) return false;
    if (state.bookmarkedOnly && !opts.bookmarks?.has(p.id)) return false;
    if (state.openNow && !passesOpenNow(p, opts.hours)) return false;
    return matchesText(p, state.text);
  });
}

/**
 * The open-now rule for one place: layers without hours are untouched;
 * closed fails; open and unknown pass (unknown sinks to the end of the
 * list with the "?" mark). With no evaluation yet, everything passes so
 * the list never blanks.
 */
export function passesOpenNow(place: Place, hours: HoursInput | undefined): boolean {
  if (!hours) return true;
  if (!hours.layersWithHours.has(place.layerId)) return true;
  return hours.states.get(place.id) !== "closed";
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
