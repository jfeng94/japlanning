/**
 * The subway lines and their stations, per region (docs/proposals/m8-transit.md):
 *
 *   npm run transit              build, reusing the cached stop lists
 *   npm run transit -- --refresh fetch the stop lists again first
 *
 * For every region with lines in src/config/transit.ts it writes
 * public/transit/<region>.geojson:
 *
 * - **one MultiLineString per line**, with its id, code, label and colour:
 *   the track from the map's own zoom-15 tiles, where every rail line is
 *   named, simplified to about a metre. The tiles come from
 *   public/basemap/<region>.pmtiles (`npm run maps` puts it there), else
 *   the maps site.
 * - **one Point per station on those lines**, with the lines that stop
 *   there. Which lines stop where comes from OpenStreetMap's route data
 *   (each line's stop list), fetched once from Overpass and cached in
 *   .cache/transit/stops.json. A tile station node counts for a line when
 *   its name is on the line's stop list and it lies near the line's own
 *   track; that leaves out through-running stops on other railways. Nodes
 *   of one name close together (Shibuya has four) are one station.
 *
 * The output is committed and served with the app, like the area shapes.
 * Run it again after the map archive changes (a new build or bbox).
 */

import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { FetchSource, PMTiles, type Source } from "pmtiles";
import { BASEMAP } from "../src/config/basemap.ts";
import { regionById } from "../src/config/regions.ts";
import { TRANSIT_LINES, TRANSIT_REGIONS, type TransitLine } from "../src/config/transit.ts";
import { normaliseStation } from "../src/data/transit.ts";
import type { RegionId } from "../src/data/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "transit");
const STOPS_CACHE = path.join(ROOT, ".cache", "transit", "stops.json");
/** The archive's deepest zoom: subways appear in the tiles only here. */
const Z = 15;
/** A station node on a line's stop list counts when it lies this close to the line's own track. */
const NEAR_TRACK_M = 300;
/** Station nodes of one name this close together are one station. */
const MERGE_M = 500;
/** Douglas–Peucker tolerance, in metres. */
const SIMPLIFY_M = 1.5;
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const UA = "japlanning-build/1.0 (+https://japan.garbage.house)";

type Pt = [number, number];

// ---- stop lists ----

type StopLists = Record<string, string[]>; // route name prefix -> normalised stop names

/** Each configured line's stops, by its OSM route name: from the cache, or Overpass with --refresh (or no cache). */
async function stopLists(refresh: boolean): Promise<StopLists> {
  if (!refresh) {
    const cached = await readFile(STOPS_CACHE, "utf8").then((t) => JSON.parse(t) as { lists: StopLists }, () => undefined);
    if (cached) return cached.lists;
  }
  const routes = TRANSIT_LINES.map((l) => l.route);
  const query = `[out:json][timeout:90];
rel["route"="subway"]["name"~"^(${routes.join("|")})"]->.r;
.r out body;
node(r.r)->.n;
.n out tags;`;
  for (const host of OVERPASS) {
    try {
      const res = await fetch(host, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(150_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      type El = { type: string; id: number; tags?: Record<string, string>; members?: { type: string; ref: number; role: string }[] };
      const { elements } = (await res.json()) as { elements: El[] };
      const names = new Map(elements.filter((e) => e.type === "node").map((e) => [e.id, e.tags?.["name"] ?? ""]));
      const lists: StopLists = {};
      for (const route of routes) {
        const stops = new Set<string>();
        for (const r of elements) {
          if (r.type !== "relation" || !r.tags?.["name"]?.startsWith(route)) continue;
          for (const m of r.members ?? []) {
            if (m.type !== "node" || !/^(stop|platform)/.test(m.role)) continue;
            const name = normaliseStation(names.get(m.ref) ?? "");
            if (name) stops.add(name);
          }
        }
        lists[route] = [...stops];
      }
      await mkdir(path.dirname(STOPS_CACHE), { recursive: true });
      await writeFile(STOPS_CACHE, JSON.stringify({ fetched: new Date().toISOString(), from: host, lists }, null, 1));
      console.log(`  stop lists from ${host}`);
      return lists;
    } catch (err) {
      console.log(`  ${host}: ${(err as Error).message}`);
    }
  }
  throw new Error("No Overpass server answered; try again later (the stop lists are cached once fetched).");
}

// ---- tiles ----

/** The region's archive, from disk when `npm run maps` left one, else the maps site; `close` releases the file. */
async function archiveFor(region: RegionId): Promise<{ archive: PMTiles; close: () => Promise<void> }> {
  const local = path.join(ROOT, "public", "basemap", `${region}.pmtiles`);
  const exists = await stat(local).then(() => true, () => false);
  if (!exists) {
    console.log(`  ${region}: no local archive (npm run maps); reading the maps site`);
    return { archive: new PMTiles(new FetchSource(`${BASEMAP.site}/${region}.pmtiles`)), close: async () => {} };
  }
  const fh = await open(local, "r");
  const source: Source = {
    getKey: () => local,
    async getBytes(offset: number, length: number) {
      const buf = Buffer.alloc(length);
      await fh.read(buf, 0, length, offset);
      return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) as ArrayBuffer };
    },
  };
  return { archive: new PMTiles(source), close: () => fh.close() };
}

const tileX = (lon: number, n: number) => Math.floor(((lon + 180) / 360) * n);
const tileY = (lat: number, n: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
};

// ---- geometry ----

/** Metres between two points, flat-earth: fine at these distances. */
function metres(a: Pt, b: Pt): number {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111_320;
}

/** Metres from p to the segment ab. */
function toSegment(p: Pt, a: Pt, b: Pt): number {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1];
  const bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  return Math.hypot(ax + t * dx, ay + t * dy) * 111_320;
}

/** Douglas–Peucker, in metres. */
function simplify(line: Pt[], tol: number): Pt[] {
  if (line.length <= 2) return line;
  let worst = 0, at = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const d = toSegment(line[i]!, line[0]!, line[line.length - 1]!);
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= tol) return [line[0]!, line[line.length - 1]!];
  return [...simplify(line.slice(0, at + 1), tol).slice(0, -1), ...simplify(line.slice(at), tol)];
}

const round = (p: Pt): Pt => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6];

/** Metres from a point to the nearest piece of a track. */
const toTrack = (at: Pt, parts: Pt[][]) =>
  parts.reduce((best, pts) => pts.reduce((d, p, i) => (i === 0 ? d : Math.min(d, toSegment(at, pts[i - 1]!, p))), best), Infinity);

// ---- build ----

async function buildRegion(region: RegionId, stops: StopLists): Promise<void> {
  const lines = TRANSIT_LINES.filter((l) => l.region === region);
  const [w, s, e, nth] = regionById(region).bbox!;
  const n = 2 ** Z;
  const { archive, close } = await archiveFor(region);
  const tracks = new Map<string, Pt[][]>(lines.map((l) => [l.id, []]));
  const nodes: { name: string; en?: string; at: Pt }[] = [];
  const lineOf = (name: unknown): TransitLine | undefined =>
    typeof name === "string" ? lines.find((l) => name.startsWith(l.match)) : undefined;

  let tiles = 0;
  try {
    for (let x = tileX(w, n); x <= tileX(e, n); x++) {
      for (let y = tileY(nth, n); y <= tileY(s, n); y++) {
        const res = await archive.getZxy(Z, x, y);
        if (!res) continue;
        tiles++;
        const tile = new VectorTile(new PbfReader(new Uint8Array(res.data)));
        const roads = tile.layers["roads"];
        for (let i = 0; roads && i < roads.length; i++) {
          const f = roads.feature(i);
          if (f.properties["kind"] !== "rail" || f.properties["service"]) continue; // no yards, sidings or crossovers
          const line = lineOf(f.properties["name"]);
          if (!line) continue;
          const g = f.toGeoJSON(x, y, Z).geometry;
          const parts = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
          for (const part of parts) tracks.get(line.id)!.push(simplify(part as Pt[], SIMPLIFY_M).map(round));
        }
        const pois = tile.layers["pois"];
        for (let i = 0; pois && i < pois.length; i++) {
          const f = pois.feature(i);
          if (f.properties["kind"] !== "station") continue;
          const g = f.toGeoJSON(x, y, Z).geometry;
          const name = String(f.properties["name"] ?? "");
          if (g.type !== "Point" || !name) continue;
          const en = f.properties["name:en"];
          nodes.push({ name, ...(typeof en === "string" ? { en } : {}), at: g.coordinates as Pt });
        }
      }
    }
  } finally {
    await close();
  }

  // A node serves a line when its name is on the line's stop list and it lies near the line's own track.
  const served = nodes
    .map((node) => {
      const key = normaliseStation(node.name);
      const ids = lines
        .filter((l) => stops[l.route]?.includes(key) && toTrack(node.at, tracks.get(l.id)!) <= NEAR_TRACK_M)
        .map((l) => l.id);
      return { node, key, ids };
    })
    .filter((s) => s.ids.length > 0);

  // One station per name within MERGE_M: the mean of its nodes, the union of their lines.
  const stations: { name: string; key: string; en?: string; at: Pt[]; lines: Set<string> }[] = [];
  for (const { node, key, ids } of served) {
    const same = stations.find((st) => st.key === key && st.at.some((p) => metres(p, node.at) <= MERGE_M));
    if (same) {
      same.at.push(node.at);
      for (const id of ids) same.lines.add(id);
      same.en ??= node.en;
    } else {
      stations.push({ name: node.name, key, ...(node.en ? { en: node.en } : {}), at: [node.at], lines: new Set(ids) });
    }
  }

  // A station's id is its region and Japanese name, for selection and links; a second station of the same name
  // (none today) would take a "~2".
  const seen = new Map<string, number>();
  const stationId = (name: string) => {
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? `${region}:${name}` : `${region}:${name}~${n}`;
  };

  const features = [
    ...lines.map((l) => ({
      type: "Feature" as const,
      properties: { kind: "line", id: l.id, code: l.code, label: l.label, colour: l.colour },
      geometry: { type: "MultiLineString" as const, coordinates: tracks.get(l.id)!.filter((p) => p.length > 1) },
    })),
    ...stations.map((st) => ({
      type: "Feature" as const,
      properties: {
        kind: "station",
        id: stationId(st.name),
        name: st.name,
        // OpenStreetMap writes an alias in quotes ("Meiji-jingumae 'Harajuku'"); signs put it in brackets.
        en: (st.en ?? st.name).replace(/\s*'([^']+)'/, " ($1)"),
        // In config order, so chips list lines the same way everywhere.
        lines: lines.filter((l) => st.lines.has(l.id)).map((l) => l.id),
      },
      geometry: {
        type: "Point" as const,
        coordinates: round([st.at.reduce((a, p) => a + p[0], 0) / st.at.length, st.at.reduce((a, p) => a + p[1], 0) / st.at.length]),
      },
    })),
  ];

  await mkdir(OUT_DIR, { recursive: true });
  const text = JSON.stringify({ type: "FeatureCollection", features });
  await writeFile(path.join(OUT_DIR, `${region}.geojson`), text + "\n");
  console.log(`  ${region}: ${tiles} tiles, ${(text.length / 1024).toFixed(0)} KB, ${stations.length} stations`);
  for (const l of lines) {
    const pieces = tracks.get(l.id)!.length;
    const found = stations.filter((st) => st.lines.has(l.id)).length;
    const listed = stops[l.route]?.length ?? 0;
    const warn = pieces === 0 ? "  <- track NOT FOUND in the tiles" : listed === 0 ? "  <- no stop list" : "";
    console.log(`    ${l.code.padEnd(2)} ${l.label.padEnd(16)} ${String(pieces).padStart(4)} pieces, ${String(found).padStart(3)} stations (of ${listed} on its stop list)${warn}`);
  }
}

console.log("transit: subway lines from the zoom-15 tiles, stops from OpenStreetMap");
const stops = await stopLists(process.argv.includes("--refresh"));
for (const region of TRANSIT_REGIONS) await buildRegion(region, stops);
