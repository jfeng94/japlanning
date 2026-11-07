import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/**
 * The atlas style: Protomaps' basemap layers with the rules from the
 * brief applied. Roads, rail, stations, water and parks stay; buildings,
 * addresses and every POI that isn't a transport node go.
 */

export type Flavor = "light" | "dark";

export const SOURCE_ID = "basemap";

/** POI kinds that survive the filter: transport nodes only. */
export const KEPT_POI_KINDS = ["station", "ferry_terminal", "aerodrome"] as const;

/** Layer ids removed outright. */
export const DROPPED_LAYERS = new Set(["buildings", "address_label"]);

/**
 * Glyphs and sprites come from the site itself (mirrored by
 * scripts/build-basemap.ts), so the map works with no third-party host and
 * the service worker can cache them. Paths under the given origin.
 */
export const GLYPHS_PATH = "/fonts/{fontstack}/{range}.pbf";
export const SPRITES_PATH = "/sprites";

export interface StyleOptions {
  /** Full URL of the PMTiles archive, e.g. `${origin}/basemap/tokyo.pmtiles`. */
  pmtilesUrl: string;
  flavor: Flavor;
  /** Label language; local names are the fallback. */
  lang?: string;
  /** Origin the glyphs and sprites are served from (the site's). Defaults to no origin, i.e. root-relative paths. */
  assetsOrigin?: string;
}

/** The basemap layers after the atlas rules. Pure; the map adds pins on top. */
export function atlasLayers(flavor: Flavor, lang = "en"): LayerSpecification[] {
  const out: LayerSpecification[] = [];
  for (const layer of basemapLayers(SOURCE_ID, namedFlavor(flavor), { lang })) {
    if (DROPPED_LAYERS.has(layer.id)) continue;
    if (layer.id === "pois") {
      out.push({ ...layer, filter: ["in", ["get", "kind"], ["literal", [...KEPT_POI_KINDS]]] } as LayerSpecification);
      continue;
    }
    out.push(layer);
  }
  return out;
}

export function atlasStyle(opts: StyleOptions): StyleSpecification {
  const flavor = namedFlavor(opts.flavor);
  return {
    version: 8,
    glyphs: `${opts.assetsOrigin ?? ""}${GLYPHS_PATH}`,
    sprite: `${opts.assetsOrigin ?? ""}${SPRITES_PATH}/${opts.flavor}`,
    sources: {
      [SOURCE_ID]: {
        type: "vector",
        url: `pmtiles://${opts.pmtilesUrl}`,
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>',
      },
    },
    layers: atlasLayers(opts.flavor, opts.lang),
    // Not part of the spec proper; read back by tests and the map for the page background.
    metadata: { background: flavor.background },
  };
}
