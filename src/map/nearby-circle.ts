import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LatLng } from "../geo/distance.ts";
import { circleRing } from "../geo/nearby.ts";
import type { MapView } from "./map.ts";

const SOURCE = "nearby-circle";

export interface NearbyCircle {
  /** Draw the radius around `center`, or nothing when either is missing. */
  set(center: LatLng | undefined, radiusM: number | undefined): void;
}

/**
 * Nearby's reach on the map: a faint fill and a dashed edge in the
 * location colour, around the blue dot. Added before the pin renderers
 * so pins draw above it, and re-added after every style load.
 */
export function createNearbyCircle(view: MapView): NearbyCircle {
  let center: LatLng | undefined;
  let radius: number | undefined;

  const data = (): FeatureCollection => ({
    type: "FeatureCollection",
    features:
      center && radius !== undefined
        ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(center, radius)] } }]
        : [],
  });

  const add = (m: MapLibreMap): void => {
    if (m.getSource(SOURCE)) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue("--location").trim() || "#2f7cf6";
    m.addSource(SOURCE, { type: "geojson", data: data() });
    m.addLayer({ id: `${SOURCE}-fill`, type: "fill", source: SOURCE, paint: { "fill-color": color, "fill-opacity": 0.07 } });
    m.addLayer({
      id: `${SOURCE}-line`,
      type: "line",
      source: SOURCE,
      paint: { "line-color": color, "line-width": 1.5, "line-opacity": 0.8, "line-dasharray": [3, 2] },
    });
  };
  view.onStyleLoad(add);

  return {
    set(nextCenter, nextRadius) {
      const same = nextRadius === radius && nextCenter?.lat === center?.lat && nextCenter?.lng === center?.lng;
      if (same) return;
      center = nextCenter;
      radius = nextRadius;
      (view.map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data());
    },
  };
}
