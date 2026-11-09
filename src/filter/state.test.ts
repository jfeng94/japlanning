import { describe, expect, it } from "vitest";
import {
  categoriesOf,
  defaultState,
  hasActiveFilters,
  hasGroupSelection,
  layersInPlay,
  layersInRegion,
  reduce,
  type FilterAction,
  type FilterState,
} from "./state.ts";
import { allLayers, coffee, kyotoFood, lodging } from "./testing.ts";

const run = (...actions: FilterAction[]): FilterState => actions.reduce((s, a) => reduce(s, a), defaultState("tokyo"));
const COFFEE = "drinks/Coffee";
const TEA = "drinks/Tea";

describe("defaultState", () => {
  it("selects nothing, which means everything", () => {
    const s = defaultState("tokyo");
    expect(s.categories.size).toBe(0);
    expect(s.areas.size).toBe(0);
    expect([s.here, s.adjacent, s.starredOnly, s.bookmarkedOnly, s.openNow, s.text]).toEqual([false, false, false, false, false, ""]);
    expect("nearby" in s || "openAt" in s).toBe(false);
    expect(hasActiveFilters(s)).toBe(false);
  });
});

describe("categories", () => {
  it("a layer with kinds has a chip per kind; one without is a chip of its own", () => {
    expect(categoriesOf(coffee)).toEqual(["drinks/Coffee", "drinks/Tea", "drinks/Bar"]);
    expect(categoriesOf(lodging)).toEqual(["tokyo-lodging"]);
  });

  it("layersInPlay: every layer when none is selected, else those with a selection", () => {
    const tokyo = layersInRegion(allLayers, "tokyo");
    expect(layersInPlay(run(), tokyo)).toEqual([coffee, lodging]);
    expect(layersInPlay(run({ type: "toggleCategory", category: TEA }), tokyo)).toEqual([coffee]);
    expect(layersInPlay(run({ type: "toggleCategory", category: "tokyo-lodging" }), tokyo)).toEqual([lodging]);
    expect(layersInRegion(allLayers, "kyoto")).toEqual([kyotoFood]);
  });
});

describe("reduce", () => {
  it("setRegion resets everything for the new region; the same region keeps identity", () => {
    const s = run({ type: "setText", text: "x" }, { type: "toggleCategory", category: TEA }, { type: "toggleArea", area: "Central" });
    const kyoto = reduce(s, { type: "setRegion", region: "kyoto" });
    expect(kyoto).toEqual(defaultState("kyoto"));
    expect(reduce(s, { type: "setRegion", region: "tokyo" })).toBe(s);
  });

  it("toggleCategory adds and removes without mutating the old state", () => {
    const s0 = run();
    const s1 = reduce(s0, { type: "toggleCategory", category: COFFEE });
    expect([...s1.categories]).toEqual([COFFEE]);
    expect(s0.categories.size).toBe(0);
    expect(reduce(s1, { type: "toggleCategory", category: COFFEE }).categories.size).toBe(0);
  });

  it("setCategories turns a layer's chips all on or all off, leaving other layers alone", () => {
    const all = categoriesOf(coffee);
    const on = run({ type: "toggleCategory", category: "tokyo-lodging" }, { type: "toggleCategory", category: TEA }, { type: "setCategories", categories: all, on: true });
    expect([...on.categories].sort()).toEqual(["drinks/Bar", "drinks/Coffee", "drinks/Tea", "tokyo-lodging"]);
    expect([...reduce(on, { type: "setCategories", categories: all, on: false }).categories]).toEqual(["tokyo-lodging"]);
  });

  it("toggleArea and setAreas (a ward heading) work the same way", () => {
    const s = run({ type: "toggleArea", area: "East" }, { type: "setAreas", areas: ["Central", "Shibuya"], on: true });
    expect([...s.areas]).toEqual(["East", "Central", "Shibuya"]);
    expect([...reduce(s, { type: "setAreas", areas: ["Central", "Shibuya"], on: false }).areas]).toEqual(["East"]);
    expect(reduce(s, { type: "toggleArea", area: "East" }).areas.has("East")).toBe(false);
  });

  it("Here narrows; + Adjacent alone narrows nothing, so it is not an active filter", () => {
    expect(hasActiveFilters(run({ type: "setHere", value: true }))).toBe(true);
    const adjacent = run({ type: "setAdjacent", value: true });
    expect(adjacent.adjacent).toBe(true);
    expect(hasActiveFilters(adjacent)).toBe(false);
  });

  it("Nearby holds a radius; off removes the key, so a cleared state equals a fresh one", () => {
    const on = run({ type: "setNearby", value: 1500 });
    expect(on.nearby).toBe(1500);
    expect(hasActiveFilters(on)).toBe(true);
    expect(reduce(on, { type: "setNearby", value: undefined })).toEqual(defaultState("tokyo"));
  });

  it("setAreaChoice sets the picks, Here and + Adjacent at once", () => {
    const s = run({ type: "toggleArea", area: "East" }, { type: "setAreaChoice", areas: ["Central", "Shibuya"], here: true, adjacent: true });
    expect([[...s.areas], s.here, s.adjacent]).toEqual([["Central", "Shibuya"], true, true]);
  });

  it("each page's selection and its Clear cover that page's state only", () => {
    const s = run(
      { type: "toggleCategory", category: COFFEE },
      { type: "setOpenNow", value: true },
      { type: "setOpenAt", value: "2026-11-10T10:00" },
      { type: "setNearby", value: 1000 },
      { type: "toggleArea", area: "East" },
      { type: "setHere", value: true },
      { type: "setAdjacent", value: true },
      { type: "setText", text: "glitch" },
    );
    expect([hasGroupSelection(s, "filters"), hasGroupSelection(s, "area")]).toEqual([true, true]);
    const noFilters = reduce(s, { type: "clearGroup", group: "filters" });
    expect(hasGroupSelection(noFilters, "filters")).toBe(false);
    expect([noFilters.text, [...noFilters.areas], noFilters.here, noFilters.adjacent]).toEqual(["glitch", ["East"], true, true]);
    const noAreas = reduce(s, { type: "clearGroup", group: "area" });
    expect([noAreas.areas.size, noAreas.here, noAreas.adjacent]).toEqual([0, false, false]);
    expect([noAreas.openNow, noAreas.nearby, noAreas.openAt, noAreas.text]).toEqual([true, 1000, "2026-11-10T10:00", "glitch"]);
    // + Adjacent alone is no selection on the Area page.
    expect(hasGroupSelection(run({ type: "setAdjacent", value: true }), "area")).toBe(false);
  });

  it("every other selection counts as active", () => {
    const actions: FilterAction[] = [
      { type: "toggleCategory", category: COFFEE },
      { type: "toggleArea", area: "East" },
      { type: "setText", text: "x" },
      { type: "setStarredOnly", value: true },
      { type: "setBookmarkedOnly", value: true },
      { type: "setOpenNow", value: true },
      { type: "setOpenAt", value: "2026-11-10T10:00" },
      { type: "setNearby", value: 500 },
    ];
    for (const a of actions) expect(hasActiveFilters(run(a))).toBe(true);
  });

  it("setOpenAt undefined removes the key", () => {
    const s = run({ type: "setOpenAt", value: "2026-11-10T10:00" }, { type: "setOpenAt", value: undefined });
    expect("openAt" in s).toBe(false);
  });

  it("clearFilters is the default state of the same region", () => {
    const s = run(
      { type: "setRegion", region: "kyoto" },
      { type: "toggleCategory", category: "kyoto-food" },
      { type: "setText", text: "x" },
      { type: "toggleArea", area: "Gion" },
      { type: "setHere", value: true },
      { type: "setAdjacent", value: true },
      { type: "setNearby", value: 2000 },
      { type: "setStarredOnly", value: true },
      { type: "setBookmarkedOnly", value: true },
      { type: "setOpenNow", value: true },
      { type: "setOpenAt", value: "2026-11-10T10:00" },
    );
    expect(hasActiveFilters(s)).toBe(true);
    expect(reduce(s, { type: "clearFilters" })).toEqual(defaultState("kyoto"));
  });
});
