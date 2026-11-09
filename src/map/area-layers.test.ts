import { describe, expect, it } from "vitest";
import { HATCH_TILE, hatchTile } from "./area-layers.ts";

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
