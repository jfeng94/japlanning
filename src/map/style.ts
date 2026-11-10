import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/**
 * The atlas style: Protomaps' basemap layers with the rules from the
 * brief applied. Roads, rail, stations, water and parks stay; buildings,
 * addresses and every POI that isn't a transport node go.
 */

export type Flavor = "light" | "dark";

export const SOURCE_ID = "basemap";

/** POI kinds that survive the filter: stations only (M8; ferry terminals and airports aren't where the places are). */
export const KEPT_POI_KINDS = ["station"] as const;

/**
 * Layer ids removed outright: buildings and addresses, then what a trip
 * atlas doesn't need (M8, docs/proposals/m8-atlas-styling.md).
 */
export const DROPPED_LAYERS = new Set([
  "buildings",
  "address_label",
  // Fills that tint the city by use; only parks, water and plazas should read.
  "landuse_hospital",
  "landuse_industrial",
  "landuse_school",
  "landuse_zoo",
  // Lines and labels a visitor doesn't find their way by.
  "boundaries",
  "boundaries_country",
  "roads_oneway",
  "roads_shields",
  "roads_labels_minor",
  "water_label_ocean",
  "earth_label_islands",
  "places_country",
  "places_region",
]);

/** Shown from this zoom only: service roads (alleys, car parks) are noise at city zoom. */
const MIN_ZOOM: Record<string, number> = { roads_minor_service: 15, roads_minor_service_casing: 15 };

/** The rail lines, moved above every road so the network reads as the map's skeleton. */
export const RAIL = "roads_rail";
/** The last road layer; rail draws straight after it. */
const RAIL_AFTER = "roads_bridges_highway";

/** Rail, solid and heavier than Protomaps' faint dotted line, in a grey that reads on either flavour. */
export function railPaint(flavor: Flavor): Record<string, unknown> {
  return {
    "line-color": flavor === "light" ? "#7d878b" : "#80868f",
    "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 10, 0.6, 13, 1.2, 15, 1.6, 18, 3],
    "line-opacity": 0.9,
    "line-dasharray": [1, 0],
  };
}

/** How strongly the land-use fills that stay (parks, plazas, beaches, airfields) tint the map: enough to read, not to draw the eye. */
const CALM_FILL = 0.6;

/** Paint changes by layer id, on top of Protomaps' own. */
function paintFor(id: string, flavor: Flavor): Record<string, unknown> | undefined {
  switch (id) {
    case "landuse_park":
      return { "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 11, CALM_FILL] };
    case "landuse_urban_green":
      return { "fill-opacity": 0.45 };
    case "landuse_beach":
    case "landuse_aerodrome":
    case "landuse_runway":
    case "landuse_pedestrian":
    case "landuse_pier":
      return { "fill-opacity": CALM_FILL };
    case RAIL:
      return railPaint(flavor);
    case "pois":
      // Station names: Protomaps' blue is too dark to read on the dark map; a lighter one there.
      return flavor === "dark" ? { "text-color": "#8fb0f5" } : undefined;
    default:
      return undefined;
  }
}

/**
 * Stations only, named a little larger than Protomaps' 10 px below zoom
 * 17, with the busier stations (the lower `min_zoom` the tiles give them)
 * winning where labels collide.
 */
function stationsOnly(layer: LayerSpecification): LayerSpecification {
  const l = layer as LayerSpecification & { layout?: Record<string, unknown> };
  return {
    ...l,
    filter: ["in", ["get", "kind"], ["literal", [...KEPT_POI_KINDS]]],
    layout: {
      ...l.layout,
      "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10.5, 15, 12, 17, 13, 19, 16],
      "symbol-sort-key": ["get", "min_zoom"],
    },
  } as LayerSpecification;
}

/**
 * The basemap's rail and stations, which a region with our own subway
 * lines (src/map/transit-layers.ts) leaves out: the lines, the dots and
 * the station names there are ours (Jerry, 2026-11-10).
 */
export const OWN_TRANSIT_REPLACES = new Set([RAIL, "pois"]);

/**
 * Glyphs and sprites come from the site itself (mirrored by
 * scripts/build-basemap.ts), so the map works with no third-party host and
 * the service worker can cache them. Paths under the given origin.
 */
export const GLYPHS_PATH = "/fonts/{fontstack}/{range}.pbf";
export const SPRITES_PATH = "/sprites";

export interface StyleOptions {
  /** Full URL of the PMTiles archive, on the maps site (src/config/basemap.ts archiveUrl). */
  pmtilesUrl: string;
  flavor: Flavor;
  /** Label language; local names are the fallback. */
  lang?: string;
  /** Origin the glyphs and sprites are served from (the site's). Defaults to no origin, i.e. root-relative paths. */
  assetsOrigin?: string;
  /** The region draws its own subway lines and stations, so the basemap's rail and stations go (OWN_TRANSIT_REPLACES). */
  ownTransit?: boolean;
}

/** The basemap layers after the atlas rules. Pure; the map adds pins on top. */
export function atlasLayers(flavor: Flavor, lang = "en", ownTransit = false): LayerSpecification[] {
  const out: LayerSpecification[] = [];
  let rail: LayerSpecification | undefined;
  for (const layer of basemapLayers(SOURCE_ID, namedFlavor(flavor), { lang })) {
    if (DROPPED_LAYERS.has(layer.id) || (ownTransit && OWN_TRANSIT_REPLACES.has(layer.id))) continue;
    let l = layer.id === "pois" ? stationsOnly(layer) : layer;
    const minzoom = MIN_ZOOM[l.id];
    if (minzoom !== undefined) l = { ...l, minzoom } as LayerSpecification;
    const paint = paintFor(l.id, flavor);
    if (paint) l = { ...l, paint: { ...(l as { paint?: object }).paint, ...paint } } as LayerSpecification;
    if (l.id === RAIL) {
      rail = l; // held back until the last road layer is out
      continue;
    }
    // Rail goes in after the last road; if Protomaps ever renames that layer, before the first label instead.
    if (rail && l.type === "symbol") {
      out.push(rail);
      rail = undefined;
    }
    out.push(l);
    if (rail && l.id === RAIL_AFTER) {
      out.push(rail);
      rail = undefined;
    }
  }
  if (rail) out.push(rail);
  return out;
}

/**
 * The Area page's quiet basemap (docs/proposals/filter-pages-and-area-map.md,
 * Part 3): every basemap label and every road hides, so the area names are
 * the only text; land, water, parks and the rail lines stay.
 */
export const QUIET_RAIL = RAIL;

export function quietHides(layer: { id: string; type: string; source?: unknown }): boolean {
  if (layer.source !== SOURCE_ID) return false;
  return layer.type === "symbol" || (layer.id.startsWith("roads_") && layer.id !== QUIET_RAIL);
}

/**
 * The rail lines restyled to read at city zoom, where Protomaps' faint
 * dotted line is under a pixel wide: solid, a little heavier, grey enough
 * to sit under the areas' colours. Trains are how people get between areas.
 */
export function quietRailPaint(flavor: Flavor): Record<string, unknown> {
  return {
    "line-color": flavor === "light" ? "#8d979b" : "#5d636c",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 13, 1.4],
    "line-opacity": 0.9,
    "line-dasharray": [1, 0],
  };
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
    layers: atlasLayers(opts.flavor, opts.lang, opts.ownTransit ?? false),
    // Not part of the spec proper; read back by tests and the map for the page background.
    metadata: { background: flavor.background },
  };
}
