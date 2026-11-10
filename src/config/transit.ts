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
  colour: string;
  /** Where the colour comes from. */
  source: string;
}

const METRO = "Tokyo Metro (Jerry, 2026-11-10)";
const OSM = "OpenStreetMap route tags, 2026-11-10";

export const TRANSIT_LINES: TransitLine[] = [
  { id: "ginza", region: "tokyo", code: "G", label: "Ginza Line", match: "東京メトロ銀座線", route: "東京メトロ銀座線", colour: "#FF9500", source: METRO },
  { id: "marunouchi", region: "tokyo", code: "M", label: "Marunouchi Line", match: "東京メトロ丸ノ内線", route: "東京メトロ丸ノ内線", colour: "#F62E36", source: METRO },
  { id: "hibiya", region: "tokyo", code: "H", label: "Hibiya Line", match: "東京メトロ日比谷線", route: "東京メトロ日比谷線", colour: "#B5B5AC", source: METRO },
  { id: "tozai", region: "tokyo", code: "T", label: "Tozai Line", match: "東京メトロ東西線", route: "東京メトロ東西線", colour: "#009BBF", source: METRO },
  { id: "chiyoda", region: "tokyo", code: "C", label: "Chiyoda Line", match: "東京メトロ千代田線", route: "東京メトロ千代田線", colour: "#00BB85", source: METRO },
  { id: "yurakucho", region: "tokyo", code: "Y", label: "Yurakucho Line", match: "東京メトロ有楽町線", route: "東京メトロ有楽町線", colour: "#C1A470", source: METRO },
  { id: "hanzomon", region: "tokyo", code: "Z", label: "Hanzomon Line", match: "東京メトロ半蔵門線", route: "東京メトロ半蔵門線", colour: "#8F76D6", source: METRO },
  { id: "namboku", region: "tokyo", code: "N", label: "Namboku Line", match: "東京メトロ南北線", route: "東京メトロ南北線", colour: "#00AC9B", source: METRO },
  { id: "fukutoshin", region: "tokyo", code: "F", label: "Fukutoshin Line", match: "東京メトロ副都心線", route: "東京メトロ副都心線", colour: "#9C5E31", source: METRO },
  { id: "asakusa", region: "tokyo", code: "A", label: "Asakusa Line", match: "都営地下鉄浅草線", route: "都営浅草線", colour: "#E85298", source: OSM },
  { id: "mita", region: "tokyo", code: "I", label: "Mita Line", match: "都営地下鉄三田線", route: "都営三田線", colour: "#0079C2", source: OSM },
  { id: "shinjuku", region: "tokyo", code: "S", label: "Shinjuku Line", match: "都営地下鉄新宿線", route: "都営新宿線", colour: "#6CBB5A", source: OSM },
  { id: "oedo", region: "tokyo", code: "E", label: "Oedo Line", match: "都営地下鉄大江戸線", route: "都営大江戸線", colour: "#B6007A", source: OSM },
  { id: "karasuma", region: "kyoto", code: "K", label: "Karasuma Line", match: "京都市営地下鉄烏丸線", route: "京都市営地下鉄烏丸線", colour: "#3CB371", source: OSM },
  { id: "kyoto-tozai", region: "kyoto", code: "T", label: "Tozai Line", match: "京都市営地下鉄東西線", route: "京都市営地下鉄東西線", colour: "#FF4500", source: OSM },
];

/** The regions with lines to draw. */
export const TRANSIT_REGIONS: RegionId[] = [...new Set(TRANSIT_LINES.map((l) => l.region))];
