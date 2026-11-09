import type { AreaChip, AreaIndex } from "../data/areas.ts";
import type { AreaHue } from "../data/types.ts";
import type { Flavor } from "../map/style.ts";

/**
 * The areas' colours (docs/proposals/filter-pages-and-area-map.md, Part 3).
 * Each section of the Area page has a hue, and each chip in it a shade of
 * that hue, so a chip and its shape on the map read as one thing. A region
 * without sections gives each chip a hue of its own, in rainbow order.
 *
 * Colours are worked out in OKLCH, a colour space built so that equal steps
 * look equal: L is lightness (0 black to 1 white), C is chroma (0 is grey;
 * about 0.25 is as vivid as a screen gets), h is the hue angle in degrees.
 * "The same orange, a bit lighter" is then a change to one number, and how
 * different two shades look is a distance (ΔE in OKLab, OKLCH's Cartesian
 * twin). Browsers can read OKLCH, but MapLibre can't, so everything leaves
 * here as hex.
 */

export const HUES: readonly AreaHue[] = ["red", "orange", "yellow", "green", "blue", "indigo", "violet", "magenta"];

type Lch = readonly [l: number, c: number, h: number];

/** Each hue's own shade. Yellow only reads as yellow when light; blue the other way round. */
const BASE: Record<AreaHue, Lch> = {
  red: [0.6, 0.19, 27],
  orange: [0.72, 0.16, 55],
  yellow: [0.85, 0.16, 96],
  green: [0.66, 0.16, 145],
  blue: [0.6, 0.14, 250],
  indigo: [0.52, 0.15, 282],
  violet: [0.6, 0.17, 312],
  magenta: [0.63, 0.21, 345],
};

/**
 * The shades a section's chips take: a step in lightness, a factor on
 * chroma, and a small turn of the hue. The first is the hue itself; the
 * rest step away from it in different directions, since the seven Shibuya
 * chips all touch.
 */
const SHADES: readonly Lch[] = [
  [0, 1, 0],
  [-0.14, 0.95, -6],
  [0.1, 0.75, 8],
  [-0.05, 0.55, 14],
  [0.05, 1.1, -14],
  [-0.2, 0.8, 4],
  [0.14, 0.55, -4],
];

/** Lightness stays in this band, so no shade washes out to white or sinks to black. */
const MIN_L = 0.36;
const MAX_L = 0.93;

/**
 * Outlines and labels: a step darker than the fill on the light map, at
 * most 0.52 lightness, and a step lighter on the dark map, at least 0.74,
 * so even a pale yellow or a deep red stands off the land (3:1 or better).
 */
const LINE: Record<Flavor, (l: number) => number> = {
  light: (l) => Math.min(l - 0.2, 0.52),
  dark: (l) => Math.max(l + 0.12, 0.74),
};

/** WCAG's contrast for body text, which a picked chip's label must meet on its fill. */
const TEXT_CONTRAST = 4.5;

export interface AreaColour {
  /** The area's colour: its shape's fill on the map (see-through there), and its chip's when picked. */
  fill: string;
  /** Text on a chip filled with it: near-black or white, whichever reads better. */
  on: string;
  /** The stripes of an added area's chip: the fill, partly see-through. */
  hatch: string;
  /** Outlines and labels, per map flavour: darker than the fill on the light map, lighter on the dark. */
  line: Record<Flavor, string>;
}

export interface RegionColours {
  /** By chip label. */
  chips: ReadonlyMap<string, AreaColour>;
  /** By section heading: the section's own hue, for the swatch beside it. */
  sections: ReadonlyMap<string, AreaColour>;
}

/** Every chip's colour and every section's, from the region's area index. Pure and deterministic. */
export function regionColours(index: Pick<AreaIndex, "sections" | "neighbours">): RegionColours {
  const chips = new Map<string, AreaColour>();
  const sections = new Map<string, AreaColour>();
  const named = new Set(index.sections.map((s) => s.hue).filter((h): h is AreaHue => h !== undefined));
  const spare = HUES.filter((h) => !named.has(h));
  let nextSpare = 0;
  for (const s of index.sections) {
    if (s.label === undefined) {
      // One flat list: each chip a hue of its own.
      s.chips.forEach((c, i) => chips.set(c.label, paint(shadesOf(HUES[i % HUES.length]!)[0]!)));
      continue;
    }
    const hue = s.hue ?? spare[nextSpare++ % spare.length] ?? "red";
    sections.set(s.label, paint(shadesOf(hue)[0]!));
    for (const [label, lch] of shadeSection(hue, s.chips, index)) chips.set(label, paint(lch));
  }
  return { chips, sections };
}

/**
 * A shade of the section's hue for each chip. Busiest chips first; each
 * takes an unused shade, the one most different from its neighbours'
 * (on the area graph) chosen so far. Shades repeat only when a section has
 * more chips than there are shades.
 */
function shadeSection(hue: AreaHue, chips: readonly AreaChip[], index: Pick<AreaIndex, "neighbours">): Map<string, Lch> {
  const options = shadesOf(hue);
  const inSection = new Set(chips.map((c) => c.label));
  const near = new Map(chips.map((c) => [c.label, [...index.neighbours([c.label])].filter((n) => inSection.has(n))]));
  const order = [...chips].sort((a, b) => near.get(b.label)!.length - near.get(a.label)!.length || a.label.localeCompare(b.label));
  const picked = new Map<string, number>();
  for (const c of order) {
    const used = new Set(picked.values());
    const free = options.map((_, i) => i).filter((i) => !used.has(i));
    const pool = free.length > 0 ? free : options.map((_, i) => i);
    const taken = near.get(c.label)!.filter((n) => picked.has(n)).map((n) => options[picked.get(n)!]!);
    let best = pool[0]!;
    let bestScore = -1;
    for (const i of pool) {
      const score = taken.length === 0 ? 0 : Math.min(...taken.map((t) => deltaE(options[i]!, t)));
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    picked.set(c.label, best);
  }
  return new Map(chips.map((c) => [c.label, options[picked.get(c.label)!]!]));
}

/** A hue's shades, in OKLCH, the hue's own first. */
export function shadesOf(hue: AreaHue): Lch[] {
  const base = BASE[hue];
  return SHADES.map(([dl, kc, dh]) => readable(inGamut([clamp(base[0] + dl, MIN_L, MAX_L), base[1] * kc, (base[2] + dh + 360) % 360])));
}

/**
 * Mid-lightness colours (about 0.56 to 0.64) are too light for white text
 * and too dark for black. Such a shade moves, a hundredth at a time,
 * toward whichever text reads better until its label passes.
 */
function readable(lch: Lch): Lch {
  const [, c, h] = lch;
  const texts = (l: number): [black: number, white: number] => {
    const rgb = rgbOf(inGamut([l, c, h]));
    return [contrast(rgb, NEAR_BLACK), contrast(rgb, WHITE)];
  };
  const [black, white] = texts(lch[0]);
  if (Math.max(black, white) >= TEXT_CONTRAST) return lch;
  const step = white >= black ? -0.01 : 0.01;
  let l = lch[0];
  while (l > MIN_L && l < MAX_L) {
    l += step;
    const [b, w] = texts(l);
    if ((step < 0 ? w : b) >= TEXT_CONTRAST) break;
  }
  return inGamut([l, c, h]);
}

function paint(lch: Lch): AreaColour {
  const fill = hexOf(lch);
  const rgb = rgbOf(lch);
  const on = contrast(rgb, NEAR_BLACK) >= contrast(rgb, WHITE) ? "#1f1a17" : "#ffffff";
  const line = (flavor: Flavor): string => hexOf(inGamut([clamp(LINE[flavor](lch[0]), 0.25, 0.96), lch[1], lch[2]]));
  return {
    fill,
    on,
    // Light enough that the chip's text stays readable over the stripes, even for the deepest shades.
    hatch: `rgba(${rgb.map((v) => Math.round(v * 255)).join(", ")}, 0.42)`,
    line: { light: line("light"), dark: line("dark") },
  };
}

// ---- colour math (exported for the tests) ----

type Rgb = readonly [number, number, number];

const NEAR_BLACK: Rgb = [0x1f / 255, 0x1a / 255, 0x17 / 255];
const WHITE: Rgb = [1, 1, 1];

/** OKLCH to OKLab: polar to Cartesian. */
function lab([l, c, h]: Lch): Lch {
  const r = (h * Math.PI) / 180;
  return [l, c * Math.cos(r), c * Math.sin(r)];
}

/** OKLab to linear-light sRGB (Björn Ottosson's matrices); channels may fall outside 0–1 for colours a screen can't show. */
function linearRgb(lch: Lch): Rgb {
  const [L, a, b] = lab(lch);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const fits = (rgb: Rgb): boolean => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** The same lightness and hue with the chroma lowered, if need be, until a screen can show it. */
export function inGamut(lch: Lch): Lch {
  if (fits(linearRgb(lch))) return lch;
  let lo = 0;
  let hi = lch[1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(linearRgb([lch[0], mid, lch[2]]))) lo = mid;
    else hi = mid;
  }
  return [lch[0], lo, lch[2]];
}

/** Gamma-encoded sRGB, 0–1 per channel, as screens and CSS use it. */
export function rgbOf(lch: Lch): Rgb {
  const enc = (v: number): number => {
    const c = clamp(v, 0, 1);
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  const [r, g, b] = linearRgb(lch);
  return [enc(r), enc(g), enc(b)];
}

export function hexOf(lch: Lch): string {
  return `#${rgbOf(lch)
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** WCAG relative luminance of a gamma-encoded colour. */
function luminance(rgb: Rgb): number {
  const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** WCAG contrast ratio, 1 (none) to 21 (black on white). Body text wants 4.5. */
export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** How different two colours look: distance in OKLab. About 0.02 is just noticeable side by side. */
export function deltaE(p: Lch, q: Lch): number {
  const [l1, a1, b1] = lab(p);
  const [l2, a2, b2] = lab(q);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** "#rrggbb" to gamma-encoded channels, 0–1. */
export function rgbFromHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
