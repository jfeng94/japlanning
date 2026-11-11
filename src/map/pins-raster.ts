import { Marker, type ExpressionSpecification, type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent } from "maplibre-gl";
import { ICON_IDS, iconAssetUrl, type IconId } from "../config/icons.ts";
import { pinLabelMinZoom } from "../config/map.ts";
import type { Mark } from "../data/marks.ts";
import type { MapView } from "./map.ts";
import { drawPinArt, loadArt, PIN_PX, pinPixelRatio, type Art } from "./pin-art.ts";
import { BADGES, createPinElement, showPinOn, trackLabelZoom } from "./pins-dom.ts";
import { nearestPin, parsePinImageId, pinsToGeoJson, type Pin, type PinCandidate, type PinRenderer } from "./pins.ts";

const SOURCE = "pins-raster";
/** Layer ids start with "pins-" so belowPins() keeps other overlays beneath them. */
const NAME_LAYER = "pins-name";
const ART_LAYER = "pins-art";
const FONT = ["Noto Sans Medium"];
/** How far past a pin's edge a tap still counts, in px. */
const TAP_SLACK_PX = 12;
/** Hidden while the HTML pin stands in for it. */
const HIDE_WHEN_SELECTED: ExpressionSpecification = ["case", ["boolean", ["feature-state", "selected"], false], 0, 1];

/**
 * Every icon's and badge's file, loaded once per session, whichever
 * renderer asked first. A file that fails is left out, never the lot: its
 * pins fall back to the `?` art (src/config/icons.ts), so one bad file
 * can't empty the map.
 */
let decoded: Promise<{ icons: Map<IconId, Art>; badges: Map<Mark, Art> }> | undefined;
function decodeAll() {
  return (decoded ??= (async () => {
    const load = async <K>(entries: readonly (readonly [K, string])[]): Promise<Map<K, Art>> => {
      const settled = await Promise.allSettled(entries.map(async ([key, url]) => [key, await loadArt(url)] as const));
      const out = new Map<K, Art>();
      for (const s of settled) {
        if (s.status === "fulfilled") out.set(s.value[0], s.value[1]);
        else console.warn(s.reason);
      }
      return out;
    };
    const icons = await load(ICON_IDS.map((id) => [id, iconAssetUrl(id)] as const));
    const badges = await load((Object.keys(BADGES) as Mark[]).map((m) => [m, BADGES[m]] as const));
    return { icons, badges };
  })());
}

/**
 * Pins drawn by the map (docs/proposals/webgl-pins.md): one symbol layer
 * of full-colour pin images, one per (icon, badge) pair, drawn on demand
 * when MapLibre asks for a missing image, and kept for the session. Names
 * are a second layer from the label zoom. The selected pin is the DOM
 * renderer's HTML pin on top, so it keeps its glow and scale-up; its map
 * copy and name hide through feature state. Re-adds its source and layers
 * after every style (re)load.
 */
export function createRasterPinRenderer(view: MapView, colorsNow: () => { label: string; halo: string }): PinRenderer {
  const map = view.map;
  const pixelRatio = pinPixelRatio();
  let pins: Pin[] = [];
  const byId = new Map<string, Pin>();
  let selectedId: string | undefined;
  let selectCb: (id?: string, at?: { x: number; y: number }) => void = () => {};
  let interactive = true;
  let disposed = false;
  /** The badge halo follows the theme; read at each style load. */
  let halo = colorsNow().halo;
  /** Drawn pixels by image id and halo colour, so a theme switch back is free. */
  const drawn = new Map<string, ImageData>();
  let art: Awaited<ReturnType<typeof decodeAll>> | undefined;

  const data = () => pinsToGeoJson(pins);
  const source = () => map.getSource(SOURCE) as GeoJSONSource | undefined;

  // ---- images, drawn when the map first needs a pair ----
  const onMissing = (e: { id: string }) => {
    const pair = parsePinImageId(e.id);
    if (!pair || !art || disposed) return;
    const key = `${e.id}|${halo}`;
    let pixels = drawn.get(key);
    if (!pixels) {
      const icon = art.icons.get(pair.icon) ?? art.icons.get("question");
      if (!icon) return;
      pixels = drawPinArt(icon, pair.mark ? art.badges.get(pair.mark) : undefined, pixelRatio, halo);
      drawn.set(key, pixels);
    }
    if (!map.hasImage(e.id)) map.addImage(e.id, pixels, { pixelRatio });
  };
  map.on("styleimagemissing", onMissing);

  // ---- layers ----
  const add = (m: MapLibreMap) => {
    if (disposed || m !== map || m.getSource(SOURCE)) return;
    const colors = colorsNow();
    halo = colors.halo;
    try {
      m.addSource(SOURCE, { type: "geojson", data: data(), promoteId: "id" });
    } catch {
      return; // a newer style is loading (the theme changed meanwhile); its load adds the pins
    }
    // Names first, so the art draws over any name it overlaps.
    m.addLayer({
      id: NAME_LAYER,
      type: "symbol",
      source: SOURCE,
      minzoom: pinLabelMinZoom(),
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": 11.5,
        "text-anchor": "top",
        // Under the pin, as the HTML label: half the pin plus a gap, in ems.
        "text-offset": [0, (PIN_PX / 2 + 3) / 11.5],
        "text-max-width": 15,
        "text-padding": 2,
        "text-optional": true,
        // Bookmarks' and key branches' names win a tight spot; the basemap's own labels are never pushed out.
        "symbol-sort-key": ["-", 0, ["get", "rank"]],
        "text-ignore-placement": true,
      },
      paint: { "text-color": colors.label, "text-halo-color": colors.halo, "text-halo-width": 1.5, "text-halo-blur": 0.5, "text-opacity": HIDE_WHEN_SELECTED },
    });
    m.addLayer({
      id: ART_LAYER,
      type: "symbol",
      source: SOURCE,
      layout: {
        "icon-image": ["get", "image"],
        // Every pin is drawn, as with HTML pins; nothing pushes anything aside.
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "icon-opacity": HIDE_WHEN_SELECTED },
    });
    if (selectedId) m.setFeatureState({ source: SOURCE, id: selectedId }, { selected: true });
  };
  // The art must be decoded before the layer asks for images, since they're drawn synchronously.
  view.onStyleLoad((m) => void decodeAll().then((a) => ((art = a), add(m))));

  // ---- the selected pin, as HTML ----
  let marker: Marker | undefined;
  const el = createPinElement("bare");
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedId) selectCb(selectedId);
  });
  const stopLabels = trackLabelZoom(map);

  function showSelected(): void {
    const pin = selectedId ? byId.get(selectedId) : undefined;
    if (!pin) {
      marker?.remove();
      marker = undefined;
      return;
    }
    showPinOn(el, pin, true);
    if (marker) marker.setLngLat([pin.lng, pin.lat]);
    else marker = new Marker({ element: el, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map);
  }

  function setState(id: string | undefined, selected: boolean): void {
    if (id && source()) map.setFeatureState({ source: SOURCE, id }, { selected });
  }

  // ---- taps ----
  const onClick = (e: MapMouseEvent) => {
    if ((e.originalEvent.target as HTMLElement | null)?.closest?.(".dom-pin")) return; // the HTML pin handles its own
    if (!interactive || !map.getLayer(ART_LAYER)) return selectCb(undefined, e.point);
    const r = PIN_PX / 2 + TAP_SLACK_PX;
    const { x, y } = e.point;
    const hits = map.queryRenderedFeatures(
      [
        [x - r, y - r],
        [x + r, y + r],
      ],
      { layers: [ART_LAYER] },
    );
    const candidates: PinCandidate[] = [];
    for (const f of hits) {
      const id = f.properties?.["id"];
      const pin = typeof id === "string" ? byId.get(id) : undefined;
      if (!pin) continue;
      const p = map.project([pin.lng, pin.lat]);
      candidates.push({ id: pin.id, x: p.x, y: p.y });
    }
    const hit = nearestPin(candidates, e.point, r * Math.SQRT2);
    selectCb(hit, hit ? undefined : e.point);
  };
  const onEnter = () => (map.getCanvas().style.cursor = interactive ? "pointer" : "");
  const onLeave = () => (map.getCanvas().style.cursor = "");
  map.on("click", onClick);
  map.on("mouseenter", ART_LAYER, onEnter);
  map.on("mouseleave", ART_LAYER, onLeave);

  return {
    update(next) {
      pins = next;
      byId.clear();
      for (const p of next) byId.set(p.id, p);
      source()?.setData(data());
      showSelected();
    },
    setSelected(id) {
      if (id === selectedId) return;
      setState(selectedId, false);
      selectedId = id;
      setState(selectedId, true);
      showSelected();
    },
    onSelect(cb) {
      selectCb = cb;
    },
    setInteractive(on) {
      interactive = on;
      map.getContainer().classList.toggle("pins-inert", !on);
      if (!on) map.getCanvas().style.cursor = "";
    },
    destroy() {
      disposed = true;
      stopLabels();
      marker?.remove();
      map.off("styleimagemissing", onMissing);
      map.off("click", onClick);
      map.off("mouseenter", ART_LAYER, onEnter);
      map.off("mouseleave", ART_LAYER, onLeave);
      map.getContainer().classList.remove("pins-inert");
      if (map.getStyle()) {
        for (const id of [ART_LAYER, NAME_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
        for (const id of map.listImages()) if (parsePinImageId(id)) map.removeImage(id);
      }
    },
  };
}
