import { describe, expect, it } from "vitest";
import type { AreaColour } from "../config/area-colors.ts";
import type { AreaShapes } from "../data/area-shapes.ts";
import type { AreaLook } from "../filter/apply.ts";
import { HATCH_TILE, areaPolygons, hatchTile } from "./area-layers.ts";

describe("areaPolygons", () => {
  const square = (x: number) => ({ type: "Polygon" as const, coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] });
  const shapes: AreaShapes = {
    type: "FeatureCollection",
    features: ["Ginza", "Tsukiji", "Ueno"].map((chip, i) => ({ type: "Feature", geometry: square(i), properties: { chip, members: [chip] } })),
  };
  const colour: AreaColour = { fill: "#ff0000", on: "#ffffff", hatch: "#ff000080", line: { light: "#990000", dark: "#ff9999" } };
  const looks = new Map<string, AreaLook>([["Ginza", "picked"], ["Tsukiji", "added"], ["Ueno", "out"]]);
  const drawing = { shapes, looks, colours: new Map([["Ginza", colour], ["Tsukiji", colour], ["Ueno", colour]]) };
  const props = (selectedOnly: boolean) => areaPolygons({ ...drawing, selectedOnly }, "light").features.map((f) => f.properties!);

  it("on the Area page draws every area in its look, at full strength", () => {
    expect(props(false).map((p) => [p["chip"], p["look"], p["fillOpacity"], p["hatchOpacity"]])).toEqual([
      ["Ginza", "picked", 0.4, 1],
      ["Tsukiji", "added", 0.4, 1],
      ["Ueno", "out", 0.4, 1],
    ]);
  });

  it("elsewhere draws only the picked and added areas, lighter, so the streets read through", () => {
    expect(props(true).map((p) => [p["chip"], p["look"], p["fillOpacity"], p["hatchOpacity"]])).toEqual([
      ["Ginza", "picked", 0.18, 0.5],
      ["Tsukiji", "added", 0.18, 0.5],
    ]);
    expect(props(true)[0]!["line"]).toBe("#990000");
  });

  it("draws nothing without a drawing", () => {
    expect(areaPolygons(undefined, "dark").features).toEqual([]);
  });
});

describe("hatchTile", () => {
  const n = HATCH_TILE;
  const tile = hatchTile([1, 0.5, 0]);
  const alpha = (x: number, y: number) => tile[(((y + n) % n) * n + ((x + n) % n)) * 4 + 3]!;

  it("is one RGBA tile in the area's colour", () => {
    expect(tile.length).toBe(n * n * 4);
    expect([tile[0], tile[1], tile[2]]).toEqual([255, 128, 0]);
  });

  it("draws diagonal stripes, rising left to right, over a faint wash", () => {
    // Along a stripe (one right, one up) the coverage doesn't change; across it, it does.
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) expect(alpha(x + 1, y - 1)).toBe(alpha(x, y));
    const values = new Set(Array.from({ length: n }, (_, x) => alpha(x, 0)));
    expect(Math.max(...values)).toBeGreaterThan(180);
    expect(Math.min(...values)).toBe(Math.round(0.1 * 255));
  });

  it("repeats without a seam", () => {
    // The pixel past each edge (wrapping) continues the stripe, as the tile's own interior does.
    for (let y = 0; y < n; y++) expect(alpha(n - 1, y)).toBe(alpha(0, y - 1));
  });
});
