import {
  addProtocol,
  AttributionControl,
  Map as MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type LngLatBoundsLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre runs tile parsing in a web worker it locates relative to its own
// module URL, which doesn't survive bundling. Vite's ?worker&url builds the
// worker (and its imports) into its own chunk and gives us a stable URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";

setWorkerUrl(workerUrl);
import type { RegionConfig } from "../data/types.ts";
import { atlasStyle, type Flavor } from "./style.ts";

/** Japan, for regions that have no basemap extract yet. */
const JAPAN_BOUNDS: LngLatBoundsLike = [
  [129, 31],
  [146, 45.5],
];

let protocolRegistered = false;

/**
 * MapLibre doesn't know PMTiles. The pmtiles package registers a
 * `pmtiles://` URL scheme whose tile requests become HTTP range requests
 * against the one archive (online) or reads from a stored Blob (M7).
 */
function ensureProtocol(): void {
  if (protocolRegistered) return;
  addProtocol("pmtiles", new Protocol().tile);
  protocolRegistered = true;
}

export interface MapView {
  map: MapLibreMap;
  /** Swap basemap and fit to the region's bounds. */
  setRegion(region: RegionConfig): void;
  setFlavor(flavor: Flavor): void;
  /** Space the bottom panel covers, so fits and eases keep targets visible. */
  setBottomPadding(px: number): void;
  /** Called after every style (re)load: overlays must be re-added then. */
  onStyleLoad(cb: (map: MapLibreMap) => void): void;
  destroy(): void;
}

export function basemapUrl(region: RegionConfig): string {
  return `${location.origin}/basemap/${region.id}.pmtiles`;
}

export function mountMap(container: HTMLElement, region: RegionConfig, flavor: Flavor): MapView {
  ensureProtocol();
  let currentRegion = region;
  let currentFlavor = flavor;
  const styleLoadCallbacks: ((map: MapLibreMap) => void)[] = [];

  const map = new MapLibreMap({
    container,
    style: styleFor(region, flavor),
    bounds: region.bbox ?? JAPAN_BOUNDS,
    maxZoom: 18,
    attributionControl: false,
    // Japanese labels without shipping CJK glyphs: the device's own font.
    localIdeographFontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', sans-serif",
  });
  // The bottom edge sits under the panel, so controls go on top.
  map.addControl(new AttributionControl({ compact: true }), "top-right");
  map.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "top-left");

  map.on("style.load", () => {
    for (const cb of styleLoadCallbacks) cb(map);
  });
  // Debug handle for the browser console; harmless in production.
  (window as unknown as { __japlanning?: unknown }).__japlanning = { map };

  return {
    map,
    setRegion(next) {
      if (next.id === currentRegion.id) return;
      currentRegion = next;
      map.setStyle(styleFor(next, currentFlavor));
      map.fitBounds(next.bbox ?? JAPAN_BOUNDS, { duration: 0 });
    },
    setFlavor(next) {
      if (next === currentFlavor) return;
      currentFlavor = next;
      map.setStyle(styleFor(currentRegion, next));
    },
    setBottomPadding(px) {
      map.setPadding({ top: 0, left: 0, right: 0, bottom: Math.max(0, Math.round(px)) });
    },
    onStyleLoad(cb) {
      styleLoadCallbacks.push(cb);
      if (map.isStyleLoaded()) cb(map);
    },
    destroy() {
      map.remove();
    },
  };
}

function styleFor(region: RegionConfig, flavor: Flavor) {
  if (!region.bbox) {
    // No extract yet: a plain background so the page isn't a wall of tile errors.
    const style = atlasStyle({ pmtilesUrl: basemapUrl(region), flavor });
    return { ...style, sources: {}, layers: style.layers.filter((l) => l.type === "background") };
  }
  return atlasStyle({ pmtilesUrl: basemapUrl(region), flavor });
}

/** Follow the system colour scheme; `onChange` fires on runtime switches. */
export function watchFlavor(onChange: (flavor: Flavor) => void): Flavor {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => onChange(e.matches ? "dark" : "light"));
  return mq.matches ? "dark" : "light";
}
