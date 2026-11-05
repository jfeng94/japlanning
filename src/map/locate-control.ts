import { Marker, type IControl, type Map as MapLibreMap } from "maplibre-gl";
import type { Position } from "../geo/locate.ts";

/** Earth's circumference in metres; MapLibre shows the whole world in 512 px at zoom 0. */
const WORLD_M = 40_075_016.686;
const WORLD_PX = 512;

const LOCK_MIN_ZOOM = 16;

export interface LocateControlHandlers {
  /** Tapped with no fix yet: the app starts the watch (and the permission prompt, if any, comes now). */
  onRequest(): void;
}

/** What the button shows. */
export type LocateState = "idle" | "waiting" | "ready" | "locked";

export interface LocateControl extends IControl {
  /** The latest fix, or undefined to remove the dot. The first fix after a tap centres and locks. */
  setFix(position: Position | undefined): void;
  /** Hide the button (the Location setting is off). The dot is removed by `setFix(undefined)`. */
  setVisible(visible: boolean): void;
  /** The map follows new fixes. */
  readonly locked: boolean;
  readonly state: LocateState;
}

/**
 * Our locate button, dot and accuracy ring. The button only centres and
 * locks: a tap centres the map on the fix and locks it there, so later
 * fixes move the map; a tap while locked, or any move the control did not
 * start itself (a pan by hand, a place chosen from the list, fit to
 * results, a region switch), unlocks and leaves the dot. With no fix yet the first tap asks
 * the app to start watching and locks once the fix lands. Turning
 * location off is a setting, not a button state.
 *
 * The dot is a DOM marker (two nested divs: ring, dot), so it survives
 * style reloads; the ring's size follows the zoom.
 */
export function createLocateControl(handlers: LocateControlHandlers): LocateControl {
  let map: MapLibreMap | undefined;
  let fix: Position | undefined;
  let state: LocateState = "idle";
  let marker: Marker | undefined;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "maplibregl-ctrl locate-button";
  button.setAttribute("aria-label", "Show my location");
  button.title = "My location";
  button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="6"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      <circle class="locate-centre" cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
    </svg>`;

  const ring = document.createElement("div");
  ring.className = "user-location-ring";
  const dot = document.createElement("div");
  dot.className = "user-location-dot";
  const element = document.createElement("div");
  element.className = "user-location";
  element.append(ring, dot);

  const setState = (next: LocateState): void => {
    state = next;
    button.dataset["state"] = next;
    button.setAttribute("aria-pressed", String(next === "locked"));
    button.title = next === "locked" ? "Following; tap to stop" : "My location";
  };
  setState("idle");

  /** Diameter of the accuracy ring in pixels at the map's zoom. */
  const ringPx = (): number => {
    if (!map || !fix) return 0;
    const metersPerPixel = (WORLD_M * Math.cos((fix.lat * Math.PI) / 180)) / (WORLD_PX * 2 ** map.getZoom());
    return (2 * fix.accuracy) / metersPerPixel;
  };

  const sizeRing = (): void => {
    const px = ringPx();
    ring.style.width = `${px}px`;
    ring.style.height = `${px}px`;
  };

  /** True while our own easeTo is firing its movestart, so it doesn't unlock. */
  let ownMove = false;

  const centre = (): void => {
    if (!map || !fix) return;
    ownMove = true;
    try {
      map.easeTo({ center: [fix.lng, fix.lat], zoom: Math.max(map.getZoom(), LOCK_MIN_ZOOM), duration: 500 });
    } finally {
      ownMove = false;
    }
  };

  const unlockOnOtherMove = (): void => {
    // movestart fires synchronously inside easeTo, so ownMove is set for ours and clear for everyone else's.
    if (!ownMove && state === "locked") setState("ready");
  };

  button.addEventListener("click", () => {
    if (!fix) {
      if (state !== "waiting") {
        setState("waiting");
        handlers.onRequest();
      }
      return;
    }
    if (state === "locked") {
      setState("ready");
    } else {
      setState("locked");
      centre();
    }
  });

  return {
    get locked() {
      return state === "locked";
    },
    get state() {
      return state;
    },
    onAdd(m) {
      map = m;
      map.on("zoom", sizeRing);
      map.on("movestart", unlockOnOtherMove);
      return button;
    },
    onRemove() {
      marker?.remove();
      marker = undefined;
      map?.off("zoom", sizeRing);
      map?.off("movestart", unlockOnOtherMove);
      map = undefined;
      button.remove();
    },
    setFix(next) {
      const wasWaiting = state === "waiting";
      fix = next;
      if (!next) {
        marker?.remove();
        marker = undefined;
        setState("idle");
        return;
      }
      if (map) {
        marker ??= new Marker({ element, pitchAlignment: "map", rotationAlignment: "map" }).setLngLat([next.lng, next.lat]).addTo(map);
        marker.setLngLat([next.lng, next.lat]);
        sizeRing();
      }
      if (wasWaiting) {
        setState("locked");
        centre();
      } else if (state === "locked") {
        centre();
      } else if (state === "idle") {
        setState("ready");
      }
    },
    setVisible(visible) {
      button.hidden = !visible;
    },
  };
}
