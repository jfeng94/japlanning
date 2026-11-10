import { describe, expect, it } from "vitest";
import { undrawable } from "./label-glyphs.ts";

describe("undrawable", () => {
  it("passes Latin with accents and Japanese, and names what would draw as nothing", () => {
    expect(undrawable("Pâtisserie Année, koé donuts")).toEqual([]);
    expect(undrawable("八代目儀兵衛 カフェ ｶﾌｪ")).toEqual([]);
    expect(undrawable("Apollon’s Gold – café")).toEqual(["’", "–"]);
  });
});
