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
 * two in `npm run transit`: no 〈alias〉, (note) or 駅, and one spelling of
 * the small ケ (市ヶ谷 and 市ケ谷 are one station).
 */
export function normaliseStation(name: string): string {
  return name
    .replace(/〈[^〉]*〉|（[^）]*）|\([^)]*\)/g, "")
    .replace(/駅$/, "")
    .replace(/[ヶヵ]/g, "ケ")
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

/** The map filter for the lines to show. */
export function lineFilter(hidden: ReadonlySet<string>): unknown[] {
  return ["all", ["==", ["get", "kind"], "line"], ["!", ["in", ["get", "id"], ["literal", [...hidden]]]]];
}
