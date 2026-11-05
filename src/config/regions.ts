import type { RegionConfig, RegionId } from "../data/types.ts";

/**
 * Regions, in display order. Neighborhood lists are shared by every layer
 * in the region (docs/design/regions-layers-filters.md). Kyoto and Hakone
 * get neighborhoods and bounds once they have pins.
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
  { id: "kyoto", label: "Kyoto", neighborhoods: [] },
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
