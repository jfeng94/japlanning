import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import { ICON_IDS, iconAssetUrl, type IconId } from "../config/icons.ts";
import { pinLabelMinZoom } from "../config/map.ts";
import bookmarkIcon from "../ui/icons/bookmark.webp";
import type { MapView } from "./map.ts";
import { pinsToGeoJson, type Pin, type PinRenderer } from "./pins.ts";
import { loadSdfImage, type SdfImage } from "./sdf.ts";

const SOURCE = "pins";
const ICON_LAYER = "pins-icon";
const STAR_LAYER = "pins-star";
const BOOKMARK_LAYER = "pins-bookmark";
const BOOKMARK_IMAGE = "bookmark-badge";
const LABEL_LAYER = "pins-label";
const FONT = ["Noto Sans Medium"];

/** Drawn at 64 px, shown at 32 CSS px (pixelRatio 2) so it's crisp on retina. */
const IMAGE_SIZE = 64;
const IMAGE_PIXEL_RATIO = 2;

const imageCache = new Map<IconId, Promise<SdfImage>>();

/** Decode an image file to pixels for map.addImage (64 px square, as drawn). */
function loadRaster(url: string, size = 64): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("2d canvas unavailable"));
      ctx.drawImage(img, 0, 0, size, size);
      resolve(ctx.getImageData(0, 0, size, size));
    };
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function sdfImage(id: IconId): Promise<SdfImage> {
  let p = imageCache.get(id);
  if (!p) {
    p = loadSdfImage(iconAssetUrl(id, "sdf"), IMAGE_SIZE);
    imageCache.set(id, p);
  }
  return p;
}

/**
 * One symbol layer, tinted per feature from a single SDF silhouette per
 * icon, plus a ★ text overlay and name labels from zoom 14. Re-adds its
 * source, layers and images after every style (re)load.
 */
export function createSdfPinRenderer(view: MapView, colorsNow: () => { label: string; halo: string }): PinRenderer {
  const map = view.map;
  let pins: Pin[] = [];
  let selectedId: string | undefined;
  let selectCb: (id?: string) => void = () => {};
  let disposed = false;

  const data = () => pinsToGeoJson(pins, selectedId);

  const push = () => {
    const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (src) src.setData(data());
  };

  const addImages = async (m: MapLibreMap) => {
    for (const id of ICON_IDS) {
      const img = await sdfImage(id);
      if (disposed || m !== map || !m.getStyle()) return;
      if (!m.hasImage(id)) m.addImage(id, img, { sdf: true, pixelRatio: IMAGE_PIXEL_RATIO });
    }
    // The bookmark seal is multicolour, so it's a plain raster image, not an SDF.
    const badge = await loadRaster(bookmarkIcon);
    if (disposed || m !== map || !m.getStyle()) return;
    if (!m.hasImage(BOOKMARK_IMAGE)) m.addImage(BOOKMARK_IMAGE, badge, { pixelRatio: 2 });
  };

  const addLayers = (m: MapLibreMap) => {
    if (m.getSource(SOURCE)) return;
    const colors = colorsNow(); // read per style load so a theme switch restyles labels too
    m.addSource(SOURCE, { type: "geojson", data: data() });
    m.addLayer({
      id: ICON_LAYER,
      type: "symbol",
      source: SOURCE,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["case", ["get", "selected"], 1.35, 1],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": ["get", "color"],
        "icon-halo-color": colors.halo,
        "icon-halo-width": 1.5,
        "icon-halo-blur": 0.5,
      },
    });
    m.addLayer({
      id: STAR_LAYER,
      type: "symbol",
      source: SOURCE,
      filter: ["==", ["get", "starred"], true],
      layout: {
        "text-field": "★",
        "text-font": FONT,
        "text-size": 13,
        "text-offset": [1.1, -1.0],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": colors.halo,
        "text-halo-width": 1.5,
      },
    });
    m.addLayer({
      id: BOOKMARK_LAYER,
      type: "symbol",
      source: SOURCE,
      filter: ["==", ["get", "bookmarked"], true],
      layout: {
        "icon-image": BOOKMARK_IMAGE,
        "icon-size": 0.5,
        "icon-offset": [-26, -26],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    m.addLayer({
      id: LABEL_LAYER,
      type: "symbol",
      source: SOURCE,
      minzoom: pinLabelMinZoom(),
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": 12,
        "text-anchor": "top",
        "text-offset": [0, 1.3],
        "text-max-width": 9,
        "text-optional": true,
      },
      paint: {
        "text-color": colors.label,
        "text-halo-color": colors.halo,
        "text-halo-width": 1.2,
      },
    });
  };

  const onIconClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.["id"];
    if (typeof id === "string") selectCb(id);
  };
  // MapLibre fires the layer handler and the map handler for the same tap;
  // only treat it as "empty map" when no pin is under the point.
  const onMapClick = (e: MapLayerMouseEvent) => {
    if (!map.getLayer(ICON_LAYER)) return selectCb(undefined);
    if (map.queryRenderedFeatures(e.point, { layers: [ICON_LAYER] }).length === 0) selectCb(undefined);
  };
  const onEnter = () => (map.getCanvas().style.cursor = "pointer");
  const onLeave = () => (map.getCanvas().style.cursor = "");

  view.onStyleLoad((m) => {
    if (disposed) return;
    addLayers(m);
    void addImages(m);
  });
  map.on("click", ICON_LAYER, onIconClick);
  map.on("click", onMapClick);
  map.on("mouseenter", ICON_LAYER, onEnter);
  map.on("mouseleave", ICON_LAYER, onLeave);

  return {
    update(next) {
      pins = next;
      push();
    },
    setSelected(id) {
      if (id === selectedId) return;
      selectedId = id;
      push();
    },
    onSelect(cb) {
      selectCb = cb;
    },
    destroy() {
      disposed = true;
      map.off("click", ICON_LAYER, onIconClick);
      map.off("click", onMapClick);
      map.off("mouseenter", ICON_LAYER, onEnter);
      map.off("mouseleave", ICON_LAYER, onLeave);
      if (map.getStyle()) {
        for (const id of [LABEL_LAYER, BOOKMARK_LAYER, STAR_LAYER, ICON_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      }
    },
  };
}
