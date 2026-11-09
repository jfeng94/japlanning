import { describe, expect, it } from "vitest";
import type { RegionConfig } from "../data/types.ts";
import { defaultState, reduce, type FilterAction, type FilterState } from "./state.ts";
import { allLayers, AREAS } from "./testing.ts";
import { fromSearchParams, toSearchParams, type UrlContext } from "./url.ts";

/** Tokyo with Tsukiji merged into the Central chip, so raw labels in links can be checked. */
const regions: RegionConfig[] = [
  {
    id: "tokyo",
    label: "Tokyo",
    areas: [...AREAS, { label: "Tsukiji", ward: "中央区", adjacent: [] }],
    areaGroups: [{ label: "Central", areas: ["Central", "Tsukiji"] }],
  },
  { id: "kyoto", label: "Kyoto", areas: [{ label: "Gion", ward: "東山区", adjacent: [] }] },
  { id: "hakone", label: "Hakone", areas: [] },
];
const ctx: UrlContext = { regions, layers: allLayers, defaultRegion: "tokyo" };

const run = (...actions: FilterAction[]): FilterState => actions.reduce((s, a) => reduce(s, a), defaultState("tokyo"));
const roundTrip = (s: FilterState) => fromSearchParams(new URLSearchParams(toSearchParams(s, ctx)), ctx);
const query = (s: FilterState) => decodeURIComponent(toSearchParams(s, ctx).toString());
const parse = (q: string) => fromSearchParams(new URLSearchParams(q), ctx);
const cat = (category: string): FilterAction => ({ type: "toggleCategory", category });

describe("toSearchParams", () => {
  it("the default state is an empty query", () => {
    expect(query(run())).toBe("");
  });

  it("writes only what differs from the default", () => {
    expect(query(run({ type: "setText", text: "glitch" }))).toBe("q=glitch");
    expect(query(run({ type: "setRegion", region: "kyoto" }))).toBe("r=kyoto");
    expect(query(run({ type: "toggleArea", area: "Central" }, { type: "toggleArea", area: "East" }))).toBe("a=Central&a=East");
    expect(query(run({ type: "setHere", value: true }, { type: "setNearby", value: true }))).toBe("here=1&nb=1");
    expect(query(run({ type: "setStarredOnly", value: true }, { type: "setBookmarkedOnly", value: true }))).toBe("star=1&b=1");
    expect(query(run({ type: "setOpenNow", value: true }, { type: "setOpenAt", value: "2026-11-10T10:00" }))).toBe("open=1&at=2026-11-10T10:00");
  });

  it("writes a layer whose kinds are all on as the layer, anything else chip by chip", () => {
    expect(query(run(cat("drinks/Coffee")))).toBe("c=drinks/Coffee");
    expect(query(run(cat("drinks/Coffee"), cat("drinks/Tea")))).toBe("c=drinks/Coffee&c=drinks/Tea");
    expect(query(run(cat("drinks/Coffee"), cat("drinks/Tea"), cat("drinks/Bar")))).toBe("c=drinks");
    expect(query(run(cat("tokyo-lodging"), cat("drinks/Tea")))).toBe("c=tokyo-lodging&c=drinks/Tea");
  });
});

describe("round trip", () => {
  it("restores a fully loaded state", () => {
    const s = run(
      cat("drinks/Coffee"),
      cat("tokyo-lodging"),
      { type: "setText", text: "café & stand" },
      { type: "toggleArea", area: "Central" },
      { type: "toggleArea", area: "East" },
      { type: "setHere", value: true },
      { type: "setNearby", value: true },
      { type: "setStarredOnly", value: true },
      { type: "setBookmarkedOnly", value: true },
      { type: "setOpenNow", value: true },
      { type: "setOpenAt", value: "2026-11-10T10:00" },
    );
    expect(roundTrip(s)).toEqual(s);
  });

  it("restores every kind of a layer from the layer alone", () => {
    const s = run(cat("drinks/Coffee"), cat("drinks/Tea"), cat("drinks/Bar"));
    expect(roundTrip(s)).toEqual(s);
  });

  it("restores another region", () => {
    expect(roundTrip(run({ type: "setRegion", region: "kyoto" }, { type: "toggleArea", area: "Gion" }))).toEqual(
      run({ type: "setRegion", region: "kyoto" }, { type: "toggleArea", area: "Gion" }),
    );
  });

  it("survives Japanese and separator-like characters in the search", () => {
    const s = run({ type: "setText", text: "神保町 / ｶﾌｪ & a=b" });
    expect(roundTrip(s)).toEqual(s);
  });
});

describe("fromSearchParams drops what it doesn't recognise", () => {
  it("an unknown region falls back to the default", () => {
    expect(parse("r=osaka").region).toBe("tokyo");
  });

  it("unknown layers and kinds, and layers of another region, are dropped", () => {
    expect([...parse("c=drinks/Juice&c=bogus&c=kyoto-food&c=drinks/Tea").categories]).toEqual(["drinks/Tea"]);
    expect(parse("c=bogus").categories.size).toBe(0);
  });

  it("a raw area becomes its chip, step 1's n= still reads, unknown areas drop", () => {
    expect([...parse("a=Tsukiji").areas]).toEqual(["Central"]);
    expect([...parse("n=East&a=Atlantis").areas]).toEqual(["East"]);
    expect([...parse("r=kyoto&a=East").areas]).toEqual([]);
  });

  it("a malformed open-at time is ignored", () => {
    expect(parse("at=tomorrow").openAt).toBeUndefined();
  });
});
