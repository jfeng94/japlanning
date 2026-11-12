/**
 * Station data for the station cards (docs/proposals/m8-transit.md, "The facts"):
 *
 *   npm run stations              build, reusing cached ODPT responses
 *   npm run stations -- --refresh fetch them again first
 *
 * For every region with subway lines it writes
 * public/transit/<region>.stations.json (src/data/transit.ts, StationsFile):
 *
 * - **each line's station order**, for the card's Prev/Next arrows: from
 *   ODPT's railway data where ODPT has the line, else from OpenStreetMap's
 *   stop list (cached by `npm run transit`), oriented so Next steps away
 *   from station 01 (`first` in src/config/transit.ts).
 * - **each station's code and first and last trains** per line,
 *   direction and day type, from ODPT's station timetables: a summary,
 *   never the timetables themselves (ODPT's licence forbids republishing
 *   data a timetable could be rebuilt from).
 *
 * Toei's data is public. Tokyo Metro's needs a developer token in the
 * ODPT_TOKEN environment variable (never in the repo or the cache's
 * file names); without one its lines keep OpenStreetMap's order and no
 * times. Responses are cached in .cache/stations/, one file per railway.
 * Rerun before the trip: timetables change with each operator's revision,
 * and the licence asks that the app keep up. It reads
 * public/transit/<region>.geojson, so run it after `npm run transit`.
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { TRANSIT_LINES, TRANSIT_REGIONS, type TransitLine } from "../src/config/transit.ts";
import {
  normaliseStation,
  type DirectionTimes,
  type LineFacts,
  type Service,
  type StationsFile,
  type TransitData,
  type TransitStationProps,
} from "../src/data/transit.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "transit");
const CACHE_DIR = path.join(ROOT, ".cache", "stations");
const STOPS_CACHE = path.join(ROOT, ".cache", "transit", "stops.json");
const UA = "japlanning-build/1.0 (+https://japan.garbage.house)";
/** Where OpenStreetMap's stop list jumps further than this between two of our stations, the list has moved on to a branch. */
const GAP_M = 4000;

/** Each operator's ODPT data: Toei's is public; Tokyo Metro's needs a developer token. */
const OPERATORS: Record<string, { api: string; token: boolean; label: string; licence: string }> = {
  Toei: {
    api: "https://api-public.odpt.org/api/v4",
    token: false,
    label: "Toei (Bureau of Transportation, Tokyo Metropolitan Government)",
    licence: "CC BY 4.0",
  },
  TokyoMetro: {
    api: "https://api.odpt.org/api/v4",
    token: true,
    label: "Tokyo Metro",
    licence: "ODPT Basic License",
  },
};

// ---- ODPT's shapes, as far as we read them ----

interface OdptTitle {
  ja?: string;
  en?: string;
}
interface OdptRailway {
  "owl:sameAs": string;
  "odpt:ascendingRailDirection"?: string;
  "odpt:descendingRailDirection"?: string;
  "odpt:stationOrder": { "odpt:index": number; "odpt:station": string; "odpt:stationTitle"?: OdptTitle }[];
}
interface OdptStation {
  "owl:sameAs": string;
  "odpt:stationCode"?: string;
  "odpt:stationTitle"?: OdptTitle;
}
interface OdptEntry {
  "odpt:departureTime"?: string;
  "odpt:destinationStation"?: string[];
}
interface OdptTimetable {
  "odpt:station": string;
  "odpt:railDirection": string;
  "odpt:calendar": string;
  "dct:issued"?: string;
  "odpt:stationTimetableObject": OdptEntry[];
}

interface RailwayData {
  id: string;
  operator: string;
  /** When its responses were fetched (their cache files written), YYYY-MM-DD in Tokyo: ODPT's guideline asks apps to show it. */
  fetched: string;
  railway: OdptRailway;
  stations: OdptStation[];
  timetables: OdptTimetable[];
}

const operatorOf = (railway: string) => railway.replace(/^odpt\.Railway:/, "").split(".")[0]!;

const cacheFile = (railway: string, type: string) => path.join(CACHE_DIR, `${railway.replace(/^odpt\.Railway:/, "")}-${type}.json`);
const TYPES = ["Railway", "Station", "StationTimetable"] as const;

/** One ODPT query, cached; undefined when the operator needs a token and there is none, or ODPT returns nothing. */
async function odpt<T>(railway: string, type: (typeof TYPES)[number], query: Record<string, string>, refresh: boolean): Promise<T[] | undefined> {
  const file = cacheFile(railway, type);
  if (!refresh) {
    const cached = await readFile(file, "utf8").then((t) => JSON.parse(t) as T[], () => undefined);
    if (cached) return cached;
  }
  const op = OPERATORS[operatorOf(railway)];
  if (!op) throw new Error(`${railway}: no operator entry in OPERATORS`);
  const token = process.env["ODPT_TOKEN"];
  if (op.token && !token) return undefined;
  const url = new URL(`${op.api}/odpt:${type}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  if (op.token) url.searchParams.set("acl:consumerKey", token!);
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(300_000) });
  // Never print the URL: it carries the token.
  if (!res.ok) throw new Error(`${railway} ${type}: HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error(`${railway} ${type}: not a list`);
  if (data.length === 0) return undefined;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data as T[];
}

/** A railway's order, stations and station timetables; undefined without access (Tokyo Metro before the token). */
async function railwayData(id: string, refresh: boolean): Promise<RailwayData | undefined> {
  const railways = await odpt<OdptRailway>(id, "Railway", { "owl:sameAs": id }, refresh);
  const stations = await odpt<OdptStation>(id, "Station", { "odpt:railway": id }, refresh);
  const timetables = await odpt<OdptTimetable>(id, "StationTimetable", { "odpt:railway": id }, refresh);
  const railway = railways?.[0];
  if (!railway || !stations || !timetables) return undefined;
  // The oldest of the three, as a date in Tokyo ("sv-SE" writes YYYY-MM-DD).
  const written = Math.min(...(await Promise.all(TYPES.map((t) => stat(cacheFile(id, t)).then((s) => s.mtimeMs)))));
  const fetched = new Date(written).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  return { id, operator: operatorOf(id), fetched, railway, stations, timetables };
}

// ---- our stations ----

interface Ours {
  id: string;
  props: TransitStationProps;
  at: [number, number];
  key: string;
}

/** Metres between two points, flat-earth: fine at these distances. */
function metres(a: [number, number], b: [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111_320;
}

// ---- order ----

/** Split a list at its holes (undefined), keeping the runs. */
function runs(ids: (string | undefined)[]): string[][] {
  const out: string[][] = [[]];
  for (const id of ids) {
    if (id === undefined) out.push([]);
    else out.at(-1)!.push(id);
  }
  return out.filter((r) => r.length > 0);
}

/**
 * A line's sequences from ODPT: the main railway first, reversed if
 * station 01 sits in its second half; a loop's repeated first station
 * (the Oedo starts and turns at Tochomae) becomes a closing link of its
 * own; a branch ends at the station it shares with the main line.
 */
function odptOrder(line: TransitLine, data: RailwayData[], ourOf: Map<string, string>, ours: Map<string, Ours>): string[][] {
  const out: string[][] = [];
  const closures: string[][] = [];
  data.forEach((d, k) => {
    const entries = [...d.railway["odpt:stationOrder"]].sort((a, b) => a["odpt:index"] - b["odpt:index"]);
    for (let run of runs(entries.map((e) => ourOf.get(e["odpt:station"])))) {
      if (k === 0) {
        const firstAt = run.findIndex((id) => ours.get(id)?.key === normaliseStation(line.first));
        if (firstAt > run.length / 2) run = [...run].reverse();
        if (run.length > 2 && run.indexOf(run[0]!, 1) > 0) {
          closures.push([run[0]!, run[1]!]);
          run = run.slice(1);
        }
      } else {
        const earlier = new Set(out.flat());
        if (earlier.has(run[0]!) && !earlier.has(run.at(-1)!)) run = [...run].reverse();
      }
      out.push(run);
    }
  });
  return [...out, ...closures];
}

/** A line's sequences from OpenStreetMap's stop list: ours in list order, split where the list jumps far, oriented by station 01. */
function osmOrder(line: TransitLine, stops: string[], mine: Ours[]): string[][] {
  const first = normaliseStation(line.first);
  const list = stops.indexOf(first) > stops.length / 2 ? [...stops].reverse() : stops;
  const byKey = new Map(mine.map((s) => [s.key, s]));
  const seq: (string | undefined)[] = [];
  let prev: Ours | undefined;
  for (const name of list) {
    const s = byKey.get(name);
    if (!s) continue;
    if (prev && metres(prev.at, s.at) > GAP_M) seq.push(undefined);
    seq.push(s.id);
    prev = s;
  }
  return runs(seq);
}

// ---- times ----

const DAY_TYPES = {
  weekday: ["odpt.Calendar:Weekday"],
  holiday: ["odpt.Calendar:SaturdayHoliday", "odpt.Calendar:Holiday", "odpt.Calendar:Saturday"],
} as const;

/** Each direction's first and last trains at one ODPT station, labelled for a visitor. */
function directionsAt(stationId: string, d: RailwayData, titleOf: (id: string) => string): { directions: DirectionTimes[]; from?: string } {
  const tts = d.timetables.filter((t) => t["odpt:station"] === stationId);
  const order = [...d.railway["odpt:stationOrder"]].sort((a, b) => a["odpt:index"] - b["odpt:index"]);
  const onRailway = new Set(order.map((e) => e["odpt:station"]));
  const asc = d.railway["odpt:ascendingRailDirection"];
  const desc = d.railway["odpt:descendingRailDirection"];
  const loop = asc?.endsWith("Loop") ?? false;
  const dirs = [...new Set(tts.map((t) => t["odpt:railDirection"]))].sort(
    (a, b) => Number(b === asc) * 2 + Number(b === desc) - (Number(a === asc) * 2 + Number(a === desc)),
  );
  const directions: DirectionTimes[] = [];
  for (const dir of dirs) {
    const pick = (cals: readonly string[]) => {
      for (const cal of cals) {
        const t = tts.find((x) => x["odpt:railDirection"] === dir && x["odpt:calendar"] === cal);
        if (t) return t["odpt:stationTimetableObject"].filter((e) => e["odpt:departureTime"]);
      }
      return undefined;
    };
    const weekday = pick(DAY_TYPES.weekday);
    const holiday = pick(DAY_TYPES.holiday);
    const sample = weekday ?? holiday ?? [];
    if (sample.length === 0) continue;

    // The label: the line's end on a plain line (as station signs put it, 押上方面); on a loop, or a direction that
    // is neither way along the railway, where most trains go, else the next station that way.
    let target: string | undefined;
    if (!loop && dir === asc) target = order.at(-1)?.["odpt:station"];
    else if (!loop && dir === desc) target = order[0]?.["odpt:station"];
    else {
      const counts = new Map<string, number>();
      for (const e of sample) {
        const to = e["odpt:destinationStation"]?.[0];
        if (to) counts.set(to, (counts.get(to) ?? 0) + 1);
      }
      const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (top && n! >= sample.length / 2) target = top;
    }
    let label: string;
    if (target) {
      label = `to ${titleOf(target)}`;
    } else {
      // A station listed twice (the Oedo's Tochomae) steps on from its first listing, and back from its last.
      const at = order.flatMap((e, k) => (e["odpt:station"] === stationId ? [k] : []));
      const j = dir === desc ? at.at(-1)! - 1 : at[0]! + 1;
      const next = order[j]?.["odpt:station"];
      label = next ? `via ${titleOf(next)}` : dir.replace(/^odpt\.RailDirection:/, "");
    }

    const service = (entries: OdptEntry[] | undefined): Service | undefined => {
      if (!entries?.length) return undefined;
      const last = entries.at(-1)!;
      const to = last["odpt:destinationStation"]?.[0];
      const lastTo = to && onRailway.has(to) && to !== target ? titleOf(to) : undefined;
      return { first: entries[0]!["odpt:departureTime"]!, last: last["odpt:departureTime"]!, ...(lastTo ? { lastTo } : {}) };
    };
    const w = service(weekday);
    const h = service(holiday);
    directions.push({ label, ...(w ? { weekday: w } : {}), ...(h ? { holiday: h } : {}) });
  }
  const issued = tts.map((t) => t["dct:issued"]).filter((x): x is string => !!x).sort();
  return { directions, ...(issued[0] ? { from: issued[0].slice(0, 10) } : {}) };
}

// ---- the build ----

async function buildRegion(region: string, stopLists: Record<string, string[]>, refresh: boolean): Promise<string[]> {
  const geo = JSON.parse(await readFile(path.join(OUT_DIR, `${region}.geojson`), "utf8")) as TransitData;
  const ours = new Map<string, Ours>();
  for (const f of geo.features) {
    if (f.properties.kind !== "station" || f.geometry.type !== "Point") continue;
    ours.set(f.properties.id, { id: f.properties.id, props: f.properties, at: f.geometry.coordinates as [number, number], key: normaliseStation(f.properties.name) });
  }
  const out: StationsFile = { sources: {}, order: {}, stations: {} };
  const problems: string[] = [];
  const notes: string[] = [];

  for (const line of TRANSIT_LINES.filter((l) => l.region === region)) {
    const mine = [...ours.values()].filter((s) => s.props.lines.includes(line.id));
    const data: RailwayData[] = [];
    for (const id of line.odpt ?? []) {
      const d = await railwayData(id, refresh);
      if (d) data.push(d);
    }
    if (data.length === 0 || data.length < (line.odpt?.length ?? 0)) {
      if (line.odpt?.length) notes.push(`${line.id}: no ODPT data (Tokyo Metro needs ODPT_TOKEN); OpenStreetMap's order, no times`);
      const stops = stopLists[line.route];
      if (!stops) {
        problems.push(`${line.id}: no stop list for "${line.route}" in ${STOPS_CACHE} (run npm run transit)`);
        continue;
      }
      out.order[line.id] = osmOrder(line, stops, mine);
    } else {
      // Match ODPT's stations to ours by Japanese name, on this line.
      const byKey = new Map(mine.map((s) => [s.key, s.id]));
      const ourOf = new Map<string, string>();
      const titles = new Map<string, string>();
      for (const d of data) {
        for (const e of d.railway["odpt:stationOrder"]) {
          const ja = e["odpt:stationTitle"]?.ja ?? d.stations.find((s) => s["owl:sameAs"] === e["odpt:station"])?.["odpt:stationTitle"]?.ja ?? "";
          const id = byKey.get(normaliseStation(ja));
          if (id) ourOf.set(e["odpt:station"], id);
          const en = e["odpt:stationTitle"]?.en;
          if (en) titles.set(e["odpt:station"], en);
        }
      }
      const matched = new Set(ourOf.values());
      for (const s of mine) if (!matched.has(s.id)) problems.push(`${line.id}: ${s.props.name} (${s.id}) isn't on ODPT's ${line.odpt!.join(", ")}`);
      // Our English names where the station is ours (the map's labels), else ODPT's.
      const titleOf = (id: string) => {
        const o = ourOf.get(id);
        return (o && ours.get(o)?.props.en) ?? titles.get(id) ?? id.split(".").pop()!;
      };
      out.order[line.id] = odptOrder(line, data, ourOf, ours);

      for (const d of data) {
        const was = out.sources[d.operator]?.fetched;
        const fetched = was && was < d.fetched ? was : d.fetched;
        out.sources[d.operator] = { label: OPERATORS[d.operator]!.label, licence: OPERATORS[d.operator]!.licence, fetched };
        for (const [odptId, ourId] of ourOf) {
          if (!d.railway["odpt:stationOrder"].some((e) => e["odpt:station"] === odptId)) continue;
          const { directions, from } = directionsAt(odptId, d, titleOf);
          if (directions.length === 0) {
            problems.push(`${line.id}: no timetable for ${ourId} on ${d.id}`);
            continue;
          }
          const facts = (out.stations[ourId] ??= { lines: {} });
          const existing = facts.lines[line.id];
          // One style for every operator: Toei writes "S-01", Tokyo Metro "G02" (and "Mb05" on the Marunouchi branch).
          const code = d.stations.find((s) => s["owl:sameAs"] === odptId)?.["odpt:stationCode"]?.replace(/^([A-Za-z]+)-?(\d+)$/, "$1-$2");
          if (existing) {
            // A junction on a branch railway too: its directions join the main line's.
            existing.directions.push(...directions);
          } else {
            const lf: LineFacts = { ...(code ? { code } : {}), source: d.operator, from: from ?? "", directions };
            facts.lines[line.id] = lf;
          }
        }
      }
    }
    const inOrder = new Set(out.order[line.id]?.flat());
    for (const s of mine) if (!inOrder.has(s.id)) problems.push(`${line.id}: ${s.props.name} (${s.id}) is missing from the line's order`);
    const timed = mine.filter((s) => out.stations[s.id]?.lines[line.id]).length;
    console.log(`  ${region} ${line.id}: ${mine.length} stations, order in ${out.order[line.id]?.length ?? 0} run(s), ${timed} with times`);
  }
  for (const n of notes) console.log(`  note: ${n}`);

  // Stable output: stations by id.
  out.stations = Object.fromEntries(Object.entries(out.stations).sort(([a], [b]) => a.localeCompare(b)));
  const file = path.join(OUT_DIR, `${region}.stations.json`);
  const text = JSON.stringify(out) + "\n";
  await writeFile(file, text);
  console.log(`  wrote ${path.relative(ROOT, file)} (${Math.round(text.length / 1024)} KB)`);
  return problems;
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const stops = await readFile(STOPS_CACHE, "utf8").then((t) => (JSON.parse(t) as { lists: Record<string, string[]> }).lists, () => ({}));
  const problems: string[] = [];
  for (const region of TRANSIT_REGIONS) problems.push(...(await buildRegion(region, stops, refresh)));
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
}

await main();
