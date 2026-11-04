import { describe, expect, it } from "vitest";
import { coverageToSdf, imageDataToCoverage, SDF_CUTOFF, SDF_RADIUS } from "./sdf.ts";

/** A 32×32 field with a filled square from 8..24. */
function square(): { coverage: Float32Array; w: number; h: number } {
  const w = 32;
  const h = 32;
  const coverage = new Float32Array(w * h);
  for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) coverage[y * w + x] = 1;
  return { coverage, w, h };
}

const alphaAt = (sdf: Uint8ClampedArray, w: number, x: number, y: number) => sdf[(y * w + x) * 4 + 3]!;
const EDGE = Math.round(255 * (1 - SDF_CUTOFF)); // 191: where MapLibre draws the edge

describe("coverageToSdf", () => {
  const { coverage, w, h } = square();
  const sdf = coverageToSdf(coverage, w, h);

  it("is above the edge value inside and below it outside", () => {
    expect(alphaAt(sdf, w, 16, 16)).toBeGreaterThan(EDGE);
    expect(alphaAt(sdf, w, 2, 2)).toBeLessThan(EDGE);
    expect(alphaAt(sdf, w, 30, 16)).toBeLessThan(EDGE);
  });

  it("falls off by one step per pixel of distance, radius wide", () => {
    // Just outside the right edge at x=24, 25, 26: distance 1, 2, 3.
    const step = 255 / SDF_RADIUS;
    const a24 = alphaAt(sdf, w, 24, 16);
    const a25 = alphaAt(sdf, w, 25, 16);
    const a26 = alphaAt(sdf, w, 26, 16);
    // Values are integers, so a 31.875 step shows up as 31 or 32.
    expect(Math.abs(a24 - a25 - step)).toBeLessThanOrEqual(1);
    expect(Math.abs(a25 - a26 - step)).toBeLessThanOrEqual(1);
    // Beyond the radius the field is clamped to zero (x=31 is 7 px out; 255 − 255·(7/8 + 0.25) < 0).
    expect(alphaAt(sdf, w, 31, 16)).toBe(0);
  });

  it("writes the same value to all four channels", () => {
    const i = (16 * w + 16) * 4;
    expect([sdf[i], sdf[i + 1], sdf[i + 2]]).toEqual([sdf[i + 3], sdf[i + 3], sdf[i + 3]]);
  });

  it("distance is measured diagonally too, not just along axes", () => {
    // Corner (24,24) is √2 from (23,23) and farther than (24,16) is from the edge.
    expect(alphaAt(sdf, w, 26, 26)).toBeLessThan(alphaAt(sdf, w, 26, 16));
  });
});

describe("imageDataToCoverage", () => {
  const px = (r: number, g: number, b: number, a: number) => [r, g, b, a];
  const img = (pixels: number[][]) =>
    ({ width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) }) as unknown as ImageData;

  it("black-on-transparent uses alpha; black-on-white uses darkness", () => {
    const c = imageDataToCoverage(img([px(0, 0, 0, 255), px(0, 0, 0, 0), px(255, 255, 255, 255), px(0, 0, 0, 128)]));
    expect(c[0]).toBeCloseTo(1, 5);
    expect(c[1]).toBeCloseTo(0, 5);
    expect(c[2]).toBeCloseTo(0, 5);
    expect(c[3]).toBeCloseTo(128 / 255, 5);
  });
});
