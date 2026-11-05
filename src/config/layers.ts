import type { LayerConfig, LayerId } from "../data/types.ts";

/**
 * One entry per layer. Adding a layer: add its id to LAYER_IDS in
 * data/types.ts, put its CSV at data/<id>.csv (npm run import normalises
 * one), add an entry here, push. Facet `values` are the column's enum in
 * display order; values in the data but not here still render (after
 * these) and fail the build's data check so typos are visible.
 */
export const layers: LayerConfig[] = [
  {
    // Coffee, tea and bars in every region: Kind says which, Region says where, Icon picks the artwork.
    id: "drinks",
    label: "Drinks",
    dataUrl: "/data/drinks.csv",
    color: "#b5452b",
    icon: "coffee",
    hasHours: true,
    rowFacets: ["Format", "Specialty", "Linger"],
    facets: [
      { column: "Kind", values: ["Coffee", "Tea", "Bar"] },
      { column: "Format", values: ["Stand", "Café", "Kissaten", "Tasting bar", "Bean shop", "Shop"] },
      { column: "Roasting", values: ["In-house", "Guest roasters", "Both"] },
      { column: "Food", values: ["None", "Light", "Full menu"] },
      { column: "Linger", values: ["Grab & go", "Short stay", "Settle in"] },
      {
        column: "Specialty",
        scopeBy: "Kind",
        values: [
          "Light roast / Nordic",
          "Pour-over",
          "Espresso",
          "Dark roast / Kissaten",
          "Multi-roaster",
          "Latte art",
          "Food & sweets",
          "Matcha",
          "Hojicha",
          "Sencha",
          "Chinese tea",
          "Cocktails",
          "Sake",
          "Whisky",
          "Natural wine",
          "Craft beer",
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
