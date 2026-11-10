import type { FeatureCollection, Point } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ICON_IDS, iconFor, type IconId } from "../config/icons.ts";
import type { Mark } from "../data/marks.ts";
import type { LayerConfig, Place } from "../data/types.ts";

/** What a renderer needs to draw one place. Pure data; no DOM, no map. */
export interface Pin {
  id: string;
  name: string;
  lng: number;
  lat: number;
  icon: IconId;
  /** The layer's colour. */
  color: string;
  /** The one badge to draw (see data/marks.ts), if any. */
  mark?: Mark;
  layerId: string;
}

/** One of these per renderer. The map only talks to this. */
export interface PinRenderer {
  /** Replace the pins with the current filtered set. */
  update(pins: Pin[]): void;
  setSelected(id?: string): void;
  /** `undefined` means a tap on empty map. */
  onSelect(cb: (id?: string) => void): void;
  /** Off: pins ignore taps, which fall through to the map (the Area page's pins are only for reference). */
  setInteractive(on: boolean): void;
  destroy(): void;
}

export function placesToPins(places: Place[], layers: LayerConfig[], marks?: ReadonlyMap<string, Mark>): Pin[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const pins: Pin[] = [];
  for (const p of places) {
    const layer = byId.get(p.layerId);
    if (!layer) continue;
    pins.push({
      id: p.id,
      name: p.name,
      lng: p.lng,
      lat: p.lat,
      icon: iconFor(p, layer),
      color: layer.color,
      mark: marks?.get(p.id),
      layerId: p.layerId,
    });
  }
  return pins;
}

export interface PinProperties {
  id: string;
  name: string;
  icon: IconId;
  color: string;
  /** "" when there is no mark; expressions can't read undefined. */
  mark: Mark | "";
  selected: boolean;
  /** The map-layer renderer's image for this pin's art and badge (pinImageId). */
  image: string;
  /** Draw order on the map layer (pinRank): higher draws on top. */
  rank: number;
}

/** GeoJSON for the symbol-layer renderers; `selected` is baked in so the SDF layer's expressions can read it. */
export function pinsToGeoJson(pins: Pin[], selectedId?: string): FeatureCollection<Point, PinProperties> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        mark: p.mark ?? "",
        selected: p.id === selectedId,
        image: pinImageId(p.icon, p.mark),
        rank: pinRank(p.mark),
      },
    })),
  };
}

/** Draw order on the map layer: bookmarked pins on top, then key branches, then the rest, closed shops underneath. */
export function pinRank(mark?: Mark): number {
  switch (mark) {
    case "bookmark":
      return 3;
    case "star":
      return 2;
    case "closed":
      return 0;
    default:
      return 1;
  }
}

const MARKS: readonly Mark[] = ["unknown", "closed", "bookmark", "star"];

/** The map image for an (icon, badge) pair; every pin with that pair shares it. */
export function pinImageId(icon: IconId, mark?: Mark): string {
  return `pin|${icon}|${mark ?? ""}`;
}

/** The pair a map image stands for, or undefined if the name isn't one of ours (the basemap asks for its own too). */
export function parsePinImageId(id: string): { icon: IconId; mark?: Mark } | undefined {
  const [prefix, icon, mark, ...rest] = id.split("|");
  if (prefix !== "pin" || rest.length > 0 || !(ICON_IDS as readonly string[]).includes(icon ?? "")) return undefined;
  if (mark === "") return { icon: icon as IconId };
  return MARKS.includes(mark as Mark) ? { icon: icon as IconId, mark: mark as Mark } : undefined;
}

/** A pin under a tap: its id and where it sits on screen. */
export interface PinCandidate {
  id: string;
  x: number;
  y: number;
}

/** The candidate nearest the tap, if one is within `radius` px; a finger on a busy street means the nearest, not the topmost. */
export function nearestPin(candidates: readonly PinCandidate[], at: { x: number; y: number }, radius: number): string | undefined {
  let best: string | undefined;
  let bestD = radius;
  for (const c of candidates) {
    const d = Math.hypot(c.x - at.x, c.y - at.y);
    if (d <= bestD) {
      best = c.id;
      bestD = d;
    }
  }
  return best;
}

/**
 * The pins' layers all start with "pins-". Other overlays (the nearby
 * circle, the Area page's shapes) pass this as `beforeId`, so they go in
 * beneath the pins whichever was added first. Undefined (on top) when no
 * pin layer is in the style, as with DOM pins.
 */
export function belowPins(m: MapLibreMap): string | undefined {
  return m.getStyle()?.layers?.find((l) => l.id.startsWith("pins-"))?.id;
}
