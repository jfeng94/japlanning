import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { iconAssetUrl } from "../config/icons.ts";
import { pinLabelMinZoom, pinStyle, type PinStyle } from "../config/map.ts";
import type { Mark } from "../data/marks.ts";
import bookmarkIcon from "../ui/icons/bookmark.webp";
import closedIcon from "../ui/icons/closed.webp";
import starIcon from "../ui/icons/star.webp";
import unknownIcon from "../ui/icons/unknown.webp";
import type { MapView } from "./map.ts";
import type { Pin, PinRenderer } from "./pins.ts";

/** Badge artwork per mark. */
export const BADGES: Record<Mark, string> = { bookmark: bookmarkIcon, unknown: unknownIcon, closed: closedIcon, star: starIcon };

/**
 * One pin's HTML: a button holding the art, the badge and the name.
 * Everything visual is CSS on `.dom-pin`: the layer colour is a custom
 * property, selected is a class, the artwork is an <img> so the browser
 * decodes each icon once however many pins share it. Clicks are the
 * caller's to handle.
 */
export function createPinElement(style: PinStyle): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `dom-pin dom-pin--${style}`;
  el.innerHTML = `<img alt="" draggable="false"><img class="dom-pin-badge" alt="" draggable="false"><span class="dom-pin-label"></span>`;
  return el;
}

/** Show a pin on an element from createPinElement. */
export function showPinOn(el: HTMLElement, pin: Pin, selected: boolean): void {
  el.setAttribute("aria-label", pin.name);
  el.style.setProperty("--pin-color", pin.color);
  el.dataset["mark"] = pin.mark ?? "";
  const badge = el.querySelector<HTMLImageElement>(".dom-pin-badge")!;
  const art = pin.mark ? BADGES[pin.mark] : undefined;
  if (art && badge.getAttribute("src") !== art) badge.src = art;
  el.classList.toggle("is-selected", selected);
  const icon = iconAssetUrl(pin.icon);
  const img = el.querySelector("img")!;
  if (img.getAttribute("src") !== icon) img.src = icon;
  el.querySelector(".dom-pin-label")!.textContent = pin.name;
}

/** Names show from the label zoom: a class on the map's container that the pin CSS reads. Returns the off switch. */
export function trackLabelZoom(map: MapLibreMap): () => void {
  const container = map.getContainer();
  const labelZoom = pinLabelMinZoom();
  const update = () => container.classList.toggle("show-pin-labels", map.getZoom() >= labelZoom);
  map.on("zoom", update);
  update();
  return () => {
    map.off("zoom", update);
    container.classList.remove("show-pin-labels");
  };
}

interface Entry {
  marker: Marker;
  el: HTMLButtonElement;
  pin: Pin;
}

/**
 * One MapLibre Marker (an HTML element the map positions) per pin.
 * Markers live outside the style, so they survive flavour changes. Every
 * marker moves on every frame, on screen or not, so hundreds of them are
 * heavy (docs/proposals/webgl-pins.md).
 */
export function createDomPinRenderer(view: MapView): PinRenderer {
  const map = view.map;
  const style = pinStyle();
  const entries = new Map<string, Entry>();
  let selectedId: string | undefined;
  let selectCb: (id?: string, at?: { x: number; y: number }) => void = () => {};

  const container = map.getContainer();
  const stopLabels = trackLabelZoom(map);

  const onMapClick = (e: { originalEvent: MouseEvent; point: { x: number; y: number } }) => {
    if ((e.originalEvent.target as HTMLElement | null)?.closest(".dom-pin")) return;
    selectCb(undefined, e.point);
  };
  map.on("click", onMapClick);

  function create(pin: Pin): Entry {
    const el = createPinElement(style);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectCb(entry.pin.id);
    });
    const marker = new Marker({ element: el, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    const entry: Entry = { marker, el, pin };
    apply(entry, pin);
    return entry;
  }

  function apply(entry: Entry, pin: Pin): void {
    entry.pin = pin;
    showPinOn(entry.el, pin, pin.id === selectedId);
    entry.marker.setLngLat([pin.lng, pin.lat]);
  }

  return {
    update(pins) {
      const keep = new Set<string>();
      for (const pin of pins) {
        keep.add(pin.id);
        const existing = entries.get(pin.id);
        if (existing) apply(existing, pin);
        else entries.set(pin.id, create(pin));
      }
      for (const [id, entry] of entries) {
        if (!keep.has(id)) {
          entry.marker.remove();
          entries.delete(id);
        }
      }
    },
    setSelected(id) {
      if (id === selectedId) return;
      selectedId = id;
      for (const entry of entries.values()) entry.el.classList.toggle("is-selected", entry.pin.id === id);
    },
    onSelect(cb) {
      selectCb = cb;
    },
    setInteractive(on) {
      // CSS takes the pins out of hit-testing, so a tap reaches the map under them.
      container.classList.toggle("pins-inert", !on);
    },
    destroy() {
      stopLabels();
      map.off("click", onMapClick);
      container.classList.remove("pins-inert");
      for (const entry of entries.values()) entry.marker.remove();
      entries.clear();
    },
  };
}
