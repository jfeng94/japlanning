import { areaIndex } from "../data/areas.ts";
import type { LayerConfig, RegionConfig, RegionId } from "../data/types.ts";
import { snapRadius } from "../geo/nearby.ts";
import { categoriesOf, defaultState, layersInRegion, type FilterState } from "./state.ts";

/**
 * FilterState <-> URL query string. Only non-default values are written,
 * so a default view has a bare URL. Reading drops anything it doesn't
 * recognise (unknown region, layer, kind or area) rather than failing, so
 * a stale shared link degrades to the nearest valid view.
 *
 *   ?r=kyoto                       region (omitted for the default region)
 *   &c=drinks/Coffee&c=drinks/Tea  categories, repeated; a layer id alone when all its kinds are on
 *   &hide=1                        Hide all (no places; the rest of the selection is kept)
 *   &a=Ginza&a=Asakusa             area chips, repeated; a raw area maps to its chip
 *   &here=1 &adj=1                 Here; + Adjacent
 *   &q=glitch                      text
 *   &star=1 &b=1 &open=1           flags (b = this device's bookmarks only)
 *   &near=1000                     Nearby, in metres (snapped to the slider's stops)
 *   &at=2026-11-10T10:00           open at this Tokyo wall-clock time instead of now
 *
 * Older links still read: n= (area chips, step 1) as a=, nb=1 (step 2's
 * Include nearby) as adj=1.
 */
export interface UrlContext {
  regions: RegionConfig[];
  layers: LayerConfig[];
  /** The region a bare URL means. */
  defaultRegion: RegionId;
}

export function toSearchParams(state: FilterState, ctx: UrlContext): URLSearchParams {
  const p = new URLSearchParams();
  if (state.region !== ctx.defaultRegion) p.set("r", state.region);
  // A layer with every kind on is written as the layer; anything else chip by chip.
  const written = new Set<string>();
  for (const layer of layersInRegion(ctx.layers, state.region)) {
    const own = categoriesOf(layer);
    if (own.length > 1 && own.every((c) => state.categories.has(c))) {
      p.append("c", layer.id);
      own.forEach((c) => written.add(c));
    }
  }
  for (const c of state.categories) if (!written.has(c)) p.append("c", c);
  if (state.hideAll) p.set("hide", "1");
  for (const a of state.areas) p.append("a", a);
  if (state.here) p.set("here", "1");
  if (state.adjacent) p.set("adj", "1");
  if (state.text) p.set("q", state.text);
  if (state.starredOnly) p.set("star", "1");
  if (state.bookmarkedOnly) p.set("b", "1");
  if (state.openNow) p.set("open", "1");
  if (state.nearby !== undefined) p.set("near", String(state.nearby));
  if (state.openAt) p.set("at", state.openAt);
  return p;
}

export function fromSearchParams(params: URLSearchParams, ctx: UrlContext): FilterState {
  const r = params.get("r");
  const region = ctx.regions.find((x) => x.id === r)?.id ?? ctx.defaultRegion;
  const state = defaultState(region);

  // Categories: a layer id stands for all of its chips; a chip must belong to a layer in the region.
  const known = new Map<string, string[]>();
  for (const layer of layersInRegion(ctx.layers, region)) {
    const own = categoriesOf(layer);
    known.set(layer.id, own);
    for (const c of own) known.set(c, [c]);
  }
  state.categories = new Set(params.getAll("c").flatMap((c) => known.get(c) ?? []));
  state.hideAll = params.get("hide") === "1";

  // A chip label stays; a raw area becomes its chip, so a link survives a later merge; anything else drops.
  const areas = areaIndex(ctx.regions.find((x) => x.id === region) ?? { areas: [] });
  state.areas = new Set(
    [...params.getAll("a"), ...params.getAll("n")].flatMap((a) => {
      const chip = areas.chip(a) ? a : areas.groupOf(a);
      return chip === undefined ? [] : [chip];
    }),
  );
  state.here = params.get("here") === "1";
  state.adjacent = params.get("adj") === "1" || params.get("nb") === "1";
  state.text = params.get("q") ?? "";
  state.starredOnly = params.get("star") === "1";
  state.bookmarkedOnly = params.get("b") === "1";
  state.openNow = params.get("open") === "1";
  const near = Number(params.get("near"));
  if (params.has("near") && Number.isFinite(near) && near > 0) state.nearby = snapRadius(near);
  const at = params.get("at");
  if (at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) state.openAt = at;
  return state;
}
