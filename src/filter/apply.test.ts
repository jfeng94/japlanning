import { describe, expect, it } from "vitest";
import { areasOf } from "../config/regions.ts";
import { areaIndex } from "../data/areas.ts";
import { applyFilters, areaLook, areaScope, matchesCategories, normalise, sinkUnknownHours, tapArea, type ApplyOptions, type HoursInput } from "./apply.ts";
import { defaultState, reduce, type FilterAction, type FilterState } from "./state.ts";
import { AREAS, place, samplePlaces } from "./testing.ts";

const places = samplePlaces();
const areas = areaIndex({ areas: AREAS });
const names = (s: FilterState, opts: ApplyOptions = {}) => applyFilters(places, s, { areas, ...opts }).map((p) => p.name);
const run = (...actions: FilterAction[]): FilterState => actions.reduce((s, a) => reduce(s, a), defaultState("tokyo"));
const cat = (category: string): FilterAction => ({ type: "toggleCategory", category });
const area = (a: string): FilterAction => ({ type: "toggleArea", area: a });
const ADJ: FilterAction = { type: "setAdjacent", value: true };
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

  it("+ Adjacent adds the neighbouring chips of everything picked, and nothing on its own", () => {
    expect(names(run(area("East"), ADJ))).toEqual(["Glitch", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
    expect(names(run(area("Shibuya"), ADJ))).toEqual(["Glitch", "Fuglen", "Bear Pond", "ＧＬＩＴＣＨ annex", "Ippodo", "Hotel"]);
    expect(names(run(ADJ))).toEqual(ALL_TOKYO);
  });

  it("Here adds its chip; unresolved, it keeps everything; off, a resolved chip is ignored", () => {
    expect(names(run(HERE), { hereGroup: "Shibuya" })).toEqual(["Fuglen", "Bear Pond", "Hotel"]);
    expect(names(run(HERE))).toEqual(ALL_TOKYO);
    expect(names(run(HERE, area("East")), { hereGroup: "Shibuya" })).toEqual(["Fuglen", "Bear Pond", "Unknown Kissa", "Hotel"]);
    expect(names(run(HERE, area("East")))).toEqual(["Unknown Kissa"]);
    expect(names(run(), { hereGroup: "Shibuya" })).toEqual(ALL_TOKYO);
    expect(names(run(HERE, ADJ), { hereGroup: "East" })).toEqual(["Glitch", "Unknown Kissa", "ＧＬＩＴＣＨ annex", "Ippodo"]);
  });

  it("groups AND together: Coffee + Tea in Shibuya and its neighbours", () => {
    expect(names(run(cat("drinks/Coffee"), cat("drinks/Tea"), area("Shibuya"), ADJ))).toEqual([
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
    expect(areaScope(run(ADJ), { areas })).toBeUndefined();
    expect(areaScope(run(HERE), { areas })).toBeUndefined();
  });

  it("names what is picked and, with + Adjacent, what is added", () => {
    expect(areaScope(run(area("East")), { areas })).toEqual({ chosen: new Set(["East"]), added: new Set() });
    expect(areaScope(run(area("East"), ADJ), { areas })).toEqual({ chosen: new Set(["East"]), added: new Set(["Central"]) });
    expect(areaScope(run(HERE, ADJ), { areas, hereGroup: "Shibuya" })).toEqual({ chosen: new Set(["Shibuya"]), added: new Set(["Central"]) });
    expect(areaScope(run(area("Central"), ADJ), { areas })).toEqual({ chosen: new Set(["Central"]), added: new Set(["Shibuya", "East"]) });
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

describe("Nearby", () => {
  const at = { lat: 35.658, lng: 139.7016 }; // Shibuya station
  const rows = [
    place({ name: "here", lat: 35.658, lng: 139.7016 }),
    place({ name: "600 m", lat: 35.6634, lng: 139.7016 }),
    place({ name: "1.3 km", lat: 35.6697, lng: 139.7016 }),
  ];
  const near = (radius: number, opts: ApplyOptions = { position: at }) =>
    applyFilters(rows, run({ type: "setNearby", value: radius }), opts).map((p) => p.name);

  it("keeps the places within the radius of the position", () => {
    expect(near(500)).toEqual(["here"]);
    expect(near(1000)).toEqual(["here", "600 m"]);
    expect(near(1500)).toEqual(["here", "600 m", "1.3 km"]);
  });

  it("narrows nothing without a position", () => {
    expect(near(500, {})).toEqual(["here", "600 m", "1.3 km"]);
  });
});

describe("tapArea, on Tokyo's real areas", () => {
  const tokyo = areasOf("tokyo");
  const tap = (s: FilterState, chip: string, hereGroup?: string) => reduce(s, tapArea(s, chip, { areas: tokyo, ...(hereGroup ? { hereGroup } : {}) }));
  const look = (s: FilterState, chip: string, hereGroup?: string) => areaLook(s, chip, { areas: tokyo, ...(hereGroup ? { hereGroup } : {}) });
  const sorted = (s: FilterState) => [...s.areas].sort();

  it("walks the proposal's example: picks bring their neighbours, a tap on an added area freezes the rest", () => {
    let s = tap(run(ADJ), "Shibuya");
    // Daikanyama joined Shibuya's neighbours with the 2026-11-09 areas; the rest is the proposal's example.
    expect(["Harajuku", "Omotesando", "Aoyama", "Ebisu", "Tomigaya", "Daikanyama"].map((c) => look(s, c))).toEqual(Array(6).fill("added"));
    expect(look(s, "Shibuya")).toBe("picked");
    expect(look(s, "Ginza")).toBe("out");
    s = tap(s, "Ginza");
    expect(["Nihonbashi", "Hibiya", "Tokyo Station"].map((c) => look(s, c))).toEqual(Array(3).fill("added"));
    s = tap(s, "Ebisu");
    expect(s.adjacent).toBe(false);
    expect(look(s, "Ebisu")).toBe("out");
    expect(sorted(s)).toEqual(["Aoyama", "Daikanyama", "Ginza", "Harajuku", "Hibiya", "Nihonbashi", "Omotesando", "Shibuya", "Tokyo Station", "Tomigaya"]);
  });

  it("a picked area goes out, and its added neighbours with it", () => {
    let s = tap(tap(run(ADJ), "Shibuya"), "Ginza");
    s = tap(s, "Shibuya");
    expect(sorted(s)).toEqual(["Ginza"]);
    expect(look(s, "Harajuku")).toBe("out");
    expect(look(s, "Nihonbashi")).toBe("added");
    expect(s.adjacent).toBe(true);
  });

  it("Here's area counts as picked; tapping it turns Here off", () => {
    const s = run(HERE, ADJ);
    expect(look(s, "Shibuya", "Shibuya")).toBe("picked");
    expect(look(s, "Ebisu", "Shibuya")).toBe("added");
    const off = tap(s, "Shibuya", "Shibuya");
    expect([off.here, off.adjacent, off.areas.size]).toEqual([false, true, 0]);
  });

  it("freezing keeps Here on: its area stays in through Here, not as a pick", () => {
    const s = tap(run(HERE, ADJ), "Ebisu", "Shibuya");
    expect([s.here, s.adjacent]).toEqual([true, false]);
    expect(sorted(s)).toEqual(["Aoyama", "Daikanyama", "Harajuku", "Omotesando", "Tomigaya"]);
  });
});
