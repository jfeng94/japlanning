import { describe, expect, it } from "vitest";
import { regionById, regions } from "../config/regions.ts";
import { areaAt, areaIndex, areaProblems, wardFromAddress } from "./areas.ts";

describe("the configured areas", () => {
  it.each(regions.map((r) => [r.id, r] as const))("%s: neighbours symmetric, merges and labels sound", (_id, region) => {
    expect(areaProblems(region)).toEqual([]);
  });

  it("Tokyo: 81 raw areas, 68 chips under eight headings; Kyoto: 28 chips under seven; Nara and Hakone: flat lists", () => {
    const tokyo = areaIndex(regionById("tokyo"));
    expect(tokyo.raw).toHaveLength(81);
    expect(tokyo.chips).toHaveLength(68);
    expect(tokyo.sections.map((s) => [s.label, s.chips.length])).toEqual([
      ["Central", 15],
      ["Shibuya", 10],
      ["Shinjuku", 5],
      ["Meguro · Setagaya", 12],
      ["East", 15],
      ["North", 5],
      ["West", 4],
      ["South", 2],
    ]);
    // A merge across a ward boundary sits under its first-named area's ward: Kuramae (台東区) + Honjo (墨田区).
    expect(tokyo.sections.find((s) => s.label === "East")!.chips.map((c) => c.label)).toContain("Kuramae");
    const kyoto = areaIndex(regionById("kyoto"));
    expect(kyoto.chips).toHaveLength(28);
    expect(kyoto.sections.map((s) => s.label)).toEqual(["Downtown", "Higashiyama", "North", "Sakyo", "West", "South", "Uji"]);
    for (const flat of ["nara", "hakone"] as const) {
      const ix = areaIndex(regionById(flat));
      expect(ix.sections).toEqual([{ chips: ix.chips }]);
    }
  });

  it("a merged chip reaches through its members: Kuramae + nearby gets its neighbours' and Honjo's", () => {
    const tokyo = areaIndex(regionById("tokyo"));
    expect([...tokyo.neighbours(["Kuramae"])].sort()).toEqual(["Akihabara", "Asakusa", "Kappabashi", "Kinshicho", "Nihonbashi", "Oshiage", "Ueno"]);
  });
});

describe("areaIndex", () => {
  const region = {
    areas: [
      { label: "A", ward: "w1", adjacent: ["B"] },
      { label: "B", ward: "w2", adjacent: ["A", "C"] },
      { label: "C", ward: "w2", adjacent: ["B", "D"] },
      { label: "D", ward: "w3", adjacent: ["C"] },
    ],
    areaGroups: [{ label: "B·C", areas: ["B", "C"] }],
    areaSections: [{ label: "One", wards: ["w1"] }],
  };
  const idx = areaIndex(region);

  it("folds merged raw areas into one chip and maps raw labels to it", () => {
    expect(idx.chips.map((c) => c.label)).toEqual(["A", "B·C", "D"]);
    expect(idx.groupOf("C")).toBe("B·C");
    expect(idx.groupOf("A")).toBe("A");
    expect(idx.groupOf("Z")).toBeUndefined();
  });

  it("neighbours are one hop on the contracted graph, not everything connected", () => {
    expect([...idx.neighbours(["A"])]).toEqual(["B·C"]);
    expect([...idx.neighbours(["B·C"])].sort()).toEqual(["A", "D"]);
    expect([...idx.neighbours(["A", "B·C"])]).toEqual(["D"]);
  });

  it("a chip goes under its first member's ward; a ward no section names gets its own heading", () => {
    expect(idx.sections.map((s) => [s.label, s.chips.map((c) => c.label)])).toEqual([
      ["One", ["A"]],
      ["w2", ["B·C"]],
      ["w3", ["D"]],
    ]);
  });
});

describe("areaProblems", () => {
  it("names a one-way neighbour, an unknown one, an area in two merges and duplicate chip labels", () => {
    const problems = areaProblems({
      areas: [
        { label: "A", ward: "w", adjacent: ["B", "Z"] },
        { label: "B", ward: "w", adjacent: [] },
        { label: "C", ward: "w", adjacent: [] },
      ],
      areaGroups: [
        { label: "A", areas: ["B"] },
        { label: "X", areas: ["B", "C"] },
      ],
    });
    expect(problems).toEqual([
      "A lists B, but B does not list A",
      "A lists an unknown neighbour, Z",
      "B is in two merges, A and X",
      "two chips are labelled A",
    ]);
  });

  it("with sections, names a ward in none and a hue used twice", () => {
    const problems = areaProblems({
      areas: [
        { label: "A", ward: "一区", adjacent: [] },
        { label: "B", ward: "二区", adjacent: [] },
        { label: "C", ward: "三区", adjacent: [] },
      ],
      areaSections: [
        { label: "One", wards: ["一区"], hue: "red" },
        { label: "Two", wards: ["二区"], hue: "red" },
      ],
    });
    expect(problems).toEqual(["三区 is in no section; add it to one in areaSections", "two sections are red"]);
  });
});

describe("wardFromAddress", () => {
  it("reads the ward or city from Tokyo, Kyoto and Kanagawa addresses", () => {
    expect(wardFromAddress("東京都渋谷区神宮前5-11-13")).toBe("渋谷区");
    expect(wardFromAddress("東京都新宿区市谷田町2-7-15")).toBe("新宿区");
    expect(wardFromAddress("~東京都渋谷区渋谷1丁目")).toBe("渋谷区");
    expect(wardFromAddress("京都府京都市東山区清水2-258")).toBe("東山区");
    expect(wardFromAddress("京都府宇治市宇治妙楽51-2")).toBe("宇治市");
    expect(wardFromAddress("神奈川県足柄下郡箱根町湯本")).toBe("箱根町");
    expect(wardFromAddress(undefined)).toBeUndefined();
  });
});

describe("areaAt (Here)", () => {
  const index = areaIndex({
    areas: [
      { label: "Shibuya", ward: "渋谷区", adjacent: [] },
      { label: "Ginza", ward: "中央区", adjacent: ["Tsukiji"] },
      { label: "Tsukiji", ward: "中央区", adjacent: ["Ginza"] },
    ],
    areaGroups: [{ label: "Ginza", areas: ["Ginza", "Tsukiji"] }],
  });
  const places = [
    { area: "Shibuya", lat: 35.66, lng: 139.7 },
    { area: "Shibuya", lat: 35.662, lng: 139.702 },
    { area: "Ginza", lat: 35.671, lng: 139.765 },
    { area: "Tsukiji", lat: 35.665, lng: 139.77 },
    { area: undefined, lat: 35.7, lng: 139.7 },
  ];
  const tokyoBbox = [139.6, 35.58, 139.85, 35.75] as const;

  it("is the chip of the raw area with the nearest centre (the centroid of its places)", () => {
    expect(areaAt(index, places, { lat: 35.6605, lng: 139.7005 })).toBe("Shibuya");
    expect(areaAt(index, places, { lat: 35.6652, lng: 139.7702 })).toBe("Ginza"); // Tsukiji, merged into Ginza
  });

  it("is undefined farther than 2 km from every centre, or outside the bbox", () => {
    expect(areaAt(index, places, { lat: 35.7, lng: 139.7 })).toBeUndefined(); // ~4 km north of Shibuya; the area-less place doesn't count
    expect(areaAt(index, places, { lat: 35.7, lng: 139.7 }, { maxM: 5000 })).toBe("Shibuya");
    expect(areaAt(index, places, { lat: 37.77, lng: -122.42 }, { bbox: tokyoBbox, maxM: Infinity })).toBeUndefined();
    expect(areaAt(index, places, { lat: 35.6605, lng: 139.7005 }, { bbox: tokyoBbox })).toBe("Shibuya");
    expect(areaAt(index, [], { lat: 35.6605, lng: 139.7005 })).toBeUndefined();
  });
});
