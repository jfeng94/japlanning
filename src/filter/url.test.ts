import { describe, expect, it } from "vitest";
import type { LayerId, RegionConfig } from "../data/types.ts";
import { defaultState, reduce, type FilterAction, type FilterState } from "./state.ts";
import { allLayers, NEIGHBORHOODS } from "./testing.ts";
import { fromSearchParams, toSearchParams, type UrlContext } from "./url.ts";

const regions: RegionConfig[] = [
  { id: "tokyo", label: "Tokyo", neighborhoods: NEIGHBORHOODS },
  { id: "kyoto", label: "Kyoto", neighborhoods: ["Gion"] },
  { id: "hakone", label: "Hakone", neighborhoods: [] },
];
const ctx: UrlContext = { regions, layers: allLayers, defaultRegion: "tokyo" };
const TEA = "tokyo-tea" as LayerId;

function state(...actions: FilterAction[]): FilterState {
  return actions.reduce((s, a) => reduce(s, a, allLayers), defaultState("tokyo", allLayers));
}
const roundTrip = (s: FilterState) => fromSearchParams(new URLSearchParams(toSearchParams(s, ctx)), ctx);
const query = (s: FilterState) => toSearchParams(s, ctx).toString();

describe("toSearchParams", () => {
  it("default state is an empty query", () => {
    expect(query(state())).toBe("");
  });

  it("writes only what differs from the default", () => {
    expect(query(state({ type: "setText", text: "glitch" }))).toBe("q=glitch");
    expect(query(state({ type: "toggleLayer", layer: TEA }))).toBe("l=tokyo-tea");
    expect(query(state({ type: "setRegion", region: "kyoto" }))).toBe("r=kyoto");
    expect(query(state({ type: "setStarredOnly", value: true }))).toBe("star=1");
    expect(query(state({ type: "setBookmarkedOnly", value: true }))).toBe("b=1");
    expect(fromSearchParams(new URLSearchParams("b=1"), ctx).bookmarkedOnly).toBe(true);
  });

  it("encodes facet selections and unknown toggles per facet", () => {
    const s = state(
      { type: "toggleLayer", layer: TEA },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Stand" },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Café" },
      { type: "setIncludeUnknown", layer: "tokyo-coffee", column: "Specialty", value: false },
    );
    const p = toSearchParams(s, ctx);
    expect(p.getAll("f")).toEqual(["tokyo-coffee/Format=Stand|Caf%C3%A9"]);
    expect(p.getAll("u")).toEqual(["tokyo-coffee/Specialty"]);
  });
});

describe("round trip", () => {
  it("restores a fully loaded state", () => {
    const s = state(
      { type: "toggleLayer", layer: TEA },
      { type: "setText", text: "café & stand" },
      { type: "toggleNeighborhood", neighborhood: "Central" },
      { type: "toggleNeighborhood", neighborhood: "East" },
      { type: "setStarredOnly", value: true },
      { type: "setBookmarkedOnly", value: true },
      { type: "setOpenNow", value: true },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Café" },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Specialty", value: "Pour-over" },
      { type: "setIncludeUnknown", layer: "tokyo-coffee", column: "Specialty", value: false },
    );
    expect(roundTrip(s)).toEqual(s);
  });

  it("restores another region", () => {
    const s = state({ type: "setRegion", region: "kyoto" });
    const back = roundTrip(s);
    expect(back.region).toBe("kyoto");
    expect(back.layers.size).toBe(0);
  });

  it("survives Japanese and separator-like characters in values", () => {
    const s = state(
      { type: "toggleLayer", layer: TEA },
      { type: "setText", text: "神保町 / ｶﾌｪ" },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "Light roast / Nordic" },
      { type: "toggleFacetValue", layer: "tokyo-coffee", column: "Format", value: "A|B=C&D" },
    );
    expect(roundTrip(s)).toEqual(s);
  });
});

describe("fromSearchParams drops what it doesn't recognise", () => {
  const parse = (q: string) => fromSearchParams(new URLSearchParams(q), ctx);

  it("unknown region falls back to the default", () => {
    expect(parse("r=osaka").region).toBe("tokyo");
  });

  it("unknown or wrong-region layers are dropped; all-unknown leaves none selected (= all)", () => {
    expect([...parse("l=tokyo-coffee,kyoto-food,bogus").layers]).toEqual(["tokyo-coffee"]);
    expect(parse("l=bogus").layers.size).toBe(0);
  });

  it("unknown neighborhoods are dropped", () => {
    expect([...parse("n=Central&n=Atlantis").neighborhoods]).toEqual(["Central"]);
  });

  it("unknown layers and columns in facets are dropped, leaving no selection", () => {
    expect(parse("f=bogus/Format=Stand").facets).toEqual({});
    expect(parse("f=tokyo-coffee/Bogus=Stand").facets).toEqual({});
    expect(parse("u=tokyo-coffee/Bogus").facets).toEqual({});
    expect(parse("f=tokyo-coffee/Format").facets).toEqual({});
    expect(parse("f=tokyo-coffee/Format=").facets).toEqual({});
  });

  it("malformed percent-encoding does not throw", () => {
    expect(parse("f=tokyo-coffee/Format=%E0%A4%A").facets).toEqual({});
  });
});
