import { describe, expect, it } from "vitest";
import type { LayerId } from "../data/types.ts";
import { applyFilters, facetCounts, matchesFacet, neighborhoodCounts, normalise } from "./apply.ts";
import { defaultState, reduce, type FilterAction, type FilterState } from "./state.ts";
import { allLayers, coffee, NEIGHBORHOODS, samplePlaces } from "./testing.ts";

const TEA = "tokyo-tea" as LayerId;
const places = samplePlaces();
const names = (s: FilterState) => applyFilters(places, s).map((p) => p.name);

function state(...actions: FilterAction[]): FilterState {
  return actions.reduce((s, a) => reduce(s, a, allLayers), defaultState("tokyo", allLayers));
}
const coffeeOnly: FilterAction = { type: "toggleLayer", layer: TEA };

describe("applyFilters", () => {
  it("default state shows every place in the region's layers, none from other regions", () => {
    expect(names(state())).toEqual(["Glitch", "Fuglen", "Bear Pond", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
  });

  it("layer membership", () => {
    expect(names(state(coffeeOnly))).not.toContain("Ippodo");
    expect(names(state({ type: "setLayers", layers: [TEA] }))).toEqual(["Ippodo"]);
    expect(names(state({ type: "setLayers", layers: [] }))).toEqual([]);
  });

  it("text search is case- and width-insensitive over name, neighborhood and notes", () => {
    expect(names(state({ type: "setText", text: "glitch" }))).toEqual(["Glitch", "ＧＬＩＴＣＨ annex"]);
    expect(names(state({ type: "setText", text: "ｇｌｉｔｃｈ" }))).toEqual(["Glitch", "ＧＬＩＴＣＨ annex"]);
    expect(names(state({ type: "setText", text: "shibuya" }))).toEqual(["Fuglen", "Bear Pond"]);
    expect(names(state({ type: "setText", text: "light roast" }))).toEqual(["Glitch"]);
    expect(names(state({ type: "setText", text: "   " }))).toHaveLength(6);
  });

  it("starred only", () => {
    expect(names(state({ type: "setStarredOnly", value: true }))).toEqual(["Glitch"]);
  });

  it("neighborhoods OR together and apply across layers", () => {
    expect(names(state({ type: "toggleNeighborhood", neighborhood: "Central" }))).toEqual(["Glitch", "ＧＬＩＴＣＨ annex", "Ippodo"]);
    expect(
      names(state({ type: "toggleNeighborhood", neighborhood: "Central" }, { type: "toggleNeighborhood", neighborhood: "East" })),
    ).toEqual(["Glitch", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
  });

  it("facet values OR within a facet; blanks still pass by default", () => {
    const s = state(coffeeOnly, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    expect(names(s)).toEqual(["Bear Pond", "Unknown Kissa"]);
    const s2 = reduce(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Café" }, allLayers);
    expect(names(s2)).toEqual(["Glitch", "Fuglen", "Bear Pond", "Unknown Kissa"]);
  });

  it("include unknown off drops blank rows, with or without a value selection", () => {
    const off: FilterAction = { type: "setIncludeUnknown", layer: "tokyo-coffee", column: "Format", value: false };
    expect(names(state(coffeeOnly, off))).toEqual(["Glitch", "Fuglen", "Bear Pond", "ＧＬＩＴＣＨ annex"]);
    expect(
      names(state(coffeeOnly, off, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" })),
    ).toEqual(["Bear Pond"]);
  });

  it("facets AND across columns; multi-value rows match on any value", () => {
    const s = state(
      coffeeOnly,
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Café" },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Specialty", value: "Espresso" },
    );
    expect(names(s)).toEqual(["Fuglen", "Unknown Kissa"]);
  });

  it("facets are ignored while two layers are selected and come back with one", () => {
    const one = state(coffeeOnly, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    const two = reduce(one, { type: "toggleLayer", layer: TEA }, allLayers);
    expect(names(two)).toHaveLength(6);
    expect(names(reduce(two, { type: "toggleLayer", layer: TEA }, allLayers))).toEqual(["Bear Pond", "Unknown Kissa"]);
  });

  it("filters stack", () => {
    const s = state(
      coffeeOnly,
      { type: "setText", text: "glitch" },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Kissaten" },
    );
    expect(names(s)).toEqual(["ＧＬＩＴＣＨ annex"]);
  });
});

describe("matchesFacet", () => {
  const sel = (values: string[], includeUnknown = true) => ({ values: new Set(values), includeUnknown });
  it("no selection matches anything non-blank", () => {
    expect(matchesFacet(["x"], sel([]))).toBe(true);
    expect(matchesFacet([], sel([]))).toBe(true);
    expect(matchesFacet([], sel([], false))).toBe(false);
  });
  it("selection needs an overlap", () => {
    expect(matchesFacet(["a", "b"], sel(["b"]))).toBe(true);
    expect(matchesFacet(["a"], sel(["b"]))).toBe(false);
    expect(matchesFacet([], sel(["b"]))).toBe(true);
    expect(matchesFacet([], sel(["b"], false))).toBe(false);
  });
});

describe("facetCounts", () => {
  it("counts over the other filters, configured values first, multi-value once per value", () => {
    const counts = facetCounts(places, state(coffeeOnly), coffee);
    const format = counts.get("Format")!;
    expect([...format.values]).toEqual([["Stand", 1], ["Café", 2], ["Kissaten", 1]]);
    expect(format.unknown).toBe(1);
    const specialty = counts.get("Specialty")!;
    expect([...specialty.values]).toEqual([["Pour-over", 2], ["Espresso", 2]]);
    expect(specialty.unknown).toBe(2);
  });

  it("a facet's own selection does not reduce its counts, but other facets do", () => {
    const s = state(
      coffeeOnly,
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" },
      { type: "setIncludeUnknown", layer: "tokyo-coffee", column: "Format", value: false },
    );
    const counts = facetCounts(places, s, coffee);
    expect([...counts.get("Format")!.values]).toEqual([["Stand", 1], ["Café", 2], ["Kissaten", 1]]);
    expect(counts.get("Format")!.unknown).toBe(1);
    // Only Bear Pond passes the Format filter, so Specialty counts shrink to it.
    expect([...counts.get("Specialty")!.values]).toEqual([["Pour-over", 0], ["Espresso", 1]]);
    expect(counts.get("Specialty")!.unknown).toBe(0);
  });

  it("respects text and neighborhood filters", () => {
    const counts = facetCounts(places, state(coffeeOnly, { type: "setText", text: "glitch" }), coffee);
    expect([...counts.get("Format")!.values]).toEqual([["Stand", 0], ["Café", 1], ["Kissaten", 1]]);
  });

  it("includes unlisted values after the configured ones", () => {
    const odd = [...places, samplePlaces()[0]!, { ...samplePlaces()[0]!, id: "x", name: "Odd", facets: { Format: ["Truck"] } }];
    const counts = facetCounts(odd, state(coffeeOnly), coffee);
    expect([...counts.get("Format")!.values.keys()]).toEqual(["Stand", "Café", "Kissaten", "Truck"]);
  });
});

describe("neighborhoodCounts", () => {
  it("counts ignore the neighborhood selection itself", () => {
    const s = state({ type: "toggleNeighborhood", neighborhood: "East" });
    expect([...neighborhoodCounts(places, s, NEIGHBORHOODS)]).toEqual([["Central", 3], ["Shibuya", 2], ["East", 1]]);
  });
  it("but respect the other filters", () => {
    const s = state({ type: "setStarredOnly", value: true });
    expect([...neighborhoodCounts(places, s, NEIGHBORHOODS)]).toEqual([["Central", 1], ["Shibuya", 0], ["East", 0]]);
  });
});

describe("normalise", () => {
  it("folds case and width", () => {
    expect(normalise("ＧＬＩＴＣＨ")).toBe("glitch");
    expect(normalise("  Café ")).toBe("café");
  });
});
