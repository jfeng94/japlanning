import { Marker } from "maplibre-gl";
import { iconAssetUrl } from "../config/icons.ts";
import { PIN_LABEL_MIN_ZOOM, pinStyle } from "../config/map.ts";
import type { MapView } from "./map.ts";
import type { Pin, PinRenderer } from "./pins.ts";

interface Entry {
  marker: Marker;
  el: HTMLButtonElement;
  pin: Pin;
}

/**
 * One MapLibre Marker (an HTML element the map positions) per pin.
 * Everything visual is CSS on `.dom-pin`: the layer colour is a custom
 * property, starred and selected are classes, the artwork is an <img> so
 * the browser decodes each icon once however many pins share it.
 * Markers live outside the style, so they survive flavour changes.
 */
export function createDomPinRenderer(view: MapView): PinRenderer {
  const map = view.map;
  const style = pinStyle();
  const entries = new Map<string, Entry>();
  let selectedId: string | undefined;
  let selectCb: (id?: string) => void = () => {};

  const container = map.getContainer();
  const updateLabelVisibility = () => container.classList.toggle("show-pin-labels", map.getZoom() >= PIN_LABEL_MIN_ZOOM);
  map.on("zoom", updateLabelVisibility);
  updateLabelVisibility();

  const onMapClick = (e: { originalEvent: MouseEvent }) => {
    if ((e.originalEvent.target as HTMLElement | null)?.closest(".dom-pin")) return;
    selectCb(undefined);
  };
  map.on("click", onMapClick);

  function create(pin: Pin): Entry {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `dom-pin dom-pin--${style}`;
    el.setAttribute("aria-label", pin.name);
    el.innerHTML = `<img alt="" draggable="false"><span class="dom-pin-label"></span>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectCb(pin.id);
    });
    const marker = new Marker({ element: el, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    const entry = { marker, el, pin };
    apply(entry, pin);
    return entry;
  }

  function apply(entry: Entry, pin: Pin): void {
    const { el } = entry;
    entry.pin = pin;
    el.style.setProperty("--pin-color", pin.color);
    el.classList.toggle("is-starred", pin.starred);
    el.classList.toggle("is-selected", pin.id === selectedId);
    el.querySelector("img")!.src = iconAssetUrl(pin.icon, "dom");
    el.querySelector(".dom-pin-label")!.textContent = pin.name;
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
    destroy() {
      map.off("zoom", updateLabelVisibility);
      map.off("click", onMapClick);
      for (const entry of entries.values()) entry.marker.remove();
      entries.clear();
    },
  };
}
