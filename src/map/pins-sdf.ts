import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import { ICON_IDS, iconAssetUrl, type IconId } from "../config/icons.ts";
import { PIN_LABEL_MIN_ZOOM } from "../config/map.ts";
import type { MapView } from "./map.ts";
import { pinsToGeoJson, type Pin, type PinRenderer } from "./pins.ts";
import { loadSdfImage, type SdfImage } from "./sdf.ts";

const SOURCE = "pins";
const ICON_LAYER = "pins-icon";
const STAR_LAYER = "pins-star";
const LABEL_LAYER = "pins-label";
const FONT = ["Noto Sans Medium"];

/** Drawn at 64 px, shown at 32 CSS px (pixelRatio 2) so it's crisp on retina. */
const IMAGE_SIZE = 64;
const IMAGE_PIXEL_RATIO = 2;

const imageCache = new Map<IconId, Promise<SdfImage>>();

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
export function createSdfPinRenderer(view: MapView, colors: { label: string; halo: string }): PinRenderer {
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
  };

  const addLayers = (m: MapLibreMap) => {
    if (m.getSource(SOURCE)) return;
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
      id: LABEL_LAYER,
      type: "symbol",
      source: SOURCE,
      minzoom: PIN_LABEL_MIN_ZOOM,
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
    if (typeof id === "string") {
      e.originalEvent.stopPropagation();
      selectCb(id);
    }
  };
  const onMapClick = () => selectCb(undefined);
  const onEnter = () => (map.getCanvas().style.cursor = "pointer");
  const onLeave = () => (map.getCanvas().style.cursor = "");

  view.onStyleLoad((m) => {
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
    },
  };
}
