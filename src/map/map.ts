import {
  addProtocol,
  Map as MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type IControl,
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
import { createLocateControl, type LocateControl } from "./locate-control.ts";
import { atlasStyle, type Flavor } from "./style.ts";

/** Japan, for regions that have no basemap extract yet. */
const JAPAN_BOUNDS: LngLatBoundsLike = [
  [129, 31],
  [146, 45.5],
];

let protocol: Protocol | undefined;

/**
 * MapLibre doesn't know PMTiles. The pmtiles package registers a
 * `pmtiles://` URL scheme whose tile requests become HTTP range requests
 * against the one archive (online) or, once a stored Blob has been added
 * to the protocol for that URL (src/offline/basemap.ts), slices of it.
 */
export function ensureProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);
  }
  return protocol;
}

export interface MapView {
  map: MapLibreMap;
  /** The locate button, dot and ring; the app feeds it fixes. */
  locate: LocateControl;
  /** Swap basemap and fit to the region's bounds. */
  setRegion(region: RegionConfig): void;
  setFlavor(flavor: Flavor): void;
  /** Space the bottom panel covers, so fits and eases keep targets visible. */
  setBottomPadding(px: number): void;
  /** Called after every style (re)load: overlays must be re-added then. */
  onStyleLoad(cb: (map: MapLibreMap) => void): void;
  /** Centre on a point, zooming in to at least `minZoom` but never out. */
  focus(lng: number, lat: number, minZoom?: number): void;
  /** Fit the given points with a margin, honouring the bottom padding. */
  fitPoints(points: [number, number][]): void;
  destroy(): void;
}

export interface MapCallbacks {
  /** The fit-to-results button. */
  onFit(): void;
  /** The locate button was tapped with no fix yet: start watching. */
  onLocateRequest(): void;
  /**
   * Runs before the first style is set, with the pmtiles protocol, so
   * stored basemaps can be registered ahead of the first tile request.
   */
  prepareBasemaps?(protocol: Protocol): Promise<void>;
}

export function basemapUrl(region: RegionConfig): string {
  return `${location.origin}/basemap/${region.id}.pmtiles`;
}

export function mountMap(container: HTMLElement, region: RegionConfig, flavor: Flavor, callbacks: MapCallbacks): MapView {
  const proto = ensureProtocol();
  let currentRegion = region;
  let currentFlavor = flavor;
  const styleLoadCallbacks: ((map: MapLibreMap) => void)[] = [];

  // The real style waits for prepareBasemaps (a few ms of IndexedDB), so the
  // first tile requests already find a stored archive when there is one.
  const map = new MapLibreMap({
    container,
    style: { version: 8, sources: {}, layers: [] },
    bounds: region.bbox ?? JAPAN_BOUNDS,
    maxZoom: 18,
    attributionControl: false,
    // Japanese labels without shipping CJK glyphs: the device's own font.
    localIdeographFontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', sans-serif",
  });
  // The bottom edge sits under the panel, so the scale goes on top. The
  // OpenStreetMap credit the licence requires lives in the panel strip
  // (always on screen) instead of MapLibre's attribution control.
  map.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "top-left");
  // Our own buttons join MapLibre's top-left stack so the spacing is one rule, not three.
  map.addControl(fitControl(callbacks.onFit), "top-left");
  const locate = createLocateControl({ onRequest: callbacks.onLocateRequest });
  map.addControl(locate, "top-left");

  let styled = false;
  map.on("style.load", () => {
    if (!styled) return; // the empty placeholder style
    for (const cb of styleLoadCallbacks) cb(map);
  });
  void (callbacks.prepareBasemaps?.(proto) ?? Promise.resolve()).finally(() => {
    styled = true;
    map.setStyle(styleFor(currentRegion, currentFlavor));
  });
  // Debug handle for the browser console; harmless in production.
  (window as unknown as { __japlanning?: unknown }).__japlanning = { map, locate };

  /**
   * Jump to frame a region as if the panel covered at most half the map.
   * A fit subtracts the map's padding first, so with the list at Full it
   * would frame the region in the few pixels left and zoom out to all of
   * Japan. Framed for Half instead, it is right when the panel comes down.
   * The padding goes back straight after the jump, which keeps the centre.
   */
  function fitRegion(bounds: LngLatBoundsLike): void {
    const padding = map.getPadding();
    const cap = Math.round(container.clientHeight / 2);
    if ((padding.bottom ?? 0) <= cap) {
      map.fitBounds(bounds, { duration: 0 });
      return;
    }
    map.setPadding({ ...padding, bottom: cap });
    map.fitBounds(bounds, { duration: 0 });
    map.setPadding(padding);
  }

  return {
    map,
    locate,
    setRegion(next) {
      if (next.id === currentRegion.id) return;
      currentRegion = next;
      map.setStyle(styleFor(next, currentFlavor));
      fitRegion(next.bbox ?? JAPAN_BOUNDS);
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
      if (styled && map.isStyleLoaded()) cb(map);
    },
    focus(lng, lat, minZoom = 15) {
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), minZoom), duration: 500 });
    },
    fitPoints(points) {
      if (points.length === 0) return;
      if (points.length === 1) {
        const [lng, lat] = points[0]!;
        map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 500 });
        return;
      }
      let w = Infinity;
      let s = Infinity;
      let e = -Infinity;
      let n = -Infinity;
      for (const [lng, lat] of points) {
        w = Math.min(w, lng);
        e = Math.max(e, lng);
        s = Math.min(s, lat);
        n = Math.max(n, lat);
      }
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 48, maxZoom: 16, duration: 500 },
      );
    },
    destroy() {
      map.remove();
    },
  };
}

/** The fit-to-results button as a MapLibre control, so it stacks with the others. */
function fitControl(onFit: () => void): IControl {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "maplibregl-ctrl fit-button";
  button.setAttribute("aria-label", "Fit map to results");
  button.title = "Fit to results";
  button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>
      <circle cx="12" cy="12" r="2.5"/>
    </svg>`;
  button.addEventListener("click", onFit);
  return { onAdd: () => button, onRemove: () => button.remove() };
}

function styleFor(region: RegionConfig, flavor: Flavor) {
  if (!region.bbox) {
    // No extract yet: a plain background so the page isn't a wall of tile errors.
    const style = atlasStyle({ pmtilesUrl: basemapUrl(region), flavor, assetsOrigin: location.origin });
    return { ...style, sources: {}, layers: style.layers.filter((l) => l.type === "background") };
  }
  return atlasStyle({ pmtilesUrl: basemapUrl(region), flavor, assetsOrigin: location.origin });
}

/** Follow the system colour scheme; `onChange` fires on runtime switches. */
export function watchFlavor(onChange: (flavor: Flavor) => void): Flavor {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => onChange(e.matches ? "dark" : "light"));
  return mq.matches ? "dark" : "light";
}
