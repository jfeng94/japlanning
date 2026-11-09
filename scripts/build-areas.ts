/**
 * Generate the area shapes (docs/proposals/filter-pages-and-area-map.md, Part 2):
 * public/areas/<region>.geojson, one feature per area chip.
 *
 * Run with Node 26, which executes TypeScript directly:
 *   node scripts/build-areas.ts            every region with areas
 *   node scripts/build-areas.ts tokyo      one region
 *
 * The blocks are e-Stat's 2020 census small areas (令和2年国勢調査 小地域):
 * towns and chōme in Tokyo, Kyoto's street-block towns. One shapefile per
 * ward, downloaded once into .cache/estat/ (gitignored). Each block goes to
 * a raw area of its own ward:
 *
 *   1. a block holding one of the area's places belongs to that area;
 *   2. any other block goes to the area whose centre (the centroid of its
 *      places) is nearest, within REACH_M of the block's centre;
 *   3. config overrides (AreaConfig.shape) can move the centre, change the
 *      reach, or include and exclude named blocks.
 *
 * A chip's shape is the union of its members' blocks, simplified to about
 * SIMPLIFY_M. The output is committed, so builds never need the network.
 * Licence: the government's standard terms (compatible with CC BY 4.0);
 * the app credits e-Stat and says the shapes are processed from it.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import polygonClipping from "polygon-clipping";
import type { MultiPolygon as PcMultiPolygon, Polygon as PcPolygon } from "polygon-clipping";
import type { Position } from "geojson";
import { layers } from "../src/config/layers.ts";
import { areasOf, regionOptions, regions } from "../src/config/regions.ts";
import {
  gapBetweenM,
  pointInRing,
  ringAreaM2,
  ringCentroid,
  simplifyRing,
  type AreaShape,
  type AreaShapes,
} from "../src/data/area-shapes.ts";
import { parseLayerCsv } from "../src/data/parse.ts";
import type { Place, RegionId } from "../src/data/types.ts";
import { distanceM, type LatLng } from "../src/geo/distance.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".cache", "estat");
const OUT = path.join(ROOT, "public", "areas");

/** How far a block's centre may be from an area's centre and still join it. */
const REACH_M = 700;
/** Outline simplification: at the Area map's zoom a pixel is 10–40 m. */
const SIMPLIFY_M = 8;
/** Smaller polygons and holes are slivers, not places. */
const MIN_RING_M2 = 1500;
/** A block of water (水面) rather than land. */
const WATER = "8154";

/** e-Stat's municipality codes for the wards our areas sit in, by the name the addresses use. */
const WARD_CODES: Partial<Record<RegionId, Record<string, string>>> = {
  tokyo: {
    千代田区: "13101",
    中央区: "13102",
    港区: "13103",
    新宿区: "13104",
    台東区: "13106",
    墨田区: "13107",
    江東区: "13108",
    目黒区: "13110",
    世田谷区: "13112",
    渋谷区: "13113",
  },
  kyoto: {
    北区: "26101",
    中京区: "26104",
    東山区: "26105",
    下京区: "26106",
    右京区: "26108",
    宇治市: "26204",
  },
};

interface Block {
  name: string;
  ward: string;
  /** Polygons, each [outline, ...holes], [lng, lat]. */
  polygons: Position[][][];
  centre: LatLng;
}

// ---------- reading e-Stat's files ----------

async function wardZip(code: string): Promise<Buffer> {
  const file = path.join(CACHE, `${code}.zip`);
  if (!existsSync(file)) {
    const url = `https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=${code}&coordSys=1&format=shape&downloadType=5&datum=2011`;
    const res = await fetch(url, { headers: { "User-Agent": "japlanning-build/1.0 (+https://japan.garbage.house)" } });
    if (!res.ok) throw new Error(`e-Stat ${code}: HTTP ${res.status}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(file);
}

/** The files in a zip, by name: enough of the format for e-Stat's (stored or deflated entries). */
function unzip(buf: Buffer): Map<string, Buffer> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out.set(name, method === 0 ? data : inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Polygon records (shape type 5) as lists of rings; null shapes as []. */
function readShp(buf: Buffer): Position[][][] {
  const records: Position[][][] = [];
  for (let p = 100; p < buf.length; ) {
    const length = buf.readInt32BE(p + 4) * 2;
    const c = p + 8;
    const rings: Position[][] = [];
    if (buf.readInt32LE(c) === 5) {
      const parts = buf.readInt32LE(c + 36);
      const points = buf.readInt32LE(c + 40);
      const at = c + 44 + parts * 4;
      for (let i = 0; i < parts; i++) {
        const from = buf.readInt32LE(c + 44 + i * 4);
        const to = i + 1 < parts ? buf.readInt32LE(c + 44 + (i + 1) * 4) : points;
        const ring: Position[] = [];
        for (let k = from; k < to; k++) ring.push([buf.readDoubleLE(at + k * 16), buf.readDoubleLE(at + k * 16 + 8)]);
        rings.push(ring);
      }
    }
    records.push(rings);
    p = c + length;
  }
  return records;
}

/** dBASE rows as text fields; e-Stat writes Shift_JIS. */
function readDbf(buf: Buffer): Record<string, string>[] {
  const count = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const fields: { name: string; len: number }[] = [];
  for (let o = 32; buf[o] !== 0x0d; o += 32) fields.push({ name: buf.toString("latin1", o, o + 11).replace(/\0.*$/, ""), len: buf[o + 16]! });
  const text = new TextDecoder("shift_jis");
  const rows: Record<string, string>[] = [];
  for (let r = 0; r < count; r++) {
    let o = headerLen + r * recordLen + 1;
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = text.decode(buf.subarray(o, o + f.len)).trim();
      o += f.len;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * A shapefile's rings into polygons: outlines run clockwise in shapefiles
 * and holes the other way; each hole joins the outline that contains it.
 * Outlines come out counter-clockwise, as GeoJSON wants.
 */
function toPolygons(rings: Position[][]): Position[][][] {
  const outlines = rings.filter((r) => ringAreaM2(r) < 0).map((r) => [[...r].reverse()]);
  for (const hole of rings.filter((r) => ringAreaM2(r) > 0)) {
    const [x, y] = hole[0] as [number, number];
    const owner = outlines.find((poly) => pointInRing(x, y, poly[0]!));
    if (owner) owner.push([...hole].reverse());
  }
  return outlines;
}

async function wardBlocks(ward: string, code: string): Promise<Block[]> {
  const files = unzip(await wardZip(code));
  const shp = [...files].find(([n]) => n.endsWith(".shp"))?.[1];
  const dbf = [...files].find(([n]) => n.endsWith(".dbf"))?.[1];
  if (!shp || !dbf) throw new Error(`e-Stat ${code}: no shapefile in the download`);
  const shapes = readShp(shp);
  const rows = readDbf(dbf);
  const blocks: Block[] = [];
  rows.forEach((row, i) => {
    if (row["HCODE"] === WATER) return;
    const polygons = toPolygons(shapes[i] ?? []);
    const biggest = polygons.map((p) => p[0]!).sort((a, b) => ringAreaM2(b) - ringAreaM2(a))[0];
    if (!biggest) return;
    blocks.push({ name: row["S_NAME"] ?? "", ward, polygons, centre: ringCentroid(biggest) });
  });
  return blocks;
}

// ---------- assigning blocks to areas ----------

interface AreaPlan {
  raw: string;
  ward: string;
  centre: LatLng;
  reach: number;
  include: Set<string>;
  exclude: Set<string>;
  places: Place[];
}

function insideBlock(at: LatLng, block: Block): boolean {
  return block.polygons.some(([outline, ...holes]) => pointInRing(at.lng, at.lat, outline!) && !holes.some((h) => pointInRing(at.lng, at.lat, h)));
}

function assign(blocks: Block[], plans: AreaPlan[]): Map<string, Block[]> {
  const out = new Map<string, Block[]>(plans.map((p) => [p.raw, []]));
  for (const block of blocks) {
    const candidates = plans.filter((p) => p.ward === block.ward && !p.exclude.has(block.name));
    const forced = candidates.find((p) => p.include.has(block.name));
    const holding = candidates.filter((p) => p.places.some((place) => insideBlock(place, block)));
    const near = candidates
      .map((p) => ({ p, d: distanceM(block.centre, p.centre) }))
      .filter(({ p, d }) => d <= p.reach)
      .sort((a, b) => a.d - b.d)[0]?.p;
    const nearestHolding = holding.sort((a, b) => distanceM(block.centre, a.centre) - distanceM(block.centre, b.centre))[0];
    const owner = forced ?? nearestHolding ?? near;
    if (owner) out.get(owner.raw)!.push(block);
  }
  return out;
}

// ---------- shapes ----------

function round(p: Position): Position {
  return [Math.round(p[0]! * 1e5) / 1e5, Math.round(p[1]! * 1e5) / 1e5];
}

/**
 * Snap a ring to a 1e-6° grid (about 10 cm) and drop repeated points. Neighbouring
 * blocks' shared borders then meet exactly; without it the union can trip
 * on floating-point near-misses ("Unable to complete output ring").
 */
function snapRing(ring: Position[]): Position[] {
  const out: Position[] = [];
  for (const p of ring) {
    const q: Position = [Math.round(p[0]! * 1e6) / 1e6, Math.round(p[1]! * 1e6) / 1e6];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}

/** Union, simplify, drop slivers, round. */
function shapeOf(blocks: Block[]): PcMultiPolygon {
  const polygons = blocks
    .flatMap((b) => b.polygons)
    .map((poly) => poly.map(snapRing).filter((ring) => ring.length >= 4))
    .filter((poly) => poly.length > 0) as PcPolygon[];
  if (polygons.length === 0) return [];
  const merged = polygonClipping.union(polygons[0]!, ...polygons.slice(1));
  const out: PcMultiPolygon = [];
  for (const poly of merged) {
    const [outline, ...holes] = poly.map((ring) => simplifyRing(ring, SIMPLIFY_M));
    if (!outline || Math.abs(ringAreaM2(outline)) < MIN_RING_M2) continue;
    out.push([outline, ...holes.filter((h) => Math.abs(ringAreaM2(h)) >= MIN_RING_M2)].map((ring) => ring.map(round)) as PcPolygon);
  }
  return out;
}

async function buildRegion(regionId: RegionId, places: Place[]): Promise<void> {
  const region = regions.find((r) => r.id === regionId)!;
  const index = areasOf(regionId);
  const codes = WARD_CODES[regionId] ?? {};
  const regionPlaces = places.filter((p) => p.region === regionId);

  const plans: AreaPlan[] = region.areas.map((a) => {
    const own = regionPlaces.filter((p) => p.area === a.label);
    const centroid = own.length > 0 ? { lat: own.reduce((s, p) => s + p.lat, 0) / own.length, lng: own.reduce((s, p) => s + p.lng, 0) / own.length } : undefined;
    const centre = a.shape?.centre ? { lng: a.shape.centre[0], lat: a.shape.centre[1] } : centroid;
    if (!centre) throw new Error(`${regionId}: ${a.label} has no places and no shape.centre in config`);
    return {
      raw: a.label,
      ward: a.ward,
      centre,
      reach: a.shape?.reachM ?? REACH_M,
      include: new Set(a.shape?.include ?? []),
      exclude: new Set(a.shape?.exclude ?? []),
      places: own,
    };
  });

  const blocks: Block[] = [];
  for (const ward of new Set(plans.map((p) => p.ward))) {
    const code = codes[ward];
    if (!code) throw new Error(`${regionId}: no e-Stat code for ${ward}; add it to WARD_CODES in scripts/build-areas.ts`);
    blocks.push(...(await wardBlocks(ward, code)));
  }
  const byRaw = assign(blocks, plans);

  const features: AreaShape[] = [];
  const rows: string[] = [];
  for (const chip of index.chips) {
    const chipBlocks = chip.members.flatMap((m) => byRaw.get(m) ?? []);
    const coordinates = shapeOf(chipBlocks);
    if (coordinates.length === 0) throw new Error(`${regionId}: ${chip.label} got no blocks; widen its reach or include blocks`);
    features.push({
      type: "Feature",
      properties: { chip: chip.label, members: chip.members },
      geometry: coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0]! } : { type: "MultiPolygon", coordinates },
    });
    const km2 = coordinates.reduce((s, poly) => s + poly.reduce((t, ring, i) => t + (i === 0 ? 1 : -1) * Math.abs(ringAreaM2(ring)), 0), 0) / 1e6;
    const vertices = coordinates.flat(2).length;
    rows.push(`  ${chip.label.padEnd(20)} ${String(chipBlocks.length).padStart(4)} blocks  ${km2.toFixed(2).padStart(5)} km²  ${String(vertices).padStart(5)} points  ${chipBlocks.map((b) => b.name).slice(0, 6).join(" ")}${chipBlocks.length > 6 ? " …" : ""}`);
  }

  const collection: AreaShapes & { meta: Record<string, string> } = {
    type: "FeatureCollection",
    meta: {
      source: "e-Stat, 2020 census small areas (令和2年国勢調査 小地域), processed by scripts/build-areas.ts",
      licence: "Government of Japan Standard Terms of Use 2.0 (compatible with CC BY 4.0)",
    },
    features,
  };
  await mkdir(OUT, { recursive: true });
  const text = JSON.stringify(collection);
  await writeFile(path.join(OUT, `${regionId}.geojson`), text + "\n");
  console.log(`${regionId}: ${features.length} chips from ${blocks.length} blocks, ${(text.length / 1024).toFixed(0)} KB -> public/areas/${regionId}.geojson`);
  for (const r of rows) console.log(r);
  console.log(`  unassigned blocks: ${blocks.length - [...byRaw.values()].reduce((s, b) => s + b.length, 0)}`);

  // The neighbour check the tests will hold the config to: shapes that touch vs the listed graph.
  const touching: string[] = [];
  const listedApart: string[] = [];
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i]!, b = features[j]!;
      const gap = gapBetweenM(a.geometry, b.geometry);
      const listed = index.neighbours([a.properties.chip]).has(b.properties.chip);
      if (gap <= TOUCH_M && !listed) touching.push(`${a.properties.chip} – ${b.properties.chip}`);
      if (listed && gap > TOUCH_M) listedApart.push(`${a.properties.chip} – ${b.properties.chip} (${Math.round(gap)} m apart)`);
    }
  }
  console.log(`  touching but not listed as neighbours: ${touching.length ? touching.join(", ") : "none"}`);
  console.log(`  listed as neighbours but apart: ${listedApart.length ? listedApart.join(", ") : "none"}`);
}

/** Shapes this close count as touching (simplification leaves shared borders a few metres apart). */
const TOUCH_M = 30;

const wanted = process.argv.slice(2);
const drinks = layers.find((l) => l.id === "drinks")!;
const { places } = parseLayerCsv(await readFile(path.join(ROOT, "data", "drinks.csv"), "utf8"), drinks, regionOptions());
for (const region of regions) {
  if (region.areas.length === 0 || (wanted.length > 0 && !wanted.includes(region.id))) continue;
  await buildRegion(region.id, places);
}
