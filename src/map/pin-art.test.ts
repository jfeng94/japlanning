import { describe, expect, it } from "vitest";
import { BADGE_PX, PIN_PX, pinArtLayout, pinPixelRatio } from "./pin-art.ts";

const inside = (b: { x: number; y: number; w: number; h: number }, size: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= size && b.y + b.h <= size;

describe("pinArtLayout", () => {
  it("draws a 30 px pin at 3x as 90 px of art, centred, in a 120 px image", () => {
    const l = pinArtLayout(3);
    expect(l.size).toBe(120);
    expect(l.art).toEqual({ x: 15, y: 15, w: PIN_PX * 3, h: PIN_PX * 3 });
    // Centred, so the image's centre (MapLibre's anchor) is the place.
    expect(l.art.x + l.art.w / 2).toBe(l.size / 2);
    expect(l.art.y + l.art.h / 2).toBe(l.size / 2);
  });

  it("puts the badge over the upper-right corner, as on the DOM pins, and inside the image", () => {
    for (const pr of [1, 2, 3]) {
      const l = pinArtLayout(pr);
      expect(l.badge.w).toBe(BADGE_PX * pr);
      expect(l.badge.x + l.badge.w).toBeGreaterThan(l.art.x + l.art.w); // over the corner
      expect(l.badge.y).toBeLessThan(l.art.y);
      expect(inside(l.badge, l.size)).toBe(true);
    }
  });

  it("leaves room below the art for the shadow (offset plus three sigma)", () => {
    for (const pr of [1, 2, 3]) {
      const l = pinArtLayout(pr);
      const reach = l.shadow.dy + 1.5 * l.shadow.blur;
      expect(l.art.y + l.art.h + reach).toBeLessThanOrEqual(l.size);
    }
  });

  it("fits art that isn't square like object-fit: contain, still centred", () => {
    const wide = pinArtLayout(2, 2);
    expect(wide.art.w).toBe(60);
    expect(wide.art.h).toBe(30);
    expect(wide.art.y + wide.art.h / 2).toBe(wide.size / 2);
    const tall = pinArtLayout(2, 0.5);
    expect(tall.art.w).toBe(30);
    expect(tall.art.h).toBe(60);
    // An SVG without an intrinsic size reports 0 x 0: drawn square.
    expect(pinArtLayout(2, Number.NaN).art.w).toBe(60);
  });
});

describe("pinPixelRatio", () => {
  it("rounds the device's ratio and keeps it between 1 and 3", () => {
    expect(pinPixelRatio(1)).toBe(1);
    expect(pinPixelRatio(1.5)).toBe(2);
    expect(pinPixelRatio(3)).toBe(3);
    expect(pinPixelRatio(4)).toBe(3);
    expect(pinPixelRatio(0)).toBe(1);
  });
});
