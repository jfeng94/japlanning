import type { LayerConfig, LayerId, RegionConfig, RegionId } from "../data/types.ts";
import { defaultSelection, defaultState, layersInRegion, type FacetSelection, type FilterState } from "./state.ts";

/**
 * FilterState <-> URL query string. Only non-default values are written,
 * so a default view has a bare URL. Reading drops anything it doesn't
 * recognise (unknown region, layer, column or neighborhood) rather than
 * failing, so a stale shared link degrades to the nearest valid view.
 *
 *   ?r=kyoto                       region (omitted for the default region)
 *   &l=tokyo-coffee,tokyo-tea      layers (omitted when none selected, which means all)
 *   &q=glitch                      text
 *   &n=Central&n=East              neighborhoods, repeated
 *   &star=1 &open=1                flags
 *   &f=tokyo-coffee/Format=Stand|Caf%C3%A9   facet values, repeated per facet
 *   &u=tokyo-coffee/Format         include-unknown OFF, repeated per facet
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
  if (state.openNow) p.set("open", "1");
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
  const neighborhoods = new Set(ctx.regions.find((x) => x.id === region)?.neighborhoods ?? []);

  const l = params.get("l");
  if (l !== null) {
    // Unknown ids drop out; none left means "all", which is the default anyway.
    state.layers = new Set(l.split(",").filter((id) => regionLayers.has(id)) as LayerId[]);
  }

  state.text = params.get("q") ?? "";
  state.neighborhoods = new Set(params.getAll("n").filter((n) => neighborhoods.has(n)));
  state.starredOnly = params.get("star") === "1";
  state.openNow = params.get("open") === "1";

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

