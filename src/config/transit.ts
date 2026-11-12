import type { RegionId } from "../data/types.ts";

/**
 * The lines drawn in their own colours (docs/proposals/m8-transit.md):
 * every subway in Tokyo and Kyoto, for now. `npm run transit` finds each
 * in the map's zoom-15 tiles by its Japanese name and writes
 * public/transit/<region>.geojson; anything else on rails keeps the
 * basemap's grey.
 */
export interface TransitLine {
  /** Stable id, used in the built data. */
  id: string;
  region: RegionId;
  /** The line's letter, as on station signs. */
  code: string;
  /** English name, as a visitor reads it. */
  label: string;
  /** The tiles' Japanese name for the line; a feature matches when its name starts with this (some carry ";station;platform" after it). */
  match: string;
  /** How OpenStreetMap's route relations for the line begin their name, for its stop list. */
  route: string;
  /** The Japanese name of station 01 (G-01 is Shibuya): the card's Next arrow steps away from it. */
  first: string;
  /** The line's railways in ODPT (`npm run stations`), the main line first, then any branch; none where ODPT lacks the line. */
  odpt?: string[];
  /**
   * Track the tiles name for another line only: that line's pieces inside the box ([w, s, e, n]) are this line's
   * too. The map draws them dashed over the other line's colour. The Mita runs on the Namboku's to Meguro, the
   * Fukutoshin on the Yurakucho's west of Kotake-mukaihara (Hikawadai).
   */
  shares?: { line: string; bbox: [number, number, number, number] }[];
  colour: string;
  /** Where the colour comes from. */
  source: string;
}

const METRO = "Tokyo Metro (Jerry, 2026-11-10)";
const OSM = "OpenStreetMap route tags, 2026-11-10";

export const TRANSIT_LINES: TransitLine[] = [
  { id: "ginza", region: "tokyo", code: "G", label: "Ginza Line", match: "東京メトロ銀座線", route: "東京メトロ銀座線", first: "渋谷", odpt: ["odpt.Railway:TokyoMetro.Ginza"], colour: "#FF9500", source: METRO },
  { id: "marunouchi", region: "tokyo", code: "M", label: "Marunouchi Line", match: "東京メトロ丸ノ内線", route: "東京メトロ丸ノ内線", first: "荻窪", odpt: ["odpt.Railway:TokyoMetro.Marunouchi", "odpt.Railway:TokyoMetro.MarunouchiBranch"], colour: "#F62E36", source: METRO },
  { id: "hibiya", region: "tokyo", code: "H", label: "Hibiya Line", match: "東京メトロ日比谷線", route: "東京メトロ日比谷線", first: "中目黒", odpt: ["odpt.Railway:TokyoMetro.Hibiya"], colour: "#B5B5AC", source: METRO },
  { id: "tozai", region: "tokyo", code: "T", label: "Tozai Line", match: "東京メトロ東西線", route: "東京メトロ東西線", first: "中野", odpt: ["odpt.Railway:TokyoMetro.Tozai"], colour: "#009BBF", source: METRO },
  { id: "chiyoda", region: "tokyo", code: "C", label: "Chiyoda Line", match: "東京メトロ千代田線", route: "東京メトロ千代田線", first: "代々木上原", odpt: ["odpt.Railway:TokyoMetro.Chiyoda"], colour: "#00BB85", source: METRO },
  { id: "yurakucho", region: "tokyo", code: "Y", label: "Yurakucho Line", match: "東京メトロ有楽町線", route: "東京メトロ有楽町線", first: "和光市", odpt: ["odpt.Railway:TokyoMetro.Yurakucho"], colour: "#C1A470", source: METRO },
  { id: "hanzomon", region: "tokyo", code: "Z", label: "Hanzomon Line", match: "東京メトロ半蔵門線", route: "東京メトロ半蔵門線", first: "渋谷", odpt: ["odpt.Railway:TokyoMetro.Hanzomon"], colour: "#8F76D6", source: METRO },
  { id: "namboku", region: "tokyo", code: "N", label: "Namboku Line", match: "東京メトロ南北線", route: "東京メトロ南北線", first: "目黒", odpt: ["odpt.Railway:TokyoMetro.Namboku"], colour: "#00AC9B", source: METRO },
  { id: "fukutoshin", region: "tokyo", code: "F", label: "Fukutoshin Line", match: "東京メトロ副都心線", route: "東京メトロ副都心線", first: "和光市", odpt: ["odpt.Railway:TokyoMetro.Fukutoshin"], shares: [{ line: "yurakucho", bbox: [139.6, 35.742, 139.6795, 35.76] }], colour: "#9C5E31", source: METRO },
  { id: "asakusa", region: "tokyo", code: "A", label: "Asakusa Line", match: "都営地下鉄浅草線", route: "都営浅草線", first: "西馬込", odpt: ["odpt.Railway:Toei.Asakusa"], colour: "#E85298", source: OSM },
  { id: "mita", region: "tokyo", code: "I", label: "Mita Line", match: "都営地下鉄三田線", route: "都営三田線", first: "目黒", odpt: ["odpt.Railway:Toei.Mita"], shares: [{ line: "namboku", bbox: [139.71, 35.628, 139.737, 35.644] }], colour: "#0079C2", source: OSM },
  { id: "shinjuku", region: "tokyo", code: "S", label: "Shinjuku Line", match: "都営地下鉄新宿線", route: "都営新宿線", first: "新宿", odpt: ["odpt.Railway:Toei.Shinjuku"], colour: "#6CBB5A", source: OSM },
  { id: "oedo", region: "tokyo", code: "E", label: "Oedo Line", match: "都営地下鉄大江戸線", route: "都営大江戸線", first: "新宿西口", odpt: ["odpt.Railway:Toei.Oedo"], colour: "#B6007A", source: OSM },
  { id: "karasuma", region: "kyoto", code: "K", label: "Karasuma Line", match: "京都市営地下鉄烏丸線", route: "京都市営地下鉄烏丸線", first: "国際会館", colour: "#3CB371", source: OSM },
  { id: "kyoto-tozai", region: "kyoto", code: "T", label: "Tozai Line", match: "京都市営地下鉄東西線", route: "京都市営地下鉄東西線", first: "六地蔵", colour: "#FF4500", source: OSM },
];

/** The regions with lines to draw. */
export const TRANSIT_REGIONS: RegionId[] = [...new Set(TRANSIT_LINES.map((l) => l.region))];
