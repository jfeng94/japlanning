import type { RegionConfig, RegionId } from "../data/types.ts";

/**
 * Regions, in display order. Neighborhood lists are shared by every layer
 * in the region (docs/design/regions-layers-filters.md). Hakone gets
 * neighborhoods and bounds once it has pins. A bbox makes the build
 * extract that region's basemap (scripts/build-basemap.ts).
 */
export const regions: RegionConfig[] = [
  {
    id: "tokyo",
    label: "Tokyo",
    neighborhoods: [
      "Central (Ginza / Jimbocho / Minato)",
      "Shibuya / Omotesando / Harajuku",
      "Okushibu / Yoyogi / Shinjuku",
      "Nakameguro / Meguro",
      "Shimokitazawa / Sangenjaya",
      "East side (Kuramae / Asakusa / Kiyosumi)",
    ],
    bbox: [139.6, 35.58, 139.85, 35.75],
  },
  {
    id: "kyoto",
    label: "Kyoto",
    // Uji counts as Kyoto (decided 2026-11-05).
    neighborhoods: [
      "Higashiyama (Gion / Kiyomizu)",
      "Downtown (Kawaramachi / Karasuma)",
      "Kyoto Station",
      "Arashiyama",
      "North (Kinkaku-ji / Kitayama)",
      "Uji",
    ],
    // Arashiyama in the west to Uji in the south-east, with margin.
    bbox: [135.65, 34.86, 135.85, 35.1],
  },
  { id: "hakone", label: "Hakone", neighborhoods: [] },
];

export function regionById(id: RegionId): RegionConfig {
  const r = regions.find((x) => x.id === id);
  if (!r) throw new Error(`unknown region: ${id}`);
  return r;
}

/** Parse options that validate Region and Neighborhood cells against this config. */
export function regionOptions(): { regions: RegionId[]; neighborhoodsFor: (region: RegionId) => readonly string[] | undefined } {
  return {
    regions: regions.map((r) => r.id),
    neighborhoodsFor: (region) => regions.find((r) => r.id === region)?.neighborhoods,
  };
}
