import type { FeatureCollection, MultiLineString, Point } from "geojson";

/**
 * A region's subway lines and stations, built by `npm run transit`
 * (docs/proposals/m8-transit.md) and served at /transit/<region>.geojson.
 */
export interface TransitLineProps {
  kind: "line";
  id: string;
  code: string;
  label: string;
  colour: string;
  /** Track this line shares with another (config `shares`): drawn dashed over the other's colour. */
  shared?: boolean;
}

export interface TransitStationProps {
  kind: "station";
  /** `<region>:<Japanese name>`, stable across builds; selection and links use it. */
  id: string;
  /** As the station's signs write it, in Japanese. */
  name: string;
  en: string;
  /** Line ids, in config order. */
  lines: string[];
}

export type TransitData = FeatureCollection<MultiLineString | Point, TransitLineProps | TransitStationProps>;

/**
 * A station name as stop lists and tiles both write it, for matching the
 * two in `npm run transit` and ours with ODPT's in `npm run stations`: no
 * 〈alias〉, (note) or 駅, one spelling of the small ケ (市ヶ谷 and 市ケ谷
 * are one station), and of 麹 (Tokyo Metro writes 麴町).
 */
export function normaliseStation(name: string): string {
  return name
    .replace(/〈[^〉]*〉|（[^）]*）|\([^)]*\)/g, "")
    .replace(/駅$/, "")
    .replace(/[ヶヵ]/g, "ケ")
    .replace(/麴/g, "麹")
    .replace(/\s+/g, "");
}

const loading = new Map<string, Promise<TransitData | undefined>>();

/** The region's transit file, once per region; undefined when it has none or the fetch fails. */
export function loadTransit(region: string): Promise<TransitData | undefined> {
  let p = loading.get(region);
  if (!p) {
    p = fetch(`/transit/${region}.geojson`)
      .then((res) => (res.ok ? (res.json() as Promise<TransitData>) : undefined))
      .catch(() => undefined);
    loading.set(region, p);
  }
  return p;
}

/**
 * The map filter for the stations to show: those with at least one line
 * not hidden. A MapLibre expression over each station's `lines` array.
 */
export function stationFilter(hidden: ReadonlySet<string>, allIds: readonly string[]): unknown[] {
  const shown = allIds.filter((id) => !hidden.has(id));
  return ["all", ["==", ["get", "kind"], "station"], ["any", ...shown.map((id) => ["in", id, ["get", "lines"]]), false]];
}

/** The prefix that marks a selection as a station rather than a place: `station:tokyo:渋谷`. */
export const STATION_SELECTION = "station:";

export const isStationSelection = (id: string | undefined): id is string => id?.startsWith(STATION_SELECTION) ?? false;

/** The region a station selection belongs to: `station:tokyo:渋谷` → `tokyo`. */
export const stationRegion = (selection: string): string => selection.slice(STATION_SELECTION.length).split(":")[0] ?? "";

/** A station by its selection id (`station:<id>`) in a region's data. */
export function findStation(data: TransitData | undefined, selection: string): { props: TransitStationProps; at: [number, number] } | undefined {
  const id = selection.slice(STATION_SELECTION.length);
  for (const f of data?.features ?? []) {
    if (f.properties.kind === "station" && f.properties.id === id && f.geometry.type === "Point") {
      return { props: f.properties, at: f.geometry.coordinates as [number, number] };
    }
  }
  return undefined;
}

/**
 * A region's station data for the station cards, built by `npm run
 * stations` (docs/proposals/m8-transit.md, "The facts") and served at
 * /transit/<region>.stations.json.
 */
export interface StationsFile {
  /**
   * Who the train times come from, by ODPT operator ("Toei"), for the card's credit, with when they were fetched
   * from ODPT (YYYY-MM-DD; the oldest of the operator's railways), which ODPT's guideline asks apps to show.
   */
  sources: Record<string, { label: string; licence: string; fetched?: string }>;
  /**
   * Each line's stations in order, by station id, for the card's arrows:
   * Next steps away from station 01. The main line comes first; a branch
   * or the Oedo's loop closure after it, each adding only the links the
   * earlier ones lack.
   */
  order: Record<string, string[][]>;
  /** By station id; a station without times or amenities yet is absent. */
  stations: Record<string, StationFacts>;
}

export interface StationFacts {
  /** By line id. */
  lines: Record<string, LineFacts>;
  amenities?: Amenities;
}

export interface LineFacts {
  /** The station's number on this line, "S-01". */
  code?: string;
  /** The operator, a key of `sources`. */
  source: string;
  /** When the timetable took effect, YYYY-MM-DD. */
  from: string;
  directions: DirectionTimes[];
}

export interface DirectionTimes {
  /** "to Motoyawata", or on the Oedo's loop "via Azabu-juban". */
  label: string;
  weekday?: Service;
  /** Saturdays, Sundays and holidays. */
  holiday?: Service;
}

export interface Service {
  /** Departure times as the timetable writes them, "05:00", "00:10". */
  first: string;
  last: string;
  /** Where the last train stops, when short of the direction's end. */
  lastTo?: string;
}

export const AMENITIES = ["elevator", "escalator", "toilet", "accessibleToilet", "lockers"] as const;
export type Amenity = (typeof AMENITIES)[number];
/** Each amenity: true, false, or absent for unknown. */
export type Amenities = Partial<Record<Amenity, boolean>>;

const loadingStations = new Map<string, Promise<StationsFile | undefined>>();

/** The region's station data, once per region; undefined when it has none or the fetch fails. */
export function loadStations(region: string): Promise<StationsFile | undefined> {
  let p = loadingStations.get(region);
  if (!p) {
    p = fetch(`/transit/${region}.stations.json`)
      .then((res) => (res.ok ? (res.json() as Promise<StationsFile>) : undefined))
      .catch(() => undefined);
    loadingStations.set(region, p);
  }
  return p;
}

/** The stations before and after one on a line, by station id; the earlier sequence wins where two give a link. */
export function lineNeighbours(order: readonly (readonly string[])[] | undefined, id: string): { prev?: string; next?: string } {
  let prev: string | undefined;
  let next: string | undefined;
  for (const seq of order ?? []) {
    const i = seq.indexOf(id);
    if (i < 0) continue;
    prev ??= seq[i - 1];
    next ??= seq[i + 1];
  }
  return { ...(prev ? { prev } : {}), ...(next ? { next } : {}) };
}

/** The map filter for the lines to show; `shared` picks the shared track alone (true) or leaves it out (false). */
export function lineFilter(hidden: ReadonlySet<string>, shared?: boolean): unknown[] {
  const base = ["all", ["==", ["get", "kind"], "line"], ["!", ["in", ["get", "id"], ["literal", [...hidden]]]]];
  return shared === undefined ? base : [...base, shared ? ["has", "shared"] : ["!", ["has", "shared"]]];
}
