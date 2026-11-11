import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { lineFilter, stationFilter, type TransitData } from "../data/transit.ts";
import type { MapView } from "./map.ts";
import { belowPins } from "./pins.ts";
import { SOURCE_ID } from "./style.ts";

/**
 * The subway lines in their own colours, with white station dots and
 * their names (docs/proposals/m8-transit.md): a thin casing in the land's
 * colour under each line so crossings stay apart, as on a subway diagram.
 * They replace the basemap's rail and stations in these regions
 * (style.ts, OWN_TRANSIT_REPLACES). Lines can be hidden one by one.
 *
 * The lines and dots go under the basemap's first text layer, so street
 * and district names stay readable on top of them; the station names go
 * just under our pins, above the basemap's text (Jerry, 2026-11-10).
 * A tapped station's dot or name opens its card (the app asks
 * `stationAt`), and the open station's dot is drawn larger, ringed in
 * the colour of the line its card's arrows follow.
 * Re-added after every style load.
 */
const SOURCE = "transit";
const CASING = "transit-casing";
const LINE = "transit-line";
/** Track one line shares with another (the Mita on the Namboku's), dashed over the other's colour. */
const SHARED = "transit-line-shared";
const STATION = "transit-station";
const LABEL = "transit-label";
/** The open station's dot, drawn larger above the rest. */
const SELECTED = "transit-station-selected";
const EMPTY: TransitData = { type: "FeatureCollection", features: [] };

export interface TransitLayers {
  /** Draw this region's transit, or none. */
  set(data: TransitData | undefined): void;
  /** Hide these line ids (and stations served only by them). */
  setHidden(hidden: ReadonlySet<string>): void;
  /** Off on the Area page, where the lines made the map too busy (Jerry, 2026-11-10): every transit layer hides. */
  setVisible(on: boolean): void;
  /** Ring the open station's dot (its data id) in the colour of the line its arrows follow, or none. */
  setSelected(id: string | undefined, colour?: string): void;
  /** The station whose dot or name is nearest a tap (screen pixels), within `slop` pixels; undefined for none. */
  stationAt(point: { x: number; y: number }, slop: number): string | undefined;
}

const flavor = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export function createTransitLayers(view: MapView): TransitLayers {
  let data: TransitData | undefined;
  let hidden: ReadonlySet<string> = new Set();
  let visible = true;
  const LAYERS = [CASING, LINE, SHARED, STATION, LABEL, SELECTED];
  const applyVisible = (m: MapLibreMap): void => {
    for (const id of LAYERS) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  };
  let selected: string | undefined;
  let selectedColour: string | undefined;
  const ringColour = () => selectedColour ?? (flavor() === "dark" ? "#8fb0f5" : "#315bcf");
  const selectedFilter = (): FilterSpecification => ["all", ["==", ["get", "kind"], "station"], ["==", ["get", "id"], selected ?? ""]];
  const lineIds = () => [...new Set((data?.features ?? []).flatMap((f) => (f.properties.kind === "line" ? [f.properties.id] : [])))];

  const applyFilters = (m: MapLibreMap): void => {
    if (!m.getLayer(LINE)) return;
    const lines = lineFilter(hidden) as FilterSpecification;
    m.setFilter(CASING, lines);
    m.setFilter(LINE, lineFilter(hidden, false) as FilterSpecification);
    m.setFilter(SHARED, lineFilter(hidden, true) as FilterSpecification);
    m.setFilter(STATION, stationFilter(hidden, lineIds()) as FilterSpecification);
    m.setFilter(LABEL, stationFilter(hidden, lineIds()) as FilterSpecification);
  };

  const add = (m: MapLibreMap): void => {
    if (m.getSource(SOURCE)) return;
    const before = belowPins(m);
    // The first basemap label layer: everything drawn from there up is text.
    const underText = m.getStyle()?.layers?.find((l) => l.type === "symbol" && (l as { source?: string }).source === SOURCE_ID)?.id ?? before;
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
    }, underText);
    m.addLayer({
      id: LINE,
      type: "line",
      source: SOURCE,
      filter: lineFilter(hidden, false) as FilterSpecification,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "colour"], "line-width": width(1) },
    }, underText);
    m.addLayer({
      id: SHARED,
      type: "line",
      source: SOURCE,
      filter: lineFilter(hidden, true) as FilterSpecification,
      layout: { "line-join": "round" },
      paint: { "line-color": ["get", "colour"], "line-width": width(1), "line-dasharray": [1.2, 1.2] },
    }, underText);
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
    }, underText);
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
    m.addLayer({
      id: SELECTED,
      type: "circle",
      source: SOURCE,
      filter: selectedFilter(),
      paint: {
        "circle-color": "#ffffff",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 13, 6.5, 16, 9],
        "circle-stroke-color": ringColour(),
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 16, 3.5],
      },
    }, before);
    if (!visible) applyVisible(m);
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
    setVisible(on) {
      if (on === visible) return;
      visible = on;
      applyVisible(view.map);
    },
    setSelected(id, colour) {
      if (id === selected && colour === selectedColour) return;
      if (colour !== selectedColour) {
        selectedColour = colour;
        if (view.map.getLayer(SELECTED)) view.map.setPaintProperty(SELECTED, "circle-stroke-color", ringColour());
      }
      if (id === selected) return;
      selected = id;
      if (view.map.getLayer(SELECTED)) view.map.setFilter(SELECTED, selectedFilter());
    },
    stationAt(point, slop) {
      const m = view.map;
      const layers = [STATION, LABEL].filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");
      if (layers.length === 0) return undefined;
      const hits = m.queryRenderedFeatures(
        [
          [point.x - slop, point.y - slop],
          [point.x + slop, point.y + slop],
        ],
        { layers },
      );
      // A name can overlap another station's dot: the nearest station point wins.
      let best: string | undefined;
      let bestD = Infinity;
      for (const f of hits) {
        if (f.properties?.["kind"] !== "station" || f.geometry.type !== "Point") continue;
        const p = m.project(f.geometry.coordinates as [number, number]);
        const d = Math.hypot(p.x - point.x, p.y - point.y);
        if (d < bestD) {
          bestD = d;
          best = String(f.properties["id"]);
        }
      }
      return best;
    },
  };
}
