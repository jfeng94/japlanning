import type { AreaIndex } from "../data/areas.ts";
import type { Place } from "../data/types.ts";
import { distanceM, type LatLng } from "../geo/distance.ts";
import type { FilterAction, FilterState } from "./state.ts";

/**
 * The algebra (docs/proposals/filters-and-areas.md, filter-pages-and-area-map.md):
 *
 *   shown = places in the region, none under Hide all
 *     ∩ (no categories ? all : ∪ selected categories)
 *     ∩ (nothing picked and no Here ? all : area ∈ picked ∪ {Here's} ∪ (adjacent ? their neighbours : ∅))
 *     ∩ (nearby and a fix ? within the radius of you : all)
 *     ∩ every other flag that is on
 *     ∩ text match
 */

/** Case-insensitive, width-insensitive comparison key (full-width "Ａ" == "a"). */
export function normalise(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim();
}

/**
 * Search covers what the filters don't: the name and branch, the raw area
 * and its chip, the kinds, the notes, history and events, every facet value ("pour-over",
 * "kissaten") and the Japanese address ("渋谷").
 */
export function matchesText(place: Place, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  const fields = [place.name, place.branch, place.area, place.areaGroup, place.notes, place.extra["History"], place.extra["Events"], place.address, ...place.kinds, ...Object.values(place.facets).flat()];
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
  /** The region's areas, for + Adjacent. */
  areas?: Pick<AreaIndex, "neighbours">;
  /** The device's position, for Nearby; without one Nearby narrows nothing. */
  position?: LatLng;
}

/** What the area filter keeps. */
export interface AreaScope {
  /** Chips picked: by hand, plus Here's. */
  chosen: ReadonlySet<string>;
  /** Chips added by + Adjacent; never one of `chosen`. */
  added: ReadonlySet<string>;
}

/**
 * The area filter for a state, or undefined when it keeps everything:
 * nothing picked and Here off or unresolved (no fix yet, or away from
 * every area). The Area page uses it too, for the chips' looks.
 */
export function areaScope(state: FilterState, opts: Pick<ApplyOptions, "hereGroup" | "areas">): AreaScope | undefined {
  const chosen = new Set(state.areas);
  if (state.here && opts.hereGroup !== undefined) chosen.add(opts.hereGroup);
  if (chosen.size === 0) return undefined;
  const added = state.adjacent && opts.areas ? opts.areas.neighbours(chosen) : new Set<string>();
  return { chosen, added };
}

/**
 * What the area filter keeps, as a key: the region, the chips picked and
 * the chips added. Two states with the same key show the same places as
 * far as areas go (+ Adjacent with nothing picked is the same as without).
 */
export function areaScopeKey(state: FilterState, opts: Pick<ApplyOptions, "hereGroup" | "areas">): string {
  const scope = areaScope(state, opts);
  if (!scope) return state.region;
  return [state.region, [...scope.chosen].sort().join(","), [...scope.added].sort().join(",")].join("|");
}

/** The rows the list and map show for a state. */
export function applyFilters(places: Place[], state: FilterState, opts: ApplyOptions = {}): Place[] {
  const scope = areaScope(state, opts);
  const near = state.nearby !== undefined && opts.position ? { from: opts.position, within: state.nearby } : undefined;
  if (state.hideAll) return [];
  return places.filter((p) => {
    if (p.region !== state.region) return false;
    if (!matchesCategories(p, state.categories)) return false;
    if (scope && !(p.areaGroup !== undefined && (scope.chosen.has(p.areaGroup) || scope.added.has(p.areaGroup)))) return false;
    if (near && distanceM(near.from, p) > near.within) return false;
    if (state.starredOnly && !p.starred) return false;
    if (state.bookmarkedOnly && !opts.bookmarks?.has(p.id)) return false;
    if (state.openNow && !passesOpenNow(p, opts.hours)) return false;
    return matchesText(p, state.text);
  });
}

/**
 * An area's look, on its chip and (in Part 3) on the map: picked by hand
 * or through Here, added by + Adjacent, or out.
 */
export type AreaLook = "picked" | "added" | "out";

export function areaLook(state: FilterState, chip: string, opts: Pick<ApplyOptions, "hereGroup" | "areas">): AreaLook {
  if (state.areas.has(chip) || (state.here && opts.hereGroup === chip)) return "picked";
  return areaScope(state, opts)?.added.has(chip) ? "added" : "out";
}

/**
 * What tapping an area does:
 * - picked: out, and if it was Here's area, Here turns off;
 * - added: out, and everything else that was in stays in as picks, with
 *   + Adjacent off (the added areas freeze);
 * - out: picked; with + Adjacent on, its neighbours come in as added.
 */
export function tapArea(state: FilterState, chip: string, opts: Pick<ApplyOptions, "hereGroup" | "areas">): FilterAction {
  const look = areaLook(state, chip, opts);
  if (look === "picked") {
    const here = state.here && opts.hereGroup !== chip;
    return { type: "setAreaChoice", areas: [...state.areas].filter((a) => a !== chip), here, adjacent: state.adjacent };
  }
  if (look === "added") {
    const frozen = [...state.areas, ...(areaScope(state, opts)?.added ?? [])].filter((a) => a !== chip);
    return { type: "setAreaChoice", areas: frozen, here: state.here, adjacent: false };
  }
  return { type: "setAreaChoice", areas: [...state.areas, chip], here: state.here, adjacent: state.adjacent };
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
