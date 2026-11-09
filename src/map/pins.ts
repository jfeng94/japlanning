import type { FeatureCollection, Point } from "geojson";
import { iconFor, type IconId } from "../config/icons.ts";
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
}

/** GeoJSON for the symbol-layer renderer; `selected` is baked in so paint expressions can read it. */
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
      },
    })),
  };
}
