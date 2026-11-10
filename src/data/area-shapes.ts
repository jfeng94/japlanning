import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { distanceM, type LatLng } from "../geo/distance.ts";

/**
 * Area shapes (docs/proposals/filter-pages-and-area-map.md, Part 2): one
 * feature per area chip, generated from census blocks by
 * scripts/build-areas.ts into public/areas/<region>.geojson. Pure helpers
 * shared by that script, the app (Here by shape) and the tests.
 */
export interface ShapeProps {
  /** The area chip, e.g. "Ginza". */
  chip: string;
  /** The raw areas folded into it, e.g. ["Ginza", "Tsukiji"]. */
  members: string[];
}

export type AreaShape = Feature<Polygon | MultiPolygon, ShapeProps>;
export type AreaShapes = FeatureCollection<Polygon | MultiPolygon, ShapeProps>;

/** Rings of [lng, lat]; the first ring of each polygon is its outline, the rest are holes. */
export type Rings = Position[][];

/** Any polygonal geometry as a list of polygons. */
export function polygonsOf(geometry: Polygon | MultiPolygon): Rings[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

/** Ray casting; a point exactly on an edge may land either side, which is fine at this scale. */
export function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInShape(at: LatLng, geometry: Polygon | MultiPolygon): boolean {
  return polygonsOf(geometry).some(
    ([outline, ...holes]) => outline !== undefined && pointInRing(at.lng, at.lat, outline) && !holes.some((h) => pointInRing(at.lng, at.lat, h)),
  );
}

/** The chip whose shape contains the point, if any. */
export function chipAt(shapes: AreaShapes, at: LatLng): string | undefined {
  return shapes.features.find((f) => pointInShape(at, f.geometry))?.properties.chip;
}

/** Metres per degree near a latitude: an equirectangular frame, exact enough within a city. */
function frame(lat: number): { kx: number; ky: number } {
  return { kx: 111_320 * Math.cos((lat * Math.PI) / 180), ky: 110_540 };
}

/** Distance in metres from a point to a segment, in the local frame. */
function toSegmentM(p: Position, a: Position, b: Position, kx: number, ky: number): number {
  const px = p[0]! * kx, py = p[1]! * ky;
  const ax = a[0]! * kx, ay = a[1]! * ky;
  const bx = b[0]! * kx, by = b[1]! * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Metres from a point to the nearest edge of a shape; 0 inside it. */
export function distanceToShapeM(at: LatLng, geometry: Polygon | MultiPolygon): number {
  return pointInShape(at, geometry) ? 0 : edgeDistanceM(at, geometry);
}

/** Metres from a point to the nearest edge of a shape, inside or out. */
export function edgeDistanceM(at: LatLng, geometry: Polygon | MultiPolygon): number {
  const { kx, ky } = frame(at.lat);
  const p: Position = [at.lng, at.lat];
  let best = Infinity;
  for (const rings of polygonsOf(geometry)) {
    for (const ring of rings) {
      for (let i = 1; i < ring.length; i++) best = Math.min(best, toSegmentM(p, ring[i - 1]!, ring[i]!, kx, ky));
    }
  }
  return best;
}

/** The shortest distance in metres between two shapes' edges (0 when they overlap or touch). */
export function gapBetweenM(a: Polygon | MultiPolygon, b: Polygon | MultiPolygon): number {
  const ringsA = polygonsOf(a).flat();
  const ringsB = polygonsOf(b).flat();
  const lat = ringsA[0]?.[0]?.[1] ?? 35;
  const { kx, ky } = frame(lat);
  let best = Infinity;
  for (const [from, to] of [
    [ringsA, ringsB],
    [ringsB, ringsA],
  ] as const) {
    for (const ring of from) {
      for (const p of ring) {
        for (const other of to) {
          for (let i = 1; i < other.length; i++) best = Math.min(best, toSegmentM(p, other[i - 1]!, other[i]!, kx, ky));
        }
      }
    }
  }
  return best;
}

/** Signed area in square metres: positive counter-clockwise (the GeoJSON outline direction). */
export function ringAreaM2(ring: Position[]): number {
  const { kx, ky } = frame(ring[0]?.[1] ?? 35);
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j]![0]! * kx * (ring[i]![1]! * ky) - ring[i]![0]! * kx * (ring[j]![1]! * ky);
  }
  return sum / 2;
}

/** The area-weighted centre of a polygon's outline. */
export function ringCentroid(ring: Position[]): LatLng {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    const f = xj * yi - xi * yj;
    a += f;
    x += (xj + xi) * f;
    y += (yj + yi) * f;
  }
  if (a === 0) return { lng: ring[0]![0]!, lat: ring[0]![1]! };
  return { lng: x / (3 * a), lat: y / (3 * a) };
}

/**
 * Douglas–Peucker on a closed ring, in metres: drops vertices that move the
 * outline by less than `toleranceM`. A ring that would fall below a
 * triangle comes back unchanged.
 */
export function simplifyRing(ring: Position[], toleranceM: number): Position[] {
  if (ring.length <= 5) return ring;
  const { kx, ky } = frame(ring[0]![1]!);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  // Split the closed ring at its farthest vertex from the start, so both halves have distinct ends.
  let far = 1;
  for (let i = 1; i < ring.length - 1; i++) {
    if (distanceM(lngLat(ring[0]!), lngLat(ring[i]!)) > distanceM(lngLat(ring[0]!), lngLat(ring[far]!))) far = i;
  }
  keep[far] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, ring.length - 1],
  ];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let max = toleranceM;
    for (let i = first + 1; i < last; i++) {
      const d = toSegmentM(ring[i]!, ring[first]!, ring[last]!, kx, ky);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = ring.filter((_, i) => keep[i] === 1);
  return out.length >= 4 ? out : ring;
}

function lngLat(p: Position): LatLng {
  return { lng: p[0]!, lat: p[1]! };
}

/** [west, south, east, north] around every shape, or only those of the `only` chips; undefined when there are none. */
export function shapesBounds(shapes: AreaShapes, only?: ReadonlySet<string>): [number, number, number, number] | undefined {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const f of shapes.features) {
    if (only && !only.has(f.properties.chip)) continue;
    for (const [outline] of polygonsOf(f.geometry)) {
      for (const [lng, lat] of outline ?? []) {
        w = Math.min(w, lng!);
        e = Math.max(e, lng!);
        s = Math.min(s, lat!);
        n = Math.max(n, lat!);
      }
    }
  }
  return w <= e ? [w, s, e, n] : undefined;
}

/**
 * The chip a tap lands on: the shape it is inside, else the nearest shape
 * within `slackM`, since an area at city zoom is only 15 to 40 px across.
 */
export function nearestChip(shapes: AreaShapes, at: LatLng, slackM: number): string | undefined {
  const inside = chipAt(shapes, at);
  if (inside !== undefined) return inside;
  let best: { chip: string; m: number } | undefined;
  for (const f of shapes.features) {
    const m = edgeDistanceM(at, f.geometry);
    if (m <= slackM && (!best || m < best.m)) best = { chip: f.properties.chip, m };
  }
  return best?.chip;
}

/**
 * Where a shape's name goes: inside its largest part, as far from the edges
 * as a 16 × 16 search of its box finds. An area-weighted centre can fall
 * outside a curved shape, and MapLibre would label every map tile's piece
 * of a polygon separately, so the map gets one point per area instead.
 */
export function labelPoint(geometry: Polygon | MultiPolygon): LatLng {
  const largest = polygonsOf(geometry).reduce((a, b) => (Math.abs(ringAreaM2(b[0] ?? [])) > Math.abs(ringAreaM2(a[0] ?? [])) ? b : a));
  const part: Polygon = { type: "Polygon", coordinates: largest };
  const outline = largest[0] ?? [];
  let best = ringCentroid(outline);
  let bestM = pointInShape(best, part) ? edgeDistanceM(best, part) : -1;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lng, lat] of outline) {
    w = Math.min(w, lng!);
    e = Math.max(e, lng!);
    s = Math.min(s, lat!);
    n = Math.max(n, lat!);
  }
  const STEPS = 16;
  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < STEPS; j++) {
      const at = { lng: w + ((i + 0.5) / STEPS) * (e - w), lat: s + ((j + 0.5) / STEPS) * (n - s) };
      if (!pointInShape(at, part)) continue;
      const m = edgeDistanceM(at, part);
      if (m > bestM) {
        best = at;
        bestM = m;
      }
    }
  }
  return best;
}

const loading = new Map<string, Promise<AreaShapes | undefined>>();

/**
 * A region's shapes from the site (public/areas/<region>.geojson, precached
 * by the service worker), fetched once per region. Undefined when the file
 * is missing or broken: Here then falls back to the nearest centre.
 */
export function loadAreaShapes(region: string): Promise<AreaShapes | undefined> {
  let p = loading.get(region);
  if (!p) {
    p = fetch(`/areas/${region}.geojson`)
      .then((res) => (res.ok ? (res.json() as Promise<AreaShapes>) : undefined))
      .catch(() => undefined);
    loading.set(region, p);
  }
  return p;
}
