import { describe, expect, it } from "vitest";
import drinksCsv from "../../data/drinks.csv?raw";
import kyotoShapesText from "../../public/areas/kyoto.geojson?raw";
import tokyoShapesText from "../../public/areas/tokyo.geojson?raw";
import { layers } from "../config/layers.ts";
import { areasOf, regionById, regionOptions } from "../config/regions.ts";
import {
  chipAt,
  distanceToShapeM,
  edgeDistanceM,
  gapBetweenM,
  pointInRing,
  pointInShape,
  polygonsOf,
  ringAreaM2,
  ringCentroid,
  simplifyRing,
  type AreaShapes,
} from "./area-shapes.ts";
import { areaAt } from "./areas.ts";
import { parseLayerCsv } from "./parse.ts";
import type { Polygon } from "geojson";
import type { RegionId } from "./types.ts";

/** A 0.01° square (about 900 m × 1.1 km) near Shibuya, counter-clockwise, with a hole in the middle. */
const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [139.7, 35.65],
      [139.71, 35.65],
      [139.71, 35.66],
      [139.7, 35.66],
      [139.7, 35.65],
    ],
    [
      [139.704, 35.654],
      [139.704, 35.656],
      [139.706, 35.656],
      [139.706, 35.654],
      [139.704, 35.654],
    ],
  ],
};

describe("the shape helpers", () => {
  it("tell inside from outside, holes included", () => {
    expect(pointInRing(139.702, 35.652, square.coordinates[0]!)).toBe(true);
    expect(pointInShape({ lng: 139.702, lat: 35.652 }, square)).toBe(true);
    expect(pointInShape({ lng: 139.705, lat: 35.655 }, square)).toBe(false); // in the hole
    expect(pointInShape({ lng: 139.72, lat: 35.655 }, square)).toBe(false);
  });

  it("measure distances to a shape's edge in metres", () => {
    expect(distanceToShapeM({ lng: 139.702, lat: 35.652 }, square)).toBe(0);
    // 0.001° of longitude east of the edge at 35.655° is about 91 m.
    expect(distanceToShapeM({ lng: 139.711, lat: 35.655 }, square)).toBeCloseTo(90.6, 0);
    expect(edgeDistanceM({ lng: 139.7005, lat: 35.655 }, square)).toBeCloseTo(45.3, 0);
    const east: Polygon = { type: "Polygon", coordinates: [square.coordinates[0]!.map(([x, y]) => [x! + 0.0102, y!])] };
    expect(gapBetweenM(square, east)).toBeCloseTo(18.1, 0);
  });

  it("give areas a sign (counter-clockwise positive) and centres", () => {
    const outline = square.coordinates[0]!;
    expect(ringAreaM2(outline)).toBeGreaterThan(0);
    expect(ringAreaM2([...outline].reverse())).toBeLessThan(0);
    expect(ringAreaM2(outline) / 1e6).toBeCloseTo(1.0, 1);
    const c = ringCentroid(outline);
    expect([c.lng, c.lat].map((n) => n.toFixed(3))).toEqual(["139.705", "35.655"]);
  });

  it("simplify drops vertices that barely bend the outline and keeps the corners", () => {
    const wobbly = [
      [139.7, 35.65],
      [139.705, 35.65001],
      [139.71, 35.65],
      [139.71, 35.66],
      [139.705, 35.65999],
      [139.7, 35.66],
      [139.7, 35.65],
    ];
    expect(simplifyRing(wobbly, 8)).toEqual([
      [139.7, 35.65],
      [139.71, 35.65],
      [139.71, 35.66],
      [139.7, 35.66],
      [139.7, 35.65],
    ]);
    expect(simplifyRing(wobbly, 0.5)).toHaveLength(7);
  });
});

const drinks = layers.find((l) => l.id === "drinks")!;
const { places } = parseLayerCsv(drinksCsv, drinks, regionOptions());
const generated: Partial<Record<RegionId, AreaShapes>> = {
  tokyo: JSON.parse(tokyoShapesText) as AreaShapes,
  kyoto: JSON.parse(kyotoShapesText) as AreaShapes,
};

/**
 * Pairs whose shapes touch but that the config doesn't list as neighbours,
 * waiting for Jerry's call (docs/proposals/filter-pages-and-area-map.md).
 * A new pair failing the test means the shapes and the graph disagree.
 */
const AWAITING_DECISION = new Set(["Aoyama – Harajuku", "Hatagaya – Tomigaya", "Shibuya – Yoyogi"]);

describe.each(Object.entries(generated) as [RegionId, AreaShapes][])("%s's generated shapes (public/areas)", (region, shapes) => {
  const index = areasOf(region);
  const byChip = new Map(shapes.features.map((f) => [f.properties.chip, f]));

  it("have one shape per chip, built from the chip's current members (else rerun npm run areas)", () => {
    expect([...byChip.keys()].sort()).toEqual(index.chips.map((c) => c.label).sort());
    for (const chip of index.chips) expect(byChip.get(chip.label)!.properties.members, chip.label).toEqual(chip.members);
  });

  it("hold every place, or come within 100 m of it", () => {
    const far = places
      .filter((p) => p.region === region)
      .map((p) => ({ name: `${p.name} ${p.branch ?? ""}`.trim(), chip: p.areaGroup!, m: distanceToShapeM(p, byChip.get(p.areaGroup!)!.geometry) }))
      .filter((x) => x.m > 100);
    expect(far).toEqual([]);
  });

  it("don't overlap each other (beyond what simplifying leaves)", () => {
    const overlaps: string[] = [];
    for (const a of shapes.features) {
      for (const b of shapes.features) {
        if (a === b) continue;
        for (const [lng, lat] of polygonsOf(a.geometry).flat(2)) {
          const at = { lng: lng!, lat: lat! };
          if (pointInShape(at, b.geometry) && edgeDistanceM(at, b.geometry) > 20) overlaps.push(`${a.properties.chip} inside ${b.properties.chip}`);
        }
      }
    }
    expect([...new Set(overlaps)]).toEqual([]);
  });

  it("touch only chips the config lists as neighbours", () => {
    const unlisted: string[] = [];
    const chips = shapes.features;
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i]!, b = chips[j]!;
        const pair = [a.properties.chip, b.properties.chip].sort().join(" – ");
        if (gapBetweenM(a.geometry, b.geometry) <= 30 && !index.neighbours([a.properties.chip]).has(b.properties.chip) && !AWAITING_DECISION.has(pair)) {
          unlisted.push(pair);
        }
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("are what Here goes by: a place's own spot resolves to its chip", () => {
    const region_ = regionById(region);
    const wrong = places
      .filter((p) => p.region === region && pointInShape(p, byChip.get(p.areaGroup!)!.geometry))
      .filter((p) => areaAt(index, places, p, { ...(region_.bbox ? { bbox: region_.bbox } : {}), shapes }) !== p.areaGroup);
    expect(wrong.map((p) => p.name)).toEqual([]);
    expect(chipAt(shapes, { lat: 0, lng: 0 })).toBeUndefined();
  });
});
