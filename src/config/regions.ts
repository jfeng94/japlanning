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
 * - areaSections: headings over wards for the chips on the Area page.
 *   A chip sits under the ward of its first-named raw area.
 *
 * Only areas with places are defined. A bbox makes the build extract that
 * region's basemap (scripts/build-basemap.ts). Adding areas: see "Adding
 * an area" in docs/design/adding-places.md.
 */
export const regions: RegionConfig[] = [
  {
    id: "tokyo",
    label: "Tokyo",
    areas: [
      { label: "Akasaka", ward: "港区", adjacent: ["Azabudai", "Nishi-Azabu", "Toranomon"] },
      { label: "Akihabara", ward: "千代田区", adjacent: ["Hongo", "Jimbocho", "Kuramae", "Ueno"] },
      { label: "Aoyama", ward: "港区", adjacent: ["Shibuya", "Omotesando", "Azabudai", "Nishi-Azabu"] },
      { label: "Asagaya", ward: "杉並区", adjacent: ["Koenji"] },
      { label: "Asakusa", ward: "台東区", adjacent: ["Kuramae", "Honjo", "Oshiage", "Kappabashi", "Minowa"] },
      { label: "Azabudai", ward: "港区", adjacent: ["Aoyama", "Tamachi", "Akasaka", "Nishi-Azabu", "Toranomon"] },
      { label: "Daikanyama", ward: "渋谷区", adjacent: ["Ebisu", "Nakameguro", "Shibuya"] },
      { label: "Daita", ward: "世田谷区", adjacent: ["Sangenjaya", "Shimokitazawa"] },
      { label: "Ebisu", ward: "渋谷区", adjacent: ["Shibuya", "Nakameguro", "Daikanyama"] },
      { label: "Gakugei-Daigaku", ward: "目黒区", adjacent: ["Jiyugaoka", "Yutenji"] },
      { label: "Ginza", ward: "中央区", adjacent: ["Tsukiji", "Nihonbashi", "Hibiya", "Marunouchi"] },
      { label: "Hanegi", ward: "世田谷区", adjacent: ["Shimokitazawa"] },
      { label: "Harajuku", ward: "渋谷区", adjacent: ["Shibuya", "Omotesando", "Yoyogi", "Tomigaya", "Minami-Shinjuku"] },
      { label: "Hatagaya", ward: "渋谷区", adjacent: ["Shimokitazawa", "Yoyogi", "Yoyogi-Uehara"] },
      { label: "Hatsudai", ward: "渋谷区", adjacent: ["Nishi-Shinjuku"] },
      { label: "Hibiya", ward: "千代田区", adjacent: ["Ginza", "Marunouchi", "Toranomon"] },
      { label: "Hongo", ward: "文京区", adjacent: ["Akihabara", "Jimbocho", "Koishikawa", "Ueno", "Yanaka"] },
      { label: "Honjo", ward: "墨田区", adjacent: ["Kuramae", "Asakusa", "Oshiage", "Kinshicho"] },
      { label: "Ichigaya", ward: "新宿区", adjacent: ["Kita-Shinjuku", "Shinjuku", "Jimbocho", "Iidabashi", "Kagurazaka"] },
      { label: "Iidabashi", ward: "千代田区", adjacent: ["Ichigaya", "Jimbocho", "Kagurazaka"] },
      { label: "Ikebukuro", ward: "豊島区", adjacent: ["Otsuka"] },
      { label: "Jimbocho", ward: "千代田区", adjacent: ["Ichigaya", "Nihonbashi", "Akihabara", "Hongo", "Iidabashi", "Marunouchi"] },
      { label: "Jiyugaoka", ward: "目黒区", adjacent: ["Yakumo", "Gakugei-Daigaku"] },
      { label: "Kagurazaka", ward: "新宿区", adjacent: ["Ichigaya", "Iidabashi"] },
      { label: "Kamata", ward: "大田区", adjacent: [] },
      { label: "Kameido", ward: "江東区", adjacent: ["Kinshicho"] },
      { label: "Kamiosaki", ward: "品川区", adjacent: [] },
      { label: "Kanegafuchi", ward: "墨田区", adjacent: ["Yotsugi"] },
      { label: "Kappabashi", ward: "台東区", adjacent: ["Asakusa", "Kuramae", "Ueno"] },
      { label: "Kinshicho", ward: "墨田区", adjacent: ["Oshiage", "Kiyosumi", "Kameido", "Honjo"] },
      { label: "Kita-Shinjuku", ward: "新宿区", adjacent: ["Shinjuku", "Ichigaya"] },
      { label: "Kiyosumi", ward: "江東区", adjacent: ["Kinshicho", "Ningyocho", "Monzen-Nakacho"] },
      { label: "Koenji", ward: "杉並区", adjacent: ["Asagaya", "Nakano"] },
      { label: "Koishikawa", ward: "文京区", adjacent: ["Hongo", "Yanaka"] },
      { label: "Kuramae", ward: "台東区", adjacent: ["Asakusa", "Honjo", "Ningyocho", "Akihabara", "Kappabashi", "Ueno"] },
      { label: "Kyodo", ward: "世田谷区", adjacent: [] },
      { label: "Marunouchi", ward: "千代田区", adjacent: ["Ginza", "Hibiya", "Jimbocho", "Nihonbashi"] },
      { label: "Meguro", ward: "目黒区", adjacent: ["Shirokane"] },
      { label: "Minami-Senju", ward: "荒川区", adjacent: ["Minowa"] },
      { label: "Minami-Shinjuku", ward: "渋谷区", adjacent: ["Harajuku"] },
      { label: "Minowa", ward: "台東区", adjacent: ["Asakusa", "Minami-Senju"] },
      { label: "Mitaka", ward: "三鷹市", adjacent: [] },
      { label: "Monzen-Nakacho", ward: "江東区", adjacent: ["Kiyosumi"] },
      { label: "Nakameguro", ward: "目黒区", adjacent: ["Ebisu", "Yutenji", "Daikanyama"] },
      { label: "Nakano", ward: "中野区", adjacent: ["Koenji"] },
      { label: "Nezu", ward: "文京区", adjacent: [] },
      { label: "Nihonbashi", ward: "中央区", adjacent: ["Ginza", "Jimbocho", "Ningyocho", "Marunouchi"] },
      { label: "Ningyocho", ward: "中央区", adjacent: ["Nihonbashi", "Kuramae", "Kiyosumi"] },
      { label: "Nishi-Azabu", ward: "港区", adjacent: ["Akasaka", "Aoyama", "Azabudai"] },
      { label: "Nishi-Shinjuku", ward: "新宿区", adjacent: ["Hatsudai", "Shinjuku", "Yoyogi"] },
      { label: "Odaiba", ward: "江東区", adjacent: [] },
      { label: "Omotesando", ward: "渋谷区", adjacent: ["Shibuya", "Harajuku", "Aoyama"] },
      { label: "Oshiage", ward: "墨田区", adjacent: ["Asakusa", "Honjo", "Kinshicho"] },
      { label: "Otsuka", ward: "豊島区", adjacent: ["Ikebukuro"] },
      { label: "Sakurashinmachi", ward: "世田谷区", adjacent: ["Sangenjaya", "Yoga"] },
      { label: "Sangenjaya", ward: "世田谷区", adjacent: ["Shimokitazawa", "Sakurashinmachi", "Yutenji", "Daita"] },
      { label: "Shibuya", ward: "渋谷区", adjacent: ["Harajuku", "Omotesando", "Aoyama", "Ebisu", "Tomigaya", "Daikanyama"] },
      { label: "Sendagi", ward: "文京区", adjacent: [] },
      { label: "Shimokitazawa", ward: "世田谷区", adjacent: ["Sangenjaya", "Hanegi", "Hatagaya", "Daita", "Yoyogi-Uehara"] },
      { label: "Shinjuku", ward: "新宿区", adjacent: ["Yoyogi", "Kita-Shinjuku", "Ichigaya", "Nishi-Shinjuku"] },
      { label: "Shirokane", ward: "港区", adjacent: ["Meguro", "Tamachi"] },
      { label: "Takanawa", ward: "港区", adjacent: ["Tamachi"] },
      { label: "Tamachi", ward: "港区", adjacent: ["Takanawa", "Azabudai", "Shirokane"] },
      { label: "Todoroki", ward: "世田谷区", adjacent: [] },
      { label: "Togoshi-Ginza", ward: "品川区", adjacent: [] },
      { label: "Tomigaya", ward: "渋谷区", adjacent: ["Shibuya", "Yoyogi", "Harajuku", "Yoyogi-Uehara"] },
      { label: "Toranomon", ward: "港区", adjacent: ["Akasaka", "Azabudai", "Hibiya"] },
      { label: "Toyosu", ward: "江東区", adjacent: [] },
      { label: "Tsukiji", ward: "中央区", adjacent: ["Ginza"] },
      { label: "Tsukishima", ward: "中央区", adjacent: [] },
      { label: "Ueno", ward: "台東区", adjacent: ["Akihabara", "Hongo", "Kappabashi", "Kuramae"] },
      { label: "Yaesu", ward: "中央区", adjacent: [] },
      { label: "Yakumo", ward: "目黒区", adjacent: ["Yutenji", "Jiyugaoka"] },
      { label: "Yanaka", ward: "台東区", adjacent: ["Hongo", "Koishikawa"] },
      { label: "Yoga", ward: "世田谷区", adjacent: ["Sakurashinmachi"] },
      { label: "Yotsugi", ward: "葛飾区", adjacent: ["Kanegafuchi"] },
      { label: "Yotsuya", ward: "新宿区", adjacent: [] },
      { label: "Yoyogi", ward: "渋谷区", adjacent: ["Harajuku", "Tomigaya", "Hatagaya", "Shinjuku", "Nishi-Shinjuku", "Yoyogi-Uehara"] },
      { label: "Yoyogi-Uehara", ward: "渋谷区", adjacent: ["Hatagaya", "Shimokitazawa", "Tomigaya", "Yoyogi"] },
      { label: "Yutenji", ward: "目黒区", adjacent: ["Nakameguro", "Yakumo", "Sangenjaya", "Gakugei-Daigaku"] },
      { label: "Zoshigaya", ward: "豊島区", adjacent: [] },
    ],
    areaGroups: [
      { label: "Ginza", areas: ["Ginza", "Tsukiji"] },
      { label: "Nihonbashi", areas: ["Nihonbashi", "Ningyocho"] },
      { label: "Kuramae", areas: ["Kuramae", "Honjo"] },
      { label: "Shinjuku", areas: ["Shinjuku", "Kita-Shinjuku", "Minami-Shinjuku"] },
      { label: "Shimokitazawa", areas: ["Shimokitazawa", "Hanegi"] },
      { label: "Tamachi · Takanawa", areas: ["Tamachi", "Takanawa"] },
      { label: "Jiyugaoka · Yakumo", areas: ["Jiyugaoka", "Yakumo"] },
      // 2026-11-09, with Jerry's trip list: one chip where a visitor's name spans a ward line.
      { label: "Tokyo Station", areas: ["Marunouchi", "Yaesu"] },
      { label: "Yanaka · Nezu · Sendagi", areas: ["Yanaka", "Nezu", "Sendagi"] },
      { label: "Meguro", areas: ["Meguro", "Kamiosaki"] },
      { label: "Ikebukuro", areas: ["Ikebukuro", "Zoshigaya"] },
    ],
    // Each section's hue colours its chips and shapes on the Area page; all eight are in use.
    areaSections: [
      { label: "Central", wards: ["千代田区", "中央区", "港区"], hue: "red" },
      { label: "Shibuya", wards: ["渋谷区"], hue: "orange" },
      { label: "Shinjuku", wards: ["新宿区"], hue: "yellow" },
      { label: "Meguro · Setagaya", wards: ["目黒区", "世田谷区"], hue: "green" },
      { label: "East", wards: ["台東区", "墨田区", "江東区", "葛飾区"], hue: "blue" },
      { label: "North", wards: ["文京区", "豊島区", "荒川区"], hue: "indigo" },
      { label: "West", wards: ["杉並区", "中野区", "三鷹市"], hue: "violet" },
      { label: "South", wards: ["品川区", "大田区"], hue: "magenta" },
    ],
    // Central Tokyo, out to Mitaka (the Ghibli Museum) in the west and Kamata in the south.
    bbox: [139.563, 35.553, 139.85, 35.75],
  },
  {
    id: "kyoto",
    label: "Kyoto",
    // Uji counts as Kyoto (decided 2026-11-05).
    areas: [
      { label: "Arashiyama", ward: "右京区", adjacent: [] },
      { label: "Demachiyanagi", ward: "左京区", adjacent: ["Hyakumanben", "Shimogamo"] },
      { label: "Fushimi", ward: "伏見区", adjacent: [] },
      { label: "Fushimi Inari", ward: "伏見区", adjacent: [] },
      { label: "Gion", ward: "東山区", adjacent: ["Kawaramachi", "Kiyomizu", "Okazaki"] },
      { label: "Gojo", ward: "下京区", adjacent: ["Karasuma", "Kawaramachi", "Kiyomizu", "Kyoto Station"] },
      { label: "Hyakumanben", ward: "左京区", adjacent: ["Demachiyanagi", "Okazaki"] },
      { label: "Ichijoji", ward: "左京区", adjacent: ["Shimogamo"] },
      { label: "Imadegawa", ward: "上京区", adjacent: [] },
      { label: "Kamigamo", ward: "北区", adjacent: ["Kitaoji", "Shimogamo", "Kitayama"] },
      { label: "Karasuma", ward: "中京区", adjacent: ["Kawaramachi", "Kyoto Station", "Kitaoji", "Gojo", "Marutamachi", "Nijo", "Omiya"] },
      { label: "Kawaramachi", ward: "中京区", adjacent: ["Karasuma", "Kiyomizu", "Gion", "Gojo", "Marutamachi", "Okazaki"] },
      { label: "Kinugasa", ward: "北区", adjacent: ["Ryoanji"] },
      { label: "Kitaoji", ward: "北区", adjacent: ["Karasuma", "Kamigamo"] },
      { label: "Kitayama", ward: "北区", adjacent: ["Shimogamo", "Kamigamo"] },
      { label: "Kiyomizu", ward: "東山区", adjacent: ["Kawaramachi", "Gion", "Gojo"] },
      { label: "Kyoto Station", ward: "下京区", adjacent: ["Karasuma", "Gojo"] },
      { label: "Marutamachi", ward: "中京区", adjacent: ["Karasuma", "Kawaramachi", "Nijo", "Okazaki"] },
      { label: "Matsugasaki", ward: "左京区", adjacent: [] },
      { label: "Nanzenji", ward: "左京区", adjacent: [] },
      { label: "Nijo", ward: "中京区", adjacent: ["Karasuma", "Marutamachi", "Omiya"] },
      { label: "Nishijin", ward: "上京区", adjacent: [] },
      { label: "Ogura", ward: "宇治市", adjacent: [] },
      { label: "Ohara", ward: "左京区", adjacent: [] },
      { label: "Okazaki", ward: "左京区", adjacent: ["Gion", "Hyakumanben", "Kawaramachi", "Marutamachi"] },
      { label: "Omiya", ward: "中京区", adjacent: ["Karasuma", "Nijo"] },
      { label: "Ryoanji", ward: "右京区", adjacent: ["Kinugasa"] },
      { label: "Saiin", ward: "右京区", adjacent: [] },
      { label: "Shijo-Karasuma", ward: "下京区", adjacent: [] },
      { label: "Shijo-Kawaramachi", ward: "下京区", adjacent: [] },
      { label: "Shijo-Omiya", ward: "下京区", adjacent: [] },
      { label: "Shimogamo", ward: "左京区", adjacent: ["Demachiyanagi", "Ichijoji", "Kamigamo", "Kitayama"] },
      { label: "Toji", ward: "南区", adjacent: [] },
      { label: "Uji", ward: "宇治市", adjacent: [] },
      { label: "Yamashina", ward: "山科区", adjacent: [] },
    ],
    areaGroups: [
      { label: "Karasuma", areas: ["Karasuma", "Shijo-Karasuma"] },
      { label: "Kawaramachi", areas: ["Kawaramachi", "Shijo-Kawaramachi"] },
      { label: "Omiya", areas: ["Omiya", "Shijo-Omiya"] },
      { label: "Okazaki · Nanzenji", areas: ["Okazaki", "Nanzenji"] },
      { label: "Kitayama", areas: ["Kitayama", "Matsugasaki"] },
      { label: "Demachiyanagi", areas: ["Demachiyanagi", "Imadegawa"] },
    ],
    // By ward, 2026-11-09: Kyoto grew from 7 areas to about 30, too many for one list.
    areaSections: [
      { label: "Downtown", wards: ["中京区", "下京区"], hue: "red" },
      { label: "Higashiyama", wards: ["東山区"], hue: "orange" },
      { label: "North", wards: ["北区", "上京区"], hue: "yellow" },
      { label: "Sakyo", wards: ["左京区"], hue: "green" },
      { label: "West", wards: ["右京区"], hue: "blue" },
      { label: "South", wards: ["南区", "伏見区", "山科区"], hue: "indigo" },
      { label: "Uji", wards: ["宇治市"], hue: "violet" },
    ],
    // Arashiyama in the west to Uji in the south-east and Ohara in the north, with margin.
    bbox: [135.65, 34.86, 135.85, 35.127],
  },
  {
    id: "osaka",
    label: "Osaka",
    // Joined 2026-11-09 with Jerry's trip list, as a day trip; Sakai counts as Osaka.
    areas: [
      { label: "Abeno", ward: "阿倍野区", adjacent: [] },
      { label: "Fukushima", ward: "福島区", adjacent: ["Kitashinchi", "Umeda"] },
      { label: "Horie", ward: "西区", adjacent: ["Shinsaibashi", "Taisho"] },
      { label: "Juso", ward: "淀川区", adjacent: [] },
      { label: "Kitahama", ward: "中央区", adjacent: ["Shinsaibashi", "Tanimachi"] },
      { label: "Kitashinchi", ward: "北区", adjacent: ["Fukushima", "Tenma", "Umeda"] },
      { label: "Kyobashi", ward: "都島区", adjacent: [] },
      { label: "Nagai", ward: "東住吉区", adjacent: [] },
      { label: "Namba", ward: "中央区", adjacent: ["Shinsaibashi"] },
      { label: "Nishinakajima", ward: "淀川区", adjacent: [] },
      { label: "Sakai", ward: "堺区", adjacent: [] },
      { label: "Shinsaibashi", ward: "中央区", adjacent: ["Horie", "Kitahama", "Namba"] },
      { label: "Shinsekai", ward: "浪速区", adjacent: [] },
      { label: "Taisho", ward: "大正区", adjacent: ["Horie"] },
      { label: "Tanimachi", ward: "中央区", adjacent: ["Kitahama"] },
      { label: "Tenma", ward: "北区", adjacent: ["Kitashinchi", "Umeda"] },
      { label: "Tsumori", ward: "西成区", adjacent: [] },
      { label: "Umeda", ward: "北区", adjacent: ["Fukushima", "Kitashinchi", "Tenma"] },
    ],
    areaSections: [
      { label: "Kita", wards: ["北区", "福島区", "淀川区", "都島区"], hue: "red" },
      { label: "Central", wards: ["中央区"], hue: "orange" },
      { label: "West", wards: ["西区", "大正区"], hue: "yellow" },
      { label: "South", wards: ["浪速区", "阿倍野区", "東住吉区", "西成区", "堺区"], hue: "green" },
    ],
    // Juso in the north to Sakai in the south.
    bbox: [135.466, 34.558, 135.538, 34.732],
  },
  {
    id: "nara",
    label: "Nara",
    // Joined 2026-11-09 with Jerry's trip list, as a day trip. One city, so one flat list.
    areas: [
      { label: "JR Nara", ward: "奈良市", adjacent: ["Kintetsu Nara", "Nara Park", "Naramachi"] },
      { label: "Kintetsu Nara", ward: "奈良市", adjacent: ["JR Nara", "Nara Park", "Naramachi"] },
      { label: "Nara Park", ward: "奈良市", adjacent: ["JR Nara", "Kintetsu Nara", "Naramachi"] },
      { label: "Naramachi", ward: "奈良市", adjacent: ["JR Nara", "Kintetsu Nara", "Nara Park"] },
      { label: "Saidaiji", ward: "奈良市", adjacent: [] },
      { label: "Shichijo", ward: "奈良市", adjacent: [] },
    ],
    bbox: [135.774, 34.655, 135.846, 34.701],
  },
  {
    id: "hakone",
    label: "Hakone",
    // First pins 2026-11-09. One town, so one flat list.
    areas: [
      { label: "Gora", ward: "箱根町", adjacent: ["Moto-Hakone"] },
      { label: "Hakone-Yumoto", ward: "箱根町", adjacent: ["Hatajuku"] },
      { label: "Hatajuku", ward: "箱根町", adjacent: ["Hakone-Yumoto", "Moto-Hakone"] },
      { label: "Moto-Hakone", ward: "箱根町", adjacent: ["Gora", "Hatajuku"] },
    ],
    bbox: [139.014, 35.198, 139.11, 35.254],
  },
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
