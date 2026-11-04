import { describe, expect, it } from "vitest";
import type { LayerId } from "../data/types.ts";
import {
  activeFacetLayer,
  defaultState,
  effectiveLayers,
  getSelection,
  hasActiveFilters,
  reduce,
  type FilterState,
} from "./state.ts";
import { allLayers } from "./testing.ts";

const TEA = "tokyo-tea" as LayerId;
const r = (s: FilterState, a: Parameters<typeof reduce>[1]) => reduce(s, a, allLayers);

describe("defaultState", () => {
  it("selects no layers (which means all) and nothing else", () => {
    const s = defaultState("tokyo", allLayers);
    expect(s.layers.size).toBe(0);
    expect([...effectiveLayers(s, ["tokyo-coffee", TEA])]).toEqual(["tokyo-coffee", "tokyo-tea"]);
    expect(s.text).toBe("");
    expect(s.neighborhoods.size).toBe(0);
    expect(s.starredOnly).toBe(false);
    expect(s.facets).toEqual({});
    expect(hasActiveFilters(s)).toBe(false);
  });

  it("a region with one layer has that layer's facets active by default", () => {
    expect(activeFacetLayer(defaultState("kyoto", allLayers), ["kyoto-food" as LayerId])).toBe("kyoto-food");
    expect(activeFacetLayer(defaultState("hakone", allLayers), [])).toBeUndefined();
  });
});

describe("reduce", () => {
  it("setRegion resets everything for the new region", () => {
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "setText", text: "x" });
    s = r(s, { type: "toggleLayer", layer: TEA });
    s = r(s, { type: "setRegion", region: "kyoto" });
    expect(s.region).toBe("kyoto");
    expect(s.layers.size).toBe(0);
    expect(s.text).toBe("");
  });

  it("setRegion to the same region is a no-op that keeps identity", () => {
    const s = defaultState("tokyo", allLayers);
    expect(r(s, { type: "setRegion", region: "tokyo" })).toBe(s);
  });

  it("toggleLayer adds and removes without mutating the old state", () => {
    const s0 = defaultState("tokyo", allLayers);
    const s1 = r(s0, { type: "toggleLayer", layer: TEA });
    expect([...s1.layers]).toEqual(["tokyo-tea"]);
    expect(s0.layers.size).toBe(0);
    expect(r(s1, { type: "toggleLayer", layer: TEA }).layers.size).toBe(0);
  });

  it("activeFacetLayer is set only with exactly one layer in play", () => {
    const ids: LayerId[] = ["tokyo-coffee", TEA];
    const none = defaultState("tokyo", allLayers); // none selected = both in play
    expect(activeFacetLayer(none, ids)).toBeUndefined();
    const one = r(none, { type: "toggleLayer", layer: "tokyo-coffee" });
    expect(activeFacetLayer(one, ids)).toBe("tokyo-coffee");
    const two = r(one, { type: "toggleLayer", layer: TEA });
    expect(activeFacetLayer(two, ids)).toBeUndefined();
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
    const ids: LayerId[] = ["tokyo-coffee", TEA];
    let s = defaultState("tokyo", allLayers);
    s = r(s, { type: "toggleLayer", layer: "tokyo-coffee" }); // coffee only
    s = r(s, { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" });
    s = r(s, { type: "toggleLayer", layer: TEA }); // both
    expect(activeFacetLayer(s, ids)).toBeUndefined();
    expect(getSelection(s, "tokyo-coffee", "Format").values.has("Stand")).toBe(true);
    s = r(s, { type: "toggleLayer", layer: TEA }); // coffee only again
    expect(activeFacetLayer(s, ids)).toBe("tokyo-coffee");
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
    expect([...s.layers]).toEqual(["tokyo-tea"]);
    expect(hasActiveFilters(s)).toBe(false);
  });
});
