import { describe, expect, it } from "vitest";
import type { LayerId } from "../data/types.ts";
import {
  activeFacetLayer,
  defaultState,
  getSelection,
  hasActiveFilters,
  reduce,
  type FilterState,
} from "./state.ts";
import { allLayers } from "./testing.ts";

const TEA = "tokyo-tea" as LayerId;
const r = (s: FilterState, a: Parameters<typeof reduce>[1]) => reduce(s, a, allLayers);

describe("defaultState", () => {
  it("selects every layer in the region and nothing else", () => {
    const s = defaultState("tokyo", allLayers);
    expect([...s.layers]).toEqual(["tokyo-coffee", "tokyo-tea"]);
    expect(s.text).toBe("");
    expect(s.neighborhoods.size).toBe(0);
    expect(s.starredOnly).toBe(false);
    expect(s.facets).toEqual({});
    expect(hasActiveFilters(s)).toBe(false);
  });

  it("gives Hakone an empty layer set", () => {
    expect(defaultState("hakone", allLayers).layers.size).toBe(0);
  });
});

describe("reduce", () => {
  it("setRegion resets everything for the new region", () => {
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "setText", text: "x" });
    s = r(s, { type: "setRegion", region: "kyoto" });
    expect(s.region).toBe("kyoto");
    expect([...s.layers]).toEqual(["kyoto-food"]);
    expect(s.text).toBe("");
  });

  it("setRegion to the same region is a no-op that keeps identity", () => {
    const s = defaultState("tokyo", allLayers);
    expect(r(s, { type: "setRegion", region: "tokyo" })).toBe(s);
  });

  it("toggleLayer adds and removes without mutating the old state", () => {
    const s0 = defaultState("tokyo", allLayers);
    const s1 = r(s0, { type: "toggleLayer", layer: TEA });
    expect([...s1.layers]).toEqual(["tokyo-coffee"]);
    expect(s0.layers.size).toBe(2);
    expect([...r(s1, { type: "toggleLayer", layer: TEA }).layers].sort()).toEqual(["tokyo-coffee", "tokyo-tea"]);
  });

  it("activeFacetLayer is set only with exactly one layer", () => {
    const two = defaultState("tokyo", allLayers);
    expect(activeFacetLayer(two)).toBeUndefined();
    const one = r(two, { type: "toggleLayer", layer: TEA });
    expect(activeFacetLayer(one)).toBe("tokyo-coffee");
    expect(activeFacetLayer(r(one, { type: "toggleLayer", layer: "tokyo-coffee" }))).toBeUndefined();
  });

  it("toggleFacetValue builds and tears down selections", () => {
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Café" });
    expect([...getSelection(s, "tokyo-coffee", "Format").values]).toEqual(["Stand", "Café"]);
    expect(hasActiveFilters(s)).toBe(true);

    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Café" });
    expect(s.facets).toEqual({});
    expect(hasActiveFilters(s)).toBe(false);
  });

  it("setIncludeUnknown false is a non-default selection on its own", () => {
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "setIncludeUnknown", layer: "tokyo-coffee", column: "Format", value: false });
    expect(getSelection(s, "tokyo-coffee", "Format").includeUnknown).toBe(false);
    expect(hasActiveFilters(s)).toBe(true);
    s = r(s, { type: "setIncludeUnknown", layer: "tokyo-coffee", column: "Format", value: true });
    expect(s.facets).toEqual({});
  });

  it("facet selections survive the layer being deselected", () => {
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "toggleLayer", layer: TEA }); // coffee only
    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    s = r(s, { type: "toggleLayer", layer: TEA }); // both
    expect(activeFacetLayer(s)).toBeUndefined();
    expect(getSelection(s, "tokyo-coffee", "Format").values.has("Stand")).toBe(true);
    s = r(s, { type: "toggleLayer", layer: TEA }); // coffee only again
    expect(activeFacetLayer(s)).toBe("tokyo-coffee");
  });

  it("clearFilters keeps region and layers", () => {
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "toggleLayer", layer: TEA });
    s = r(s, { type: "setText", text: "x" });
    s = r(s, { type: "toggleNeighborhood", neighborhood: "Central" });
    s = r(s, { type: "setStarredOnly", value: true });
    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    s = r(s, { type: "clearFilters" });
    expect(s.region).toBe("tokyo");
    expect([...s.layers]).toEqual(["tokyo-coffee"]);
    expect(hasActiveFilters(s)).toBe(false);
  });
});
