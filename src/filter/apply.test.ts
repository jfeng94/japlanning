import { describe, expect, it } from "vitest";
import { areaIndex } from "../data/areas.ts";
import { applyFilters, areaScope, matchesCategories, normalise, sinkUnknownHours, type ApplyOptions, type HoursInput } from "./apply.ts";
import { defaultState, reduce, type FilterAction, type FilterState } from "./state.ts";
import { AREAS, place, samplePlaces } from "./testing.ts";

const places = samplePlaces();
const areas = areaIndex({ areas: AREAS });
const names = (s: FilterState, opts: ApplyOptions = {}) => applyFilters(places, s, { areas, ...opts }).map((p) => p.name);
const run = (...actions: FilterAction[]): FilterState => actions.reduce((s, a) => reduce(s, a), defaultState("tokyo"));
const cat = (category: string): FilterAction => ({ type: "toggleCategory", category });
const area = (a: string): FilterAction => ({ type: "toggleArea", area: a });
const NEARBY: FilterAction = { type: "setNearby", value: true };
const HERE: FilterAction = { type: "setHere", value: true };
const ALL_TOKYO = ["Glitch", "Fuglen", "Bear Pond", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo", "Hotel"];

describe("applyFilters", () => {
  it("nothing selected shows every place in the region, none from other regions", () => {
    expect(names(run())).toEqual(ALL_TOKYO);
  });

  it("categories are a union, across kinds and across layers; a place of two kinds matches either", () => {
    expect(names(run(cat("drinks/Coffee")))).toEqual(["Glitch", "Fuglen", "Bear Pond", "Unknown Kissa", "ＧＬＩＴＣＨ annex"]);
    expect(names(run(cat("drinks/Tea")))).toEqual(["Ippodo"]);
    expect(names(run(cat("drinks/Bar")))).toEqual(["Fuglen"]);
    expect(names(run(cat("drinks/Tea"), cat("drinks/Bar")))).toEqual(["Fuglen", "Ippodo"]);
    expect(names(run(cat("tokyo-lodging")))).toEqual(["Hotel"]);
    expect(names(run(cat("drinks/Tea"), cat("tokyo-lodging")))).toEqual(["Ippodo", "Hotel"]);
  });

  it("areas are a union; none selected means everywhere", () => {
    expect(names(run(area("Central")))).toEqual(["Glitch", "ＧＬＩＴＣＨ annex", "Ippodo"]);
    expect(names(run(area("Central"), area("East")))).toEqual(["Glitch", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
  });

  it("Include nearby adds the neighbouring chips of everything chosen, and nothing on its own", () => {
    expect(names(run(area("East"), NEARBY))).toEqual(["Glitch", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
    expect(names(run(area("Shibuya"), NEARBY))).toEqual(["Glitch", "Fuglen", "Bear Pond", "ＧＬＩＴＣＨ annex", "Ippodo", "Hotel"]);
    expect(names(run(NEARBY))).toEqual(ALL_TOKYO);
  });

  it("Here adds its chip; unresolved, it keeps everything; off, a resolved chip is ignored", () => {
    expect(names(run(HERE), { hereGroup: "Shibuya" })).toEqual(["Fuglen", "Bear Pond", "Hotel"]);
    expect(names(run(HERE))).toEqual(ALL_TOKYO);
    expect(names(run(HERE, area("East")), { hereGroup: "Shibuya" })).toEqual(["Fuglen", "Bear Pond", "Unknown Kissa", "Hotel"]);
    expect(names(run(HERE, area("East")))).toEqual(["Unknown Kissa"]);
    expect(names(run(), { hereGroup: "Shibuya" })).toEqual(ALL_TOKYO);
    expect(names(run(HERE, NEARBY), { hereGroup: "East" })).toEqual(["Glitch", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
  });

  it("groups AND together: Coffee + Tea in Shibuya and nearby", () => {
    expect(names(run(cat("drinks/Coffee"), cat("drinks/Tea"), area("Shibuya"), NEARBY))).toEqual([
      "Glitch",
      "Fuglen",
      "Bear Pond",
      "ＧＬＩＴＣＨ annex",
      "Ippodo",
    ]);
  });

  it("key branches only", () => {
    expect(names(run({ type: "setStarredOnly", value: true }))).toEqual(["Glitch"]);
  });

  it("bookmarked only uses the device's set; no set means nothing", () => {
    const on: FilterAction = { type: "setBookmarkedOnly", value: true };
    const ids = places.filter((p) => p.name === "Fuglen" || p.name === "Ippodo").map((p) => p.id);
    expect(names(run(on), { bookmarks: new Set(ids) })).toEqual(["Fuglen", "Ippodo"]);
    expect(names(run(on))).toEqual([]);
    expect(names(run(on, { type: "setStarredOnly", value: true }), { bookmarks: new Set(ids) })).toEqual([]);
  });

  it("open now: closed fails; open and unknown pass; layers without hours are untouched; no evaluation passes all", () => {
    const on: FilterAction = { type: "setOpenNow", value: true };
    const id = (name: string) => places.find((p) => p.name === name)!.id;
    const hours: HoursInput = {
      states: new Map([
        [id("Glitch"), "open"],
        [id("Fuglen"), "closed"],
        [id("Bear Pond"), "unknown"],
        // the rest of the drinks are absent from the map: unknown
      ]),
      layersWithHours: new Set(["drinks"]),
    };
    expect(names(run(on), { hours })).toEqual(ALL_TOKYO.filter((n) => n !== "Fuglen"));
    expect(names(run(on))).toEqual(ALL_TOKYO);
  });

  it("text search is case- and width-insensitive over name, area, notes, kinds, facet values and the address", () => {
    expect(names(run({ type: "setText", text: "glitch" }))).toEqual(["Glitch", "ＧＬＩＴＣＨ annex"]);
    expect(names(run({ type: "setText", text: "ｇｌｉｔｃｈ" }))).toEqual(["Glitch", "ＧＬＩＴＣＨ annex"]);
    expect(names(run({ type: "setText", text: "shibuya" }))).toEqual(["Fuglen", "Bear Pond", "Hotel"]);
    expect(names(run({ type: "setText", text: "light roast" }))).toEqual(["Glitch"]);
    expect(names(run({ type: "setText", text: "pour-over" }))).toEqual(["Glitch", "Fuglen"]);
    expect(names(run({ type: "setText", text: "Kissaten" }))).toEqual(["ＧＬＩＴＣＨ annex"]);
    expect(names(run({ type: "setText", text: "bar" }))).toEqual(["Fuglen"]);
    expect(names(run({ type: "setText", text: "千代田" }))).toEqual(["Glitch"]);
    expect(names(run({ type: "setText", text: "   " }))).toEqual(ALL_TOKYO);
  });

  it("everything stacks", () => {
    const s = run(cat("drinks/Coffee"), area("Central"), { type: "setText", text: "glitch" }, { type: "setStarredOnly", value: true });
    expect(names(s)).toEqual(["Glitch"]);
  });
});

describe("areaScope", () => {
  it("is undefined when the area filter keeps everything", () => {
    expect(areaScope(run(), { areas })).toBeUndefined();
    expect(areaScope(run(NEARBY), { areas })).toBeUndefined();
    expect(areaScope(run(HERE), { areas })).toBeUndefined();
  });

  it("names what is chosen and, with Include nearby, what is pulled in", () => {
    expect(areaScope(run(area("East")), { areas })).toEqual({ chosen: new Set(["East"]), nearby: new Set() });
    expect(areaScope(run(area("East"), NEARBY), { areas })).toEqual({ chosen: new Set(["East"]), nearby: new Set(["Central"]) });
    expect(areaScope(run(HERE, NEARBY), { areas, hereGroup: "Shibuya" })).toEqual({ chosen: new Set(["Shibuya"]), nearby: new Set(["Central"]) });
    expect(areaScope(run(area("Central"), NEARBY), { areas })).toEqual({ chosen: new Set(["Central"]), nearby: new Set(["Shibuya", "East"]) });
  });
});

describe("matchesCategories", () => {
  it("matches a kind of the place's layer, or the layer itself", () => {
    const fuglen = place({ name: "f", kinds: ["Coffee", "Bar"] });
    expect(matchesCategories(fuglen, new Set())).toBe(true);
    expect(matchesCategories(fuglen, new Set(["drinks/Bar"]))).toBe(true);
    expect(matchesCategories(fuglen, new Set(["drinks/Tea"]))).toBe(false);
    expect(matchesCategories(fuglen, new Set(["drinks"]))).toBe(true);
    expect(matchesCategories(fuglen, new Set(["kyoto-food/Bar"]))).toBe(false);
  });
});

describe("normalise", () => {
  it("folds case and width", () => {
    expect(normalise("ＧＬＩＴＣＨ")).toBe("glitch");
    expect(normalise("  Café ")).toBe("café");
  });
});

describe("sinkUnknownHours", () => {
  it("moves unknown-hours rows of hours layers to the end, in order, and leaves the rest alone", () => {
    const [a, b, c] = places.filter((p) => p.layerId === "drinks") as [typeof places[0], typeof places[0], typeof places[0]];
    const hours: HoursInput = {
      states: new Map([[a.id, "unknown"], [b.id, "open"]]), // c has no entry: unknown too
      layersWithHours: new Set(["drinks"]),
    };
    expect(sinkUnknownHours([a, b, c], hours).map((p) => p.name)).toEqual([b.name, a.name, c.name]);
    expect(sinkUnknownHours([a, b, c], undefined)).toEqual([a, b, c]);
    const hotel = places.find((p) => p.name === "Hotel")!;
    // A layer without hours is not unknown; it keeps its place.
    expect(sinkUnknownHours([a, hotel, b], hours).map((p) => p.name)).toEqual(["Hotel", b.name, a.name]);
  });
});
