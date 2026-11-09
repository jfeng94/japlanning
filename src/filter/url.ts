import { areaIndex } from "../data/areas.ts";
import type { LayerConfig, LayerId, RegionConfig, RegionId } from "../data/types.ts";
import { defaultSelection, defaultState, layersInRegion, type FacetSelection, type FilterState } from "./state.ts";

/**
 * FilterState <-> URL query string. Only non-default values are written,
 * so a default view has a bare URL. Reading drops anything it doesn't
 * recognise (unknown region, layer, column or area) rather than
 * failing, so a stale shared link degrades to the nearest valid view.
 *
 *   ?r=kyoto                       region (omitted for the default region)
 *   &l=drinks,tokyo-tea      layers (omitted when none selected, which means all)
 *   &q=glitch                      text
 *   &n=Ginza&n=Asakusa             area chips, repeated; a raw area maps to its chip
 *   &star=1 &b=1 &open=1           flags (b = this device's bookmarks only)
 *   &hu=0                          open now: exclude unknown hours
 *   &at=2026-11-10T10:00           open at this Tokyo wall-clock time instead of now
 *   &f=drinks/Format=Stand|Caf%C3%A9   facet values, repeated per facet
 *   &u=drinks/Format         include-unknown OFF, repeated per facet
 */
export interface UrlContext {
  regions: RegionConfig[];
  layers: LayerConfig[];
  /** The region a bare URL means. */
  defaultRegion: RegionId;
}

const VALUE_SEPARATOR = "|";

export function toSearchParams(state: FilterState, ctx: UrlContext): URLSearchParams {
  const p = new URLSearchParams();
  if (state.region !== ctx.defaultRegion) p.set("r", state.region);
  if (state.layers.size > 0) p.set("l", [...state.layers].join(","));
  if (state.text) p.set("q", state.text);
  for (const n of state.neighborhoods) p.append("n", n);
  if (state.starredOnly) p.set("star", "1");
  if (state.bookmarkedOnly) p.set("b", "1");
  if (state.openNow) p.set("open", "1");
  if (!state.includeUnknownHours) p.set("hu", "0");
  if (state.openAt) p.set("at", state.openAt);
  for (const [layer, columns] of Object.entries(state.facets)) {
    for (const [column, sel] of Object.entries(columns)) {
      if (sel.values.size > 0) {
        const values = [...sel.values].map(encodeURIComponent).join(VALUE_SEPARATOR);
        p.append("f", `${layer}/${column}=${values}`);
      }
      if (!sel.includeUnknown) p.append("u", `${layer}/${column}`);
    }
  }
  return p;
}

export function fromSearchParams(params: URLSearchParams, ctx: UrlContext): FilterState {
  const r = params.get("r");
  const region = ctx.regions.find((x) => x.id === r)?.id ?? ctx.defaultRegion;
  const state = defaultState(region, ctx.layers);
  const regionLayers = new Map(layersInRegion(ctx.layers, region).map((l) => [l.id as string, l]));
  const areas = areaIndex(ctx.regions.find((x) => x.id === region) ?? { areas: [] });

  const l = params.get("l");
  if (l !== null) {
    // Unknown ids drop out; none left means "all", which is the default anyway.
    state.layers = new Set(l.split(",").filter((id) => regionLayers.has(id)) as LayerId[]);
  }

  state.text = params.get("q") ?? "";
  // A chip label stays; a raw area becomes its chip, so a link survives a later merge; anything else drops.
  state.neighborhoods = new Set(
    params.getAll("n").flatMap((n) => {
      const chip = areas.chip(n) ? n : areas.groupOf(n);
      return chip === undefined ? [] : [chip];
    }),
  );
  state.starredOnly = params.get("star") === "1";
  state.bookmarkedOnly = params.get("b") === "1";
  state.openNow = params.get("open") === "1";
  state.includeUnknownHours = params.get("hu") !== "0";
  const at = params.get("at");
  if (at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) state.openAt = at;

  const selection = (layer: string, column: string): FacetSelection | undefined => {
    const config = regionLayers.get(layer);
    if (!config || !config.facets.some((f) => f.column === column)) return undefined;
    const byLayer = (state.facets[layer] ??= {});
    return (byLayer[column] ??= defaultSelection());
  };

  for (const entry of params.getAll("f")) {
    const eq = entry.indexOf("=");
    if (eq < 0) continue;
    const { layer, column } = splitKey(entry.slice(0, eq));
    const sel = selection(layer, column);
    if (!sel) continue;
    for (const raw of entry.slice(eq + 1).split(VALUE_SEPARATOR)) {
      const v = safeDecode(raw);
      if (v) sel.values.add(v);
    }
  }
  for (const entry of params.getAll("u")) {
    const { layer, column } = splitKey(entry);
    const sel = selection(layer, column);
    if (sel) sel.includeUnknown = false;
  }
  // Drop any selection that ended up default (e.g. all values were empty).
  for (const [layer, columns] of Object.entries(state.facets)) {
    for (const [column, sel] of Object.entries(columns)) {
      if (sel.values.size === 0 && sel.includeUnknown) delete columns[column];
    }
    if (Object.keys(columns).length === 0) delete state.facets[layer];
  }
  return state;
}

/** "layer/column" -> parts; layer ids never contain "/", columns might. */
function splitKey(key: string): { layer: string; column: string } {
  const slash = key.indexOf("/");
  return slash < 0 ? { layer: key, column: "" } : { layer: key.slice(0, slash), column: key.slice(slash + 1) };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

