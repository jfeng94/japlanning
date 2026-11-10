import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { lineFilter, stationFilter, type TransitData } from "../data/transit.ts";
import type { MapView } from "./map.ts";
import { belowPins } from "./pins.ts";

/**
 * The subway lines in their own colours, with white station dots
 * (docs/proposals/m8-transit.md): a thin casing in the land's colour
 * under each line so crossings stay apart, as on a subway diagram. Station
 * names are the basemap's own labels. Lines can be hidden one by one.
 *
 * Added before the pins, so the pins draw on top, and above whatever was
 * added earlier (the area shapes); re-added after every style load.
 */
const SOURCE = "transit";
const CASING = "transit-casing";
const LINE = "transit-line";
const STATION = "transit-station";
const EMPTY: TransitData = { type: "FeatureCollection", features: [] };

export interface TransitLayers {
  /** Draw this region's transit, or none. */
  set(data: TransitData | undefined): void;
  /** Hide these line ids (and stations served only by them). */
  setHidden(hidden: ReadonlySet<string>): void;
}

const flavor = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export function createTransitLayers(view: MapView): TransitLayers {
  let data: TransitData | undefined;
  let hidden: ReadonlySet<string> = new Set();
  const lineIds = () => (data?.features ?? []).flatMap((f) => (f.properties.kind === "line" ? [f.properties.id] : []));

  const applyFilters = (m: MapLibreMap): void => {
    if (!m.getLayer(LINE)) return;
    const lines = lineFilter(hidden) as FilterSpecification;
    m.setFilter(CASING, lines);
    m.setFilter(LINE, lines);
    m.setFilter(STATION, stationFilter(hidden, lineIds()) as FilterSpecification);
  };

  const add = (m: MapLibreMap): void => {
    if (m.getSource(SOURCE)) return;
    const before = belowPins(m);
    const dark = flavor() === "dark";
    m.addSource(SOURCE, { type: "geojson", data: data ?? EMPTY });
    const width = (scale: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 10, 1.6 * scale, 13, 2.6 * scale, 16, 5 * scale];
    m.addLayer({
      id: CASING,
      type: "line",
      source: SOURCE,
      filter: lineFilter(hidden) as FilterSpecification,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": dark ? "#1f1f1f" : "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.8, 13, 4.2, 16, 7.5], "line-opacity": 0.9 },
    }, before);
    m.addLayer({
      id: LINE,
      type: "line",
      source: SOURCE,
      filter: lineFilter(hidden) as FilterSpecification,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "colour"], "line-width": width(1) },
    }, before);
    m.addLayer({
      id: STATION,
      type: "circle",
      source: SOURCE,
      minzoom: 11,
      filter: stationFilter(hidden, lineIds()) as FilterSpecification,
      paint: {
        "circle-color": "#ffffff",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 13, 3.2, 16, 5.5],
        "circle-stroke-color": dark ? "#9aa0a8" : "#3b3f45",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 16, 1.6],
      },
    }, before);
  };
  view.onStyleLoad(add);

  return {
    set(next) {
      if (next === data) return;
      data = next;
      const m = view.map;
      (m.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data ?? EMPTY);
      applyFilters(m);
    },
    setHidden(next) {
      hidden = next;
      applyFilters(view.map);
    },
  };
}
