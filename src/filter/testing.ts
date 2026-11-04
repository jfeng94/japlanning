/** Shared fixtures for the filter tests. Not imported by app code. */
import type { LayerConfig, LayerId, Place } from "../data/types.ts";

export const coffee: LayerConfig = {
  id: "tokyo-coffee",
  region: "tokyo",
  label: "Coffee",
  csvUrl: "https://example.invalid/coffee.csv",
  color: "#b5452b",
  icon: "coffee",
  hasHours: true,
  facets: [
    { column: "Format", values: ["Stand", "Café", "Kissaten"] },
    { column: "Specialty", values: ["Pour-over", "Espresso"] },
  ],
};

export const tea: LayerConfig = {
  ...coffee,
  id: "tokyo-tea" as LayerId,
  label: "Tea",
  facets: [{ column: "Style", values: ["Matcha", "Sencha"] }],
};

export const kyotoFood: LayerConfig = {
  ...coffee,
  id: "kyoto-food" as LayerId,
  region: "kyoto",
  label: "Food",
  facets: [],
};

export const allLayers = [coffee, tea, kyotoFood];

export const NEIGHBORHOODS = ["Central", "Shibuya", "East"];

let seq = 0;

export function place(over: Partial<Place> & { name: string }): Place {
  seq++;
  return {
    id: `${over.layerId ?? "tokyo-coffee"}:${seq}`,
    layerId: "tokyo-coffee",
    region: "tokyo",
    starred: false,
    lat: 35.6,
    lng: 139.7,
    addressApproximate: false,
    facets: {},
    extra: {},
    ...over,
  };
}

/** A small, varied set of places across both Tokyo layers and one in Kyoto. */
export function samplePlaces(): Place[] {
  return [
    place({ name: "Glitch", starred: true, neighborhood: "Central", notes: "Light roast only",
      facets: { Format: ["Café"], Specialty: ["Pour-over"] } }),
    place({ name: "Fuglen", neighborhood: "Shibuya",
      facets: { Format: ["Café"], Specialty: ["Espresso", "Pour-over"] } }),
    place({ name: "Bear Pond", neighborhood: "Shibuya",
      facets: { Format: ["Stand"], Specialty: ["Espresso"] } }),
    place({ name: "Unknown Kissa", neighborhood: "East",
      facets: { Format: [], Specialty: [] } }),
    place({ name: "ＧＬＩＴＣＨ annex", neighborhood: "Central",
      facets: { Format: ["Kissaten"], Specialty: [] } }),
    place({ name: "Ippodo", layerId: "tokyo-tea" as LayerId, neighborhood: "Central",
      facets: { Style: ["Matcha"] } }),
    place({ name: "Kyoto Diner", layerId: "kyoto-food" as LayerId, region: "kyoto" }),
  ];
}
