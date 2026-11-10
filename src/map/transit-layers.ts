import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { lineFilter, stationFilter, type TransitData } from "../data/transit.ts";
import type { MapView } from "./map.ts";
import { belowPins } from "./pins.ts";

/**
 * The subway lines in their own colours, with white station dots and
 * their names (docs/proposals/m8-transit.md): a thin casing in the land's
 * colour under each line so crossings stay apart, as on a subway diagram.
 * They replace the basemap's rail and stations in these regions
 * (style.ts, OWN_TRANSIT_REPLACES). Lines can be hidden one by one.
 *
 * Added before the pins, so the pins draw on top, and above whatever was
 * added earlier (the area shapes); re-added after every style load.
 */
const SOURCE = "transit";
const CASING = "transit-casing";
const LINE = "transit-line";
const STATION = "transit-station";
const LABEL = "transit-label";
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
    m.setFilter(LABEL, stationFilter(hidden, lineIds()) as FilterSpecification);
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
    // Names beside the dots, in the blue the basemap used for stations; the Japanese below from street level.
    m.addLayer({
      id: LABEL,
      type: "symbol",
      source: SOURCE,
      minzoom: 12,
      filter: stationFilter(hidden, lineIds()) as FilterSpecification,
      layout: {
        "text-field": ["step", ["zoom"], ["get", "en"], 15, ["format", ["get", "en"], {}, "\n", {}, ["get", "name"], { "font-scale": 0.85 }]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10.5, 15, 12, 17, 13],
        "text-variable-anchor": ["left", "right", "top", "bottom"],
        "text-radial-offset": 0.75,
        "text-justify": "auto",
        "text-max-width": 8,
        "text-padding": 2,
        // Interchanges first where names collide.
        "symbol-sort-key": ["-", 0, ["length", ["get", "lines"]]],
      },
      paint: { "text-color": dark ? "#8fb0f5" : "#315bcf", "text-halo-color": dark ? "#1f1f1f" : "#ffffff", "text-halo-width": 1.3 },
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
