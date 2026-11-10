import type { LayerConfig, LayerId } from "../data/types.ts";

/**
 * One entry per layer. Adding a layer: add its id to LAYER_IDS in
 * data/types.ts, put its CSV at data/<id>.csv (npm run import normalises
 * one), add an entry here, push. `kinds` are the category chips on the
 * Filters page, read from the Kind column or derived from a facet
 * (`kindsFrom`, as Food does from Type). Facet `values` are the column's
 * enum in display order; values in the data but not here still render
 * (after these) and fail the build's data check so typos are visible.
 */
/**
 * Food's kinds, the category chips, in chip order, each with the Type
 * values that make it (docs/proposals/food-kinds.md). A place's kinds
 * follow from its Type, and this is also the Type column's list of
 * values, so a new type goes into one of these groups; a Type value in
 * none of them fails the build.
 */
const FOOD_KINDS: Record<string, string[]> = {
  Ramen: ["Ramen", "Tsukemen", "Tantanmen"],
  Yakitori: ["Yakitori"],
  Yakiniku: ["Yakiniku"],
  Katsu: ["Tonkatsu", "Gyukatsu", "Katsudon"],
  Kushikatsu: ["Kushikatsu", "Kushiage"],
  Tempura: ["Tempura", "Tendon"],
  Gyoza: ["Gyoza"],
  Okonomiyaki: ["Okonomiyaki", "Negiyaki", "Monjayaki"],
  "Hot pot": ["Sukiyaki", "Shabu-shabu"],
  Unagi: ["Unagi"],
  Tofu: ["Yudofu", "Tofu", "Yuba"],
  Rice: ["Rice", "Kamameshi", "Donabe rice", "Fukagawa-meshi", "Chagayu", "Teishoku"],
  Onigiri: ["Onigiri"],
  Donburi: ["Donburi", "Oyakodon", "Kaisendon"],
  Sushi: ["Kakinoha-zushi"],
  Pickles: ["Tsukemono"],
  Fruit: ["Fruit parlor", "Fruit sando", "Parfait", "Strawberries"],
};

export const layers: LayerConfig[] = [
  {
    // Coffee, tea and bars in every region: Kind says which, Region says where, Icon picks the artwork.
    id: "drinks",
    label: "Drinks",
    dataUrl: "/data/drinks.csv",
    color: "#b5452b",
    icon: "coffee",
    hasHours: true,
    kinds: ["Coffee", "Tea", "Bar"],
    rowFacets: ["Format", "Specialty", "Linger"],
    facets: [
      { column: "Format", values: ["Stand", "Café", "Kissaten", "Tasting bar", "Bean shop", "Shop"] },
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
  // The rest joined 2026-11-09 from Jerry's trip list (docs/design/regions-layers-filters.md, "Layers").
  // Type is what the place is ("Kakigori", "Ramen"): on the row and the card, matched by search, not a filter.
  {
    id: "sweets",
    label: "Sweets",
    dataUrl: "/data/sweets.csv",
    color: "#c2477a",
    icon: "pastry",
    hasHours: true,
    kinds: ["Pastry", "Wagashi", "Ice"],
    rowFacets: ["Type"],
    facets: [
      {
        column: "Type",
        values: [
          "Patisserie",
          "Bakery",
          "Canelé",
          "Tarts",
          "Choux",
          "Cheesecake",
          "Chocolate",
          "Donuts",
          "Crepes",
          "Café",
          "Tea salon",
          "Wagashi",
          "Taiyaki",
          "Mochi",
          "Dango",
          "Warabi mochi",
          "Matcha",
          "Teahouse",
          "Kakigori",
          "Gelato",
          "Ice cream",
          "Soft serve",
          "Parfait",
          "Fruit parlor",
        ],
      },
      { column: "Reservation", values: ["Required", "Optional", "No"] },
    ],
  },
  {
    // Kinds come from Type through FOOD_KINDS (above), so the rows need no Kind column.
    id: "food",
    label: "Food",
    dataUrl: "/data/food.csv",
    color: "#c77b14",
    icon: "fork",
    hasHours: true,
    kinds: Object.keys(FOOD_KINDS),
    kindsFrom: { column: "Type", groups: FOOD_KINDS },
    rowFacets: ["Type"],
    facets: [
      { column: "Type", values: Object.values(FOOD_KINDS).flat() },
      { column: "Reservation", values: ["Required", "Optional", "No"] },
    ],
  },
  {
    id: "music",
    label: "Music",
    dataUrl: "/data/music.csv",
    color: "#5a63b8",
    icon: "musicbox",
    hasHours: true,
    kinds: ["Café", "Shop", "Concert"],
    rowFacets: ["Type"],
    facets: [
      { column: "Type", values: ["Listening café", "Concerts", "Concert hall", "Sheet music", "Books", "Pianos"] },
      { column: "Reservation", values: ["Required", "Optional", "No"] },
    ],
  },
  {
    id: "shops",
    label: "Shops",
    dataUrl: "/data/shops.csv",
    color: "#2f8a6e",
    icon: "question",
    hasHours: true,
    kinds: ["Kitchen", "Baking", "Games"],
    rowFacets: ["Type"],
    facets: [
      {
        column: "Type",
        values: [
          "Knives",
          "Kitchen tools",
          "Ceramics",
          "Tableware",
          "Lacquer",
          "Glass",
          "Woodwork",
          "Chopsticks",
          "Brushes",
          "Copperware",
          "Ironware",
          "Metalwork",
          "Folk craft",
          "Coffee gear",
          "Tea gear",
          "Workshop",
          "Kitchen street",
          "Pastry tools",
          "Baking ingredients",
          "Board games",
          "Trading cards",
          "TRPG",
          "Game café",
        ],
      },
    ],
  },
  {
    id: "activities",
    label: "Activities",
    dataUrl: "/data/activities.csv",
    color: "#8a4fb0",
    icon: "bingbong",
    hasHours: true,
    rowFacets: ["Type"],
    facets: [
      { column: "Type", values: ["Museum", "Immersive art", "Immersive theater", "Illumination", "Night"] },
      { column: "Reservation", values: ["Required", "Optional", "No"] },
    ],
  },
];

export function layerById(id: LayerId): LayerConfig {
  const l = layers.find((x) => x.id === id);
  if (!l) throw new Error(`unknown layer: ${id}`);
  return l;
}
