/** Shared fixtures for the filter tests. Not imported by app code. */
import type { AreaConfig, LayerConfig, LayerId, Place } from "../data/types.ts";

/** A layer with kinds, like drinks: its kinds are the category chips. */
export const coffee: LayerConfig = {
  id: "drinks",
  region: "tokyo",
  label: "Drinks",
  dataUrl: "https://example.invalid/coffee.csv",
  color: "#b5452b",
  icon: "coffee",
  hasHours: true,
  kinds: ["Coffee", "Tea", "Bar"],
  facets: [
    { column: "Format", values: ["Stand", "Café", "Kissaten"] },
    { column: "Specialty", values: ["Pour-over", "Espresso"] },
  ],
};

/** A layer without kinds: one category on its own, and no hours. */
export const lodging: LayerConfig = {
  ...coffee,
  id: "tokyo-lodging" as LayerId,
  label: "Lodging",
  kinds: undefined,
  hasHours: false,
  facets: [{ column: "Style", values: ["Hotel", "Ryokan"] }],
};

export const kyotoFood: LayerConfig = {
  ...coffee,
  id: "kyoto-food" as LayerId,
  region: "kyoto",
  label: "Food",
  kinds: undefined,
  facets: [],
};

export const allLayers = [coffee, lodging, kyotoFood];

/** Three raw areas in a line: Shibuya – Central – East. Each is its own chip unless a test merges them. */
export const AREAS: AreaConfig[] = [
  { label: "Central", ward: "千代田区", adjacent: ["Shibuya", "East"] },
  { label: "Shibuya", ward: "渋谷区", adjacent: ["Central"] },
  { label: "East", ward: "台東区", adjacent: ["Central"] },
];

let seq = 0;

export function place(over: Partial<Place> & { name: string }): Place {
  seq++;
  return {
    id: `${over.layerId ?? "drinks"}:${seq}`,
    layerId: "drinks",
    region: "tokyo",
    starred: false,
    lat: 35.6,
    lng: 139.7,
    addressApproximate: false,
    kinds: [],
    facets: {},
    extra: {},
    ...over,
  };
}

/** A small, varied set: drinks of every kind, a lodging row, and one place in Kyoto. */
export function samplePlaces(): Place[] {
  return [
    place({ name: "Glitch", starred: true, kinds: ["Coffee"], area: "Central", areaGroup: "Central", notes: "Light roast only",
      address: "東京都千代田区神田錦町3-16", facets: { Format: ["Café"], Specialty: ["Pour-over"] } }),
    place({ name: "Fuglen", kinds: ["Coffee", "Bar"], area: "Shibuya", areaGroup: "Shibuya",
      facets: { Format: ["Café"], Specialty: ["Espresso", "Pour-over"] } }),
    place({ name: "Bear Pond", kinds: ["Coffee"], area: "Shibuya", areaGroup: "Shibuya",
      facets: { Format: ["Stand"], Specialty: ["Espresso"] } }),
    place({ name: "Unknown Kissa", kinds: ["Coffee"], area: "East", areaGroup: "East",
      facets: { Format: [], Specialty: [] } }),
    place({ name: "ＧＬＩＴＣＨ annex", kinds: ["Coffee"], area: "Central", areaGroup: "Central",
      facets: { Format: ["Kissaten"], Specialty: [] } }),
    place({ name: "Ippodo", kinds: ["Tea"], area: "Central", areaGroup: "Central", facets: { Format: ["Café"], Specialty: [] } }),
    place({ name: "Hotel", layerId: "tokyo-lodging" as LayerId, area: "Shibuya", areaGroup: "Shibuya", facets: { Style: ["Hotel"] } }),
    place({ name: "Kyoto Diner", layerId: "kyoto-food" as LayerId, region: "kyoto" }),
  ];
}
