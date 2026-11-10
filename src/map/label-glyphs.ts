import { BASEMAP } from "../config/basemap.ts";

/**
 * What the map can draw in a label. Latin text comes from the Noto Sans
 * glyph files the app ships (BASEMAP.assets.ranges, U+0000 to U+03FF),
 * and Japanese from the device's own font (MapLibre's
 * localIdeographFontFamily, for kana, CJK ideographs, Hangul and
 * full-width forms). Anything else, a curly apostrophe say, would draw as
 * nothing, since the glyph file it needs isn't there offline.
 */
const SHIPPED = BASEMAP.assets.ranges.map((r) => r.split("-").map(Number) as [number, number]);
/** A subset of MapLibre's codePointUsesLocalIdeographFontFamily: the blocks a place name would use. */
const DEVICE_FONT = /[ᄀ-ᇿ⺀-⿟　-ヿㄅ-ㄯㄱ-ㆎㆠ-䶿一-ꒌ가-ퟻ豈-龎︰-﹏＀-￯]/u;

/** The characters in `text` a map label can't draw, each once. */
export function undrawable(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (SHIPPED.some(([lo, hi]) => cp >= lo && cp <= hi) || DEVICE_FONT.test(ch)) continue;
    out.add(ch);
  }
  return [...out];
}
