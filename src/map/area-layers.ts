import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { rgbFromHex, type AreaColour } from "../config/area-colors.ts";
import { labelPoint, type AreaShapes } from "../data/area-shapes.ts";
import type { AreaLook } from "../filter/apply.ts";
import type { MapView } from "./map.ts";
import { belowPins } from "./pins.ts";
import type { Flavor } from "./style.ts";

/**
 * The areas on the map (docs/proposals/filter-pages-and-area-map.md, Part
 * 3), in the looks of their chips: picked areas filled, areas added by
 * + Adjacent hatched with a dashed edge, the rest outlined; each in its
 * chip's colour, with its name. Drawn only while the Area page is open.
 *
 * Added before the pins, so the pins draw on top; re-added, with the
 * hatch images, after every style load (a theme switch loads a new style).
 */
const SOURCE = "areas";
const LABELS = "areas-labels";
const FONT = ["Noto Sans Medium"];
/** How strongly a picked area's colour covers the map. */
const FILL_OPACITY = 0.4;

export interface AreaDrawing {
  shapes: AreaShapes;
  /** Each chip's look; a chip missing here is out. */
  looks: ReadonlyMap<string, AreaLook>;
  colours: ReadonlyMap<string, AreaColour>;
}

export interface AreaLayers {
  /** Draw these areas, or none. */
  set(drawing: AreaDrawing | undefined): void;
}

/** Labels are placed in this order where they collide: picked areas' names win, then added, then the rest. */
const RANK: Record<AreaLook, number> = { picked: 0, added: 1, out: 2 };

export function createAreaLayers(view: MapView): AreaLayers {
  let drawing: AreaDrawing | undefined;
  const flavor = (): Flavor => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const polygons = (): FeatureCollection<Polygon | MultiPolygon> => {
    if (!drawing) return { type: "FeatureCollection", features: [] };
    const { shapes, looks, colours } = drawing;
    const f = flavor();
    return {
      type: "FeatureCollection",
      features: shapes.features.map((s) => {
        const chip = s.properties.chip;
        const colour = colours.get(chip);
        return {
          type: "Feature",
          geometry: s.geometry,
          properties: { chip, look: looks.get(chip) ?? "out", fill: colour?.fill ?? "#888888", line: colour?.line[f] ?? "#666666", pattern: hatchId(chip) },
        };
      }),
    };
  };

  const labels = (): FeatureCollection<Point> => {
    if (!drawing) return { type: "FeatureCollection", features: [] };
    const { shapes, looks, colours } = drawing;
    const f = flavor();
    const points = labelPoints(shapes);
    return {
      type: "FeatureCollection",
      features: shapes.features.map((s) => {
        const chip = s.properties.chip;
        const at = points.get(chip)!;
        const look = looks.get(chip) ?? "out";
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [at.lng, at.lat] },
          properties: { chip, look, rank: RANK[look], line: colours.get(chip)?.line[f] ?? "#666666" },
        };
      }),
    };
  };

  /** One hatch image per area colour; images go with the style, so each load adds them again. */
  const addImages = (m: MapLibreMap): void => {
    if (!drawing) return;
    for (const [chip, colour] of drawing.colours) {
      const id = hatchId(chip);
      if (m.hasImage(id)) continue;
      m.addImage(id, { width: HATCH_TILE, height: HATCH_TILE, data: hatchTile(rgbFromHex(colour.fill)) }, { pixelRatio: 2 });
    }
  };

  const add = (m: MapLibreMap): void => {
    if (m.getSource(SOURCE)) return;
    const before = belowPins(m); // beneath the pins, whichever was added first
    const halo = getComputedStyle(document.documentElement).getPropertyValue("--bg-raised").trim() || "#ffffff";
    addImages(m);
    m.addSource(SOURCE, { type: "geojson", data: polygons() });
    m.addSource(LABELS, { type: "geojson", data: labels() });
    m.addLayer({
      id: `${SOURCE}-fill`,
      type: "fill",
      source: SOURCE,
      filter: ["==", ["get", "look"], "picked"],
      paint: { "fill-color": ["get", "fill"], "fill-opacity": FILL_OPACITY },
    }, before);
    m.addLayer({
      id: `${SOURCE}-hatch`,
      type: "fill",
      source: SOURCE,
      filter: ["==", ["get", "look"], "added"],
      paint: { "fill-pattern": ["get", "pattern"] },
    }, before);
    m.addLayer({
      id: `${SOURCE}-line`,
      type: "line",
      source: SOURCE,
      filter: ["!=", ["get", "look"], "added"],
      layout: { "line-join": "round" },
      paint: { "line-color": ["get", "line"], "line-width": ["match", ["get", "look"], "picked", 2.2, 1.4] },
    }, before);
    m.addLayer({
      id: `${SOURCE}-line-added`,
      type: "line",
      source: SOURCE,
      filter: ["==", ["get", "look"], "added"],
      paint: { "line-color": ["get", "line"], "line-width": 1.6, "line-dasharray": [2.5, 1.5] },
    }, before);
    m.addLayer({
      id: `${SOURCE}-label`,
      type: "symbol",
      source: LABELS,
      layout: {
        "text-field": ["get", "chip"],
        "text-font": FONT,
        "text-size": ["match", ["get", "look"], "out", 11, 12.5],
        "text-max-width": 7,
        "text-padding": 2,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": ["get", "line"], "text-halo-color": halo, "text-halo-width": 1.6 },
    }, before);
  };
  view.onStyleLoad(add);

  return {
    set(next) {
      if (next === drawing) return;
      drawing = next;
      const m = view.map;
      const src = m.getSource(SOURCE) as GeoJSONSource | undefined;
      if (!src) return; // the style is still loading; `add` will draw it
      addImages(m);
      src.setData(polygons());
      (m.getSource(LABELS) as GeoJSONSource | undefined)?.setData(labels());
    },
  };
}

const hatchId = (chip: string): string => `area-hatch:${chip}`;

const labelCache = new WeakMap<AreaShapes, Map<string, { lat: number; lng: number }>>();

/** Each area's label point, worked out once per set of shapes. */
function labelPoints(shapes: AreaShapes): Map<string, { lat: number; lng: number }> {
  let points = labelCache.get(shapes);
  if (!points) {
    points = new Map(shapes.features.map((f) => [f.properties.chip, labelPoint(f.geometry)]));
    labelCache.set(shapes, points);
  }
  return points;
}

/** The hatch image's side in device pixels: 10 CSS pixels at pixelRatio 2. */
export const HATCH_TILE = 20;

/**
 * A seamless tile of diagonal stripes, rising left to right like the
 * chips' (CSS's 135° gradient): stripes at `lineAlpha` over a faint wash.
 * A pixel's stripe is set by (x + y) mod the tile size, so the tile
 * repeats without a seam; edges are anti-aliased by distance. The gap
 * between stripes comes to 7 CSS pixels, as on the chips. RGBA bytes,
 * not premultiplied, as MapLibre's addImage takes them.
 */
export function hatchTile(rgb: readonly [number, number, number], lineAlpha = 0.8, washAlpha = 0.1): Uint8ClampedArray {
  const n = HATCH_TILE;
  const halfWidth = 1.5; // device pixels: 1.5 CSS pixels in all
  const out = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const s = (x + y + 1) % n; // pixel centres sit at +0.5 on each axis
      const d = Math.min(s, n - s) / Math.SQRT2; // perpendicular distance to the nearest stripe's centre
      const cover = Math.max(0, Math.min(1, halfWidth + 0.5 - d));
      const i = (y * n + x) * 4;
      out[i] = Math.round(rgb[0] * 255);
      out[i + 1] = Math.round(rgb[1] * 255);
      out[i + 2] = Math.round(rgb[2] * 255);
      out[i + 3] = Math.round((washAlpha + (lineAlpha - washAlpha) * cover) * 255);
    }
  }
  return out;
}
