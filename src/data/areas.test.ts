import { describe, expect, it } from "vitest";
import { regionById, regions } from "../config/regions.ts";
import { areaIndex, areaProblems, wardFromAddress } from "./areas.ts";

describe("the configured areas", () => {
  it.each(regions.map((r) => [r.id, r] as const))("%s: neighbours symmetric, merges and labels sound", (_id, region) => {
    expect(areaProblems(region)).toEqual([]);
  });

  it("Tokyo: 33 raw areas, 26 chips under five headings; Kyoto: one flat list of 7", () => {
    const tokyo = areaIndex(regionById("tokyo"));
    expect(tokyo.raw).toHaveLength(33);
    expect(tokyo.chips).toHaveLength(26);
    expect(tokyo.sections.map((s) => [s.label, s.chips.length])).toEqual([
      ["Central", 6],
      ["Shibuya", 7],
      ["Shinjuku", 2],
      ["Meguro · Setagaya", 6],
      ["East", 5],
    ]);
    // A merge across a ward boundary sits under its first-named area's ward: Kuramae (台東区) + Honjo (墨田区).
    expect(tokyo.sections.find((s) => s.label === "East")!.chips.map((c) => c.label)).toContain("Kuramae");
    const kyoto = areaIndex(regionById("kyoto"));
    expect(kyoto.sections).toEqual([{ chips: kyoto.chips }]);
    expect(kyoto.chips).toHaveLength(7);
  });

  it("a merged chip reaches through its members: Kuramae + nearby gets Asakusa, Oshiage and Nihonbashi", () => {
    const tokyo = areaIndex(regionById("tokyo"));
    expect([...tokyo.neighbours(["Kuramae"])].sort()).toEqual(["Asakusa", "Nihonbashi", "Oshiage"]);
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
