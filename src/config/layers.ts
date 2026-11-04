import type { LayerConfig, LayerId } from "../data/types.ts";

/**
 * One entry per sheet. Adding a layer: add its id to LAYER_IDS in
 * data/types.ts, publish the sheet as CSV, add an entry here, push.
 * Facet `values` are the sheet's enum in display order; values that turn
 * up in the sheet but not here still render (after these) and raise a
 * parse warning so typos are visible.
 */
export const layers: LayerConfig[] = [
  {
    id: "tokyo-coffee",
    region: "tokyo",
    label: "Coffee",
    csvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSIp7NVV6JlTMCW2NDTF4cgozZ7zDwdh1YmXjrD82owzZBeAvN-4AN5UmQEJP1f5cdQLEVbOnlNwAs_/pub?output=csv",
    color: "#b5452b",
    icon: "coffee",
    hasHours: true,
    rowFacets: ["Format", "Specialty", "Linger"],
    facets: [
      { column: "Format", values: ["Stand", "Café", "Kissaten", "Tasting bar", "Bean shop"] },
      { column: "Roasting", values: ["In-house", "Guest roasters", "Both"] },
      { column: "Food", values: ["None", "Light", "Full menu"] },
      { column: "Linger", values: ["Grab & go", "Short stay", "Settle in"] },
      {
        column: "Specialty",
        values: [
          "Light roast / Nordic",
          "Pour-over",
          "Espresso",
          "Dark roast / Kissaten",
          "Multi-roaster",
          "Latte art",
          "Food & sweets",
        ],
      },
      { column: "Reservation", values: ["Required", "Optional", "No"] },
    ],
  },
];

export function layerById(id: LayerId): LayerConfig {
  const l = layers.find((x) => x.id === id);
  if (!l) throw new Error(`unknown layer: ${id}`);
  return l;
}
