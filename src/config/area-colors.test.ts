import { describe, expect, it } from "vitest";
import { areaIndex } from "../data/areas.ts";
import { contrast, deltaE, HUES, hexOf, regionColours, rgbFromHex, shadesOf } from "./area-colors.ts";
import { areasOf, regionById, regions } from "./regions.ts";

/** The light map's land and the dark map's (Protomaps' "earth"), which outlines and labels sit on. */
const EARTH = { light: "#e2dfda", dark: "#1f1f1f" } as const;

describe("colour math", () => {
  it("converts OKLCH to hex", () => {
    expect(hexOf([1, 0, 0])).toBe("#ffffff");
    expect(hexOf([0, 0, 0])).toBe("#000000");
    // sRGB red, as OKLCH.
    expect(hexOf([0.62796, 0.25768, 29.2339])).toBe("#ff0000");
  });

  it("measures contrast the WCAG way", () => {
    expect(contrast(rgbFromHex("#000000"), rgbFromHex("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrast(rgbFromHex("#777777"), rgbFromHex("#777777"))).toBe(1);
  });

  it("keeps every shade on screen", () => {
    for (const hue of HUES) for (const lch of shadesOf(hue)) expect(hexOf(lch)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("Tokyo: a hue per section, a shade per chip", () => {
  const index = areasOf("tokyo");
  const colours = regionColours(index);
  const region = regionById("tokyo");

  it("colours every chip, a section's chips as differently as its seven shades allow", () => {
    expect(colours.chips.size).toBe(index.chips.length);
    for (const s of index.sections) {
      const fills = new Set(s.chips.map((c) => colours.chips.get(c.label)!.fill));
      expect(fills.size, s.label).toBe(Math.min(s.chips.length, 7));
    }
  });

  it("gives each chip a shade of its section's hue", () => {
    for (const s of index.sections) {
      const hue = region.areaSections!.find((x) => x.label === s.label)!.hue!;
      const shades = new Set(shadesOf(hue).map(hexOf));
      for (const c of s.chips) expect(shades.has(colours.chips.get(c.label)!.fill), `${c.label} in ${s.label}`).toBe(true);
      expect(colours.sections.get(s.label!)!.fill).toBe(hexOf(shadesOf(hue)[0]!));
    }
  });

  it("makes neighbours in one section visibly different", () => {
    for (const s of index.sections) {
      const hue = s.hue!;
      const lchOf = new Map(shadesOf(hue).map((lch) => [hexOf(lch), lch]));
      const inSection = new Set(s.chips.map((c) => c.label));
      for (const c of s.chips) {
        for (const n of index.neighbours([c.label])) {
          if (!inSection.has(n)) continue;
          const d = deltaE(lchOf.get(colours.chips.get(c.label)!.fill)!, lchOf.get(colours.chips.get(n)!.fill)!);
          expect(d, `${c.label} – ${n}`).toBeGreaterThan(0.08);
        }
      }
    }
  });

  it("is the same every time", () => {
    expect([...regionColours(areasOf("tokyo")).chips]).toEqual([...colours.chips]);
  });
});

describe("Nara: no sections, a rainbow hue per chip", () => {
  const index = areasOf("nara");
  const colours = regionColours(index);

  it("takes the rainbow in the chips' order", () => {
    expect(index.chips.length).toBeGreaterThan(1);
    expect(index.chips.map((c) => colours.chips.get(c.label)!.fill)).toEqual(HUES.slice(0, index.chips.length).map((h) => hexOf(shadesOf(h)[0]!)));
    expect(colours.sections.size).toBe(0);
  });
});

describe("readability, every region", () => {
  const all = regions.flatMap((r) => [...regionColours(areasOf(r.id)).chips]);

  it("puts readable text on a filled chip", () => {
    for (const [label, c] of all) expect(contrast(rgbFromHex(c.fill), rgbFromHex(c.on)), label).toBeGreaterThanOrEqual(4.5);
  });

  it("draws outlines darker than the fill on the light map and lighter on the dark", () => {
    const lum = (hex: string) => contrast(rgbFromHex(hex), rgbFromHex("#000000"));
    for (const [label, c] of all) {
      expect(lum(c.line.light), label).toBeLessThan(lum(c.fill));
      expect(lum(c.line.dark), label).toBeGreaterThan(lum(c.fill));
    }
  });

  it("keeps outlines and labels visible on the land", () => {
    for (const [label, c] of all) {
      expect(contrast(rgbFromHex(c.line.light), rgbFromHex(EARTH.light)), `${label} light`).toBeGreaterThanOrEqual(3);
      expect(contrast(rgbFromHex(c.line.dark), rgbFromHex(EARTH.dark)), `${label} dark`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("sections without a hue", () => {
  it("take the hues no section names, in rainbow order", () => {
    const index = areaIndex({
      areas: [
        { label: "A", ward: "一区", adjacent: [] },
        { label: "B", ward: "二区", adjacent: [] },
        { label: "C", ward: "三区", adjacent: [] },
      ],
      areaSections: [
        { label: "One", wards: ["一区"], hue: "red" },
        { label: "Two", wards: ["二区"] },
        { label: "Three", wards: ["三区"] },
      ],
    });
    const colours = regionColours(index);
    expect(colours.sections.get("Two")!.fill).toBe(hexOf(shadesOf("orange")[0]!));
    expect(colours.sections.get("Three")!.fill).toBe(hexOf(shadesOf("yellow")[0]!));
  });
});
