import {
  addProtocol,
  Map as MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type IControl,
  type LngLat,
  type LngLatBoundsLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre runs tile parsing in a web worker it locates relative to its own
// module URL, which doesn't survive bundling. Vite's ?worker&url builds the
// worker (and its imports) into its own chunk and gives us a stable URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";

setWorkerUrl(workerUrl);
import { archiveUrl } from "../config/basemap.ts";
import { TRANSIT_REGIONS } from "../config/transit.ts";
import type { RegionConfig } from "../data/types.ts";
import { createLocateControl, type LocateControl } from "./locate-control.ts";
import { atlasLayers, atlasStyle, QUIET_RAIL, quietHides, quietRailPaint, type Flavor } from "./style.ts";

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
  /**
   * The Area page's map (docs/proposals/filter-pages-and-area-map.md, Part
   * 3): ease to fit these bounds ([west, south, east, north]) above the
   * panel, quiet the basemap and hide the locate button. Pan and zoom stay
   * on (2026-11-10), so calling it again while on reframes the city.
   * Undefined puts everything back, and the camera where it was; or, with
   * `leaveTo`, frames those bounds instead (the area filter changed, so
   * the old view may hold none of the results).
   */
  setAreaMode(bounds: readonly [number, number, number, number] | undefined, leaveTo?: readonly [number, number, number, number]): void;
  destroy(): void;
}

type PaintProperty = Parameters<MapLibreMap["setPaintProperty"]>[1];
type PaintValue = Parameters<MapLibreMap["setPaintProperty"]>[2];

/** Room around the areas: the scale bar sits in the top-left corner. */
const AREA_PADDING = { top: 40, right: 12, bottom: 12, left: 12 };
/** Framing the areas in play on leaving the Area page: snug, with room on the left for the buttons. */
const LEAVE_PADDING = { top: 40, right: 24, bottom: 24, left: 48 };

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

/**
 * A region's archive on the maps site (docs/proposals/maps-site.md), with
 * its version in the query. Stored copies are kept by region, not by
 * address, and registered under this, so the address can change freely.
 */
export function basemapUrl(region: RegionConfig): string {
  return archiveUrl(region.id, region.bbox);
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
  /**
   * The current real style has loaded, so overlays can be added now. Not
   * map.isStyleLoaded(): that also waits for every tile, so a renderer
   * created mid-pan (a Settings change) would wait for a style load that
   * never comes.
   */
  let styleReady = false;
  const setStyle = (style: Parameters<MapLibreMap["setStyle"]>[0]) => {
    styleReady = false;
    map.setStyle(style);
  };
  map.on("style.load", () => {
    if (!styled) return; // the empty placeholder style
    styleReady = true;
    if (areaMode) quietBasemap(true); // a new style (the theme changed) arrives with everything showing
    for (const cb of styleLoadCallbacks) cb(map);
  });
  void (callbacks.prepareBasemaps?.(proto) ?? Promise.resolve()).finally(() => {
    styled = true;
    setStyle(styleFor(currentRegion, currentFlavor));
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

  // ---- the Area page's map ----
  let areaMode: { camera: { center: LngLat; zoom: number; bearing: number; pitch: number } } | undefined;

  /**
   * Camera moves wait for the end of the current task. The app changes the
   * panel's height in the same tap that opens or closes the Area page, and
   * that sets the map's padding, which is a jump: it would cancel an ease
   * already under way. Queued, the ease starts from the new padding.
   */
  let queued: ReturnType<typeof setTimeout> | undefined;
  const afterThisTask = (move: () => void): void => {
    if (queued !== undefined) clearTimeout(queued);
    queued = setTimeout(() => {
      queued = undefined;
      move();
    }, 0);
  };

  /** Hide the basemap's labels and roads and restyle its rail lines, or put them back as the style has them. */
  function quietBasemap(on: boolean): void {
    for (const layer of atlasLayers(currentFlavor)) {
      if (!map.getLayer(layer.id)) continue; // a region with no basemap yet, or the style still loading
      if (quietHides(layer)) {
        map.setLayoutProperty(layer.id, "visibility", on ? "none" : "visible");
      } else if (layer.id === QUIET_RAIL) {
        const quiet = quietRailPaint(currentFlavor);
        const paint = on ? quiet : ((layer as { paint?: Record<string, unknown> }).paint ?? {});
        for (const prop of Object.keys(quiet) as PaintProperty[]) map.setPaintProperty(layer.id, prop, paint[prop] as PaintValue);
      }
    }
  }

  return {
    map,
    locate,
    setAreaMode(bounds, leaveTo) {
      if (bounds) {
        if (!areaMode) {
          areaMode = { camera: { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() } };
          container.classList.add("is-area-map");
          labelFitButton(container, true);
          quietBasemap(true);
        }
        const [w, s, e, n] = bounds;
        afterThisTask(() => map.fitBounds([[w, s], [e, n]], { padding: AREA_PADDING, bearing: 0, pitch: 0, duration: 450 }));
      } else if (areaMode) {
        const { camera } = areaMode;
        areaMode = undefined;
        container.classList.remove("is-area-map");
        labelFitButton(container, false);
        quietBasemap(false);
        if (leaveTo) {
          const [w, s, e, n] = leaveTo;
          afterThisTask(() => map.fitBounds([[w, s], [e, n]], { padding: LEAVE_PADDING, maxZoom: 16, bearing: camera.bearing, duration: 450 }));
        } else {
          afterThisTask(() => map.easeTo({ ...camera, duration: 450 }));
        }
      }
    },
    setRegion(next) {
      if (next.id === currentRegion.id) return;
      // A camera move still queued (the Area page closing as the region changes) belongs to the old region.
      if (queued !== undefined) clearTimeout(queued);
      queued = undefined;
      currentRegion = next;
      setStyle(styleFor(next, currentFlavor));
      fitRegion(next.bbox ?? JAPAN_BOUNDS);
    },
    setFlavor(next) {
      if (next === currentFlavor) return;
      currentFlavor = next;
      setStyle(styleFor(currentRegion, next));
    },
    setBottomPadding(px) {
      map.setPadding({ top: 0, left: 0, right: 0, bottom: Math.max(0, Math.round(px)) });
    },
    onStyleLoad(cb) {
      styleLoadCallbacks.push(cb);
      if (styleReady) cb(map);
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
  button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>
      <circle cx="12" cy="12" r="2.5"/>
    </svg>`;
  button.addEventListener("click", onFit);
  labelButton(button, false);
  return { onAdd: () => button, onRemove: () => button.remove() };
}

/** The fit button frames the results, or on the Area page the whole city. */
function labelButton(button: HTMLElement, areaMap: boolean): void {
  button.setAttribute("aria-label", areaMap ? "Fit map to the city" : "Fit map to results");
  button.title = areaMap ? "Fit to the city" : "Fit to results";
}

function labelFitButton(container: HTMLElement, areaMap: boolean): void {
  const button = container.querySelector<HTMLElement>(".fit-button");
  if (button) labelButton(button, areaMap);
}

function styleFor(region: RegionConfig, flavor: Flavor) {
  // Where we draw our own subway lines and stations (src/map/transit-layers.ts), the basemap's rail and stations go.
  const ownTransit = TRANSIT_REGIONS.includes(region.id);
  const style = atlasStyle({ pmtilesUrl: basemapUrl(region), flavor, assetsOrigin: location.origin, ownTransit });
  if (!region.bbox) {
    // No extract yet: a plain background so the page isn't a wall of tile errors.
    return { ...style, sources: {}, layers: style.layers.filter((l) => l.type === "background") };
  }
  return style;
}

/** Follow the system colour scheme; `onChange` fires on runtime switches. */
export function watchFlavor(onChange: (flavor: Flavor) => void): Flavor {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => onChange(e.matches ? "dark" : "light"));
  return mq.matches ? "dark" : "light";
}
