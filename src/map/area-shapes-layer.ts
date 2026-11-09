import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { polygonsOf, type AreaShapes, type ShapeProps } from "../data/area-shapes.ts";
import type { MapView } from "./map.ts";

const SOURCE = "area-shapes";
const FONT = ["Noto Sans Medium"];

/**
 * A review palette of distinct hues, so shapes that touch can be told
 * apart. Part 3 replaces it with the section colours
 * (docs/proposals/filter-pages-and-area-map.md).
 */
const PALETTE = ["#d7263d", "#f46036", "#b8860b", "#2e933c", "#1b98e0", "#5c4ab8", "#c2185b", "#00897b"];

export interface AreaShapesLayer {
  /** Draw these shapes, or nothing. */
  set(shapes: AreaShapes | undefined): void;
}

/**
 * The area shapes over the map for review (Settings → Area shapes on the
 * map): a light fill, an outline and the chip's name, each area in its
 * own colour. Added before the pins so they draw above it.
 */
export function createAreaShapesLayer(view: MapView): AreaShapesLayer {
  let current: AreaShapes | undefined;
  const data = (): FeatureCollection<Polygon | MultiPolygon, ShapeProps & { colour: string }> =>
    current ? coloured(current) : { type: "FeatureCollection", features: [] };

  const add = (m: MapLibreMap): void => {
    if (m.getSource(SOURCE)) return;
    const halo = getComputedStyle(document.documentElement).getPropertyValue("--bg-raised").trim() || "#ffffff";
    m.addSource(SOURCE, { type: "geojson", data: data() });
    m.addLayer({ id: `${SOURCE}-fill`, type: "fill", source: SOURCE, paint: { "fill-color": ["get", "colour"], "fill-opacity": 0.16 } });
    m.addLayer({ id: `${SOURCE}-line`, type: "line", source: SOURCE, paint: { "line-color": ["get", "colour"], "line-width": 1.6 } });
    m.addLayer({
      id: `${SOURCE}-label`,
      type: "symbol",
      source: SOURCE,
      layout: { "text-field": ["get", "chip"], "text-font": FONT, "text-size": 12, "text-max-width": 8 },
      paint: { "text-color": ["get", "colour"], "text-halo-color": halo, "text-halo-width": 1.6 },
    });
  };
  view.onStyleLoad(add);

  return {
    set(next) {
      if (next === current) return;
      current = next;
      (view.map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data());
    },
  };
}

/** Colour each shape, greedily, so shapes whose boxes come within ~100 m of each other differ. */
function coloured(shapes: AreaShapes): FeatureCollection<Polygon | MultiPolygon, ShapeProps & { colour: string }> {
  const boxes = shapes.features.map((f) => box(f));
  const picks: number[] = [];
  const features = shapes.features.map((f, i) => {
    const taken = new Set(picks.filter((_, j) => near(boxes[i]!, boxes[j]!)));
    const pick = [...PALETTE.keys()].find((k) => !taken.has(k)) ?? i % PALETTE.length;
    picks.push(pick);
    return { ...f, properties: { ...f.properties, colour: PALETTE[pick]! } };
  });
  return { type: "FeatureCollection", features };
}

type Box = [number, number, number, number];

function box(f: Feature<Polygon | MultiPolygon>): Box {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const rings of polygonsOf(f.geometry)) {
    for (const [lng, lat] of rings[0] ?? []) {
      w = Math.min(w, lng!);
      e = Math.max(e, lng!);
      s = Math.min(s, lat!);
      n = Math.max(n, lat!);
    }
  }
  return [w, s, e, n];
}

/** About 100 m of slack, in degrees, at Japan's latitudes. */
const SLACK = 0.001;

function near(a: Box, b: Box): boolean {
  return a[0] - SLACK <= b[2] && b[0] - SLACK <= a[2] && a[1] - SLACK <= b[3] && b[1] - SLACK <= a[3];
}
