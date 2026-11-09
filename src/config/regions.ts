import { areaIndex, type AreaIndex } from "../data/areas.ts";
import type { RegionConfig, RegionId } from "../data/types.ts";

/**
 * Regions, in display order. Each has its areas in three layers
 * (docs/proposals/filters-and-areas.md):
 *
 * - areas: raw areas, the facts. Where a place is, as a visitor would name
 *   it; the values of the data's Area column. Each records the ward its
 *   addresses name (the build checks every row against it) and its
 *   neighbours, symmetric (a test checks).
 * - areaGroups: merges that fold raw areas into one filter chip. An
 *   unmerged raw area is its own chip. Revisit as places are added.
 * - areaSections: headings over wards for the chips in the filter sheet.
 *   A chip sits under the ward of its first-named raw area.
 *
 * Only areas with places are defined. A bbox makes the build extract that
 * region's basemap (scripts/build-basemap.ts). Hakone gets areas and
 * bounds once it has pins.
 */
export const regions: RegionConfig[] = [
  {
    id: "tokyo",
    label: "Tokyo",
    areas: [
      { label: "Aoyama", ward: "港区", adjacent: ["Shibuya", "Omotesando", "Azabudai"] },
      { label: "Asakusa", ward: "台東区", adjacent: ["Kuramae", "Honjo", "Oshiage"] },
      { label: "Azabudai", ward: "港区", adjacent: ["Aoyama", "Tamachi"] },
      { label: "Ebisu", ward: "渋谷区", adjacent: ["Shibuya", "Nakameguro"] },
      { label: "Ginza", ward: "中央区", adjacent: ["Tsukiji", "Nihonbashi"] },
      { label: "Hanegi", ward: "世田谷区", adjacent: ["Shimokitazawa"] },
      { label: "Harajuku", ward: "渋谷区", adjacent: ["Shibuya", "Omotesando", "Yoyogi"] },
      { label: "Hatagaya", ward: "渋谷区", adjacent: ["Shimokitazawa", "Yoyogi"] },
      { label: "Honjo", ward: "墨田区", adjacent: ["Kuramae", "Asakusa", "Oshiage"] },
      { label: "Ichigaya", ward: "新宿区", adjacent: ["Kita-Shinjuku", "Shinjuku", "Jimbocho"] },
      { label: "Jimbocho", ward: "千代田区", adjacent: ["Ichigaya", "Nihonbashi"] },
      { label: "Jiyugaoka", ward: "目黒区", adjacent: ["Yakumo"] },
      { label: "Kinshicho", ward: "墨田区", adjacent: ["Oshiage", "Kiyosumi"] },
      { label: "Kita-Shinjuku", ward: "新宿区", adjacent: ["Shinjuku", "Ichigaya"] },
      { label: "Kiyosumi", ward: "江東区", adjacent: ["Kinshicho", "Ningyocho"] },
      { label: "Kuramae", ward: "台東区", adjacent: ["Asakusa", "Honjo", "Ningyocho"] },
      { label: "Nakameguro", ward: "目黒区", adjacent: ["Ebisu", "Yutenji"] },
      { label: "Nihonbashi", ward: "中央区", adjacent: ["Ginza", "Jimbocho", "Ningyocho"] },
      { label: "Ningyocho", ward: "中央区", adjacent: ["Nihonbashi", "Kuramae", "Kiyosumi"] },
      { label: "Omotesando", ward: "渋谷区", adjacent: ["Shibuya", "Harajuku", "Aoyama"] },
      { label: "Oshiage", ward: "墨田区", adjacent: ["Asakusa", "Honjo", "Kinshicho"] },
      { label: "Sakurashinmachi", ward: "世田谷区", adjacent: ["Sangenjaya"] },
      { label: "Sangenjaya", ward: "世田谷区", adjacent: ["Shimokitazawa", "Sakurashinmachi", "Yutenji"] },
      { label: "Shibuya", ward: "渋谷区", adjacent: ["Harajuku", "Omotesando", "Aoyama", "Ebisu", "Tomigaya"] },
      { label: "Shimokitazawa", ward: "世田谷区", adjacent: ["Sangenjaya", "Hanegi", "Hatagaya"] },
      { label: "Shinjuku", ward: "新宿区", adjacent: ["Yoyogi", "Kita-Shinjuku", "Ichigaya"] },
      { label: "Takanawa", ward: "港区", adjacent: ["Tamachi"] },
      { label: "Tamachi", ward: "港区", adjacent: ["Takanawa", "Azabudai"] },
      { label: "Tomigaya", ward: "渋谷区", adjacent: ["Shibuya", "Yoyogi"] },
      { label: "Tsukiji", ward: "中央区", adjacent: ["Ginza"] },
      { label: "Yakumo", ward: "目黒区", adjacent: ["Yutenji", "Jiyugaoka"] },
      { label: "Yoyogi", ward: "渋谷区", adjacent: ["Harajuku", "Tomigaya", "Hatagaya", "Shinjuku"] },
      { label: "Yutenji", ward: "目黒区", adjacent: ["Nakameguro", "Yakumo", "Sangenjaya"] },
    ],
    areaGroups: [
      { label: "Ginza", areas: ["Ginza", "Tsukiji"] },
      { label: "Nihonbashi", areas: ["Nihonbashi", "Ningyocho"] },
      { label: "Kuramae", areas: ["Kuramae", "Honjo"] },
      { label: "Shinjuku", areas: ["Shinjuku", "Kita-Shinjuku"] },
      { label: "Shimokitazawa", areas: ["Shimokitazawa", "Hanegi"] },
      { label: "Tamachi · Takanawa", areas: ["Tamachi", "Takanawa"] },
      { label: "Jiyugaoka · Yakumo", areas: ["Jiyugaoka", "Yakumo"] },
    ],
    areaSections: [
      { label: "Central", wards: ["千代田区", "中央区", "港区"] },
      { label: "Shibuya", wards: ["渋谷区"] },
      { label: "Shinjuku", wards: ["新宿区"] },
      { label: "Meguro · Setagaya", wards: ["目黒区", "世田谷区"] },
      { label: "East", wards: ["台東区", "墨田区", "江東区"] },
    ],
    bbox: [139.6, 35.58, 139.85, 35.75],
  },
  {
    id: "kyoto",
    label: "Kyoto",
    // Uji counts as Kyoto (decided 2026-11-05). Seven areas: one flat list, no merges or sections.
    areas: [
      { label: "Arashiyama", ward: "右京区", adjacent: [] },
      { label: "Karasuma", ward: "中京区", adjacent: ["Kawaramachi", "Kyoto Station", "Kitaoji"] },
      { label: "Kawaramachi", ward: "中京区", adjacent: ["Karasuma", "Kiyomizu"] },
      { label: "Kitaoji", ward: "北区", adjacent: ["Karasuma"] },
      { label: "Kiyomizu", ward: "東山区", adjacent: ["Kawaramachi"] },
      { label: "Kyoto Station", ward: "下京区", adjacent: ["Karasuma"] },
      { label: "Uji", ward: "宇治市", adjacent: [] },
    ],
    // Arashiyama in the west to Uji in the south-east, with margin.
    bbox: [135.65, 34.86, 135.85, 35.1],
  },
  { id: "hakone", label: "Hakone", areas: [] },
];

export function regionById(id: RegionId): RegionConfig {
  const r = regions.find((x) => x.id === id);
  if (!r) throw new Error(`unknown region: ${id}`);
  return r;
}

const indexes = new Map<RegionId, AreaIndex>();

/** A region's area index (chips, sections, neighbours), built once. */
export function areasOf(id: RegionId): AreaIndex {
  let idx = indexes.get(id);
  if (!idx) {
    idx = areaIndex(regionById(id));
    indexes.set(id, idx);
  }
  return idx;
}

/** Parse options that validate Region and Area cells against this config. */
export function regionOptions(): { regions: RegionId[]; areasFor: (region: RegionId) => AreaIndex | undefined } {
  return {
    regions: regions.map((r) => r.id),
    areasFor: (region) => (regions.some((r) => r.id === region) ? areasOf(region) : undefined),
  };
}
