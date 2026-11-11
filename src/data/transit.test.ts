import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSIT_LINES, TRANSIT_REGIONS } from "../config/transit.ts";
import {
  findStation,
  isStationSelection,
  lineFilter,
  normaliseStation,
  STATION_SELECTION,
  stationFilter,
  stationRegion,
  type TransitData,
  type TransitLineProps,
  type TransitStationProps,
} from "./transit.ts";

const built = (region: string): TransitData =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../../public/transit", `${region}.geojson`), "utf8")) as TransitData;

describe("the transit config", () => {
  it("names each line once, with a hex colour and a source", () => {
    expect(new Set(TRANSIT_LINES.map((l) => l.id)).size).toBe(TRANSIT_LINES.length);
    for (const l of TRANSIT_LINES) {
      expect(l.colour, l.id).toMatch(/^#[0-9A-F]{6}$/i);
      expect(l.source, l.id).not.toBe("");
    }
    expect(TRANSIT_REGIONS).toEqual(["tokyo", "kyoto"]);
  });
});

describe.each(TRANSIT_REGIONS.map((r) => [r]))("public/transit/%s.geojson (npm run transit)", (region) => {
  const data = built(region);
  const lines = data.features.filter((f) => f.properties.kind === "line").map((f) => f as typeof f & { properties: TransitLineProps });
  const stations = data.features.filter((f) => f.properties.kind === "station").map((f) => f as typeof f & { properties: TransitStationProps });

  it("has every configured line, in its colour, with track", () => {
    for (const l of TRANSIT_LINES.filter((x) => x.region === region)) {
      const f = lines.find((x) => x.properties.id === l.id);
      expect(f, l.id).toBeDefined();
      expect(f!.properties.colour).toBe(l.colour);
      expect(f!.properties.code).toBe(l.code);
      expect((f!.geometry as { coordinates: unknown[] }).coordinates.length, l.id).toBeGreaterThan(10);
    }
  });

  it("gives every station a name and only configured lines", () => {
    const ids = new Set(lines.map((l) => l.properties.id));
    for (const s of stations) {
      expect(s.properties.en, s.properties.name).not.toBe("");
      expect(s.properties.lines.length, s.properties.name).toBeGreaterThan(0);
      for (const id of s.properties.lines) expect(ids.has(id), `${s.properties.name}: ${id}`).toBe(true);
    }
  });

  it("gives every station a unique id in its region, which finds it again", () => {
    const seen = new Set<string>();
    for (const s of stations) {
      expect(s.properties.id.startsWith(`${region}:`), s.properties.id).toBe(true);
      expect(seen.has(s.properties.id), s.properties.id).toBe(false);
      seen.add(s.properties.id);
      const selection = STATION_SELECTION + s.properties.id;
      expect(stationRegion(selection)).toBe(region);
      expect(findStation(data, selection)?.props.name).toBe(s.properties.name);
    }
  });
});

describe("station selections", () => {
  it("are told apart from place ids by their prefix", () => {
    expect(isStationSelection("station:tokyo:渋谷")).toBe(true);
    expect(isStationSelection("drinks:12")).toBe(false);
    expect(isStationSelection(undefined)).toBe(false);
  });

  it("find nothing for an unknown station or before the data loads", () => {
    expect(findStation(built("tokyo"), "station:tokyo:nowhere")).toBeUndefined();
    expect(findStation(undefined, "station:tokyo:渋谷")).toBeUndefined();
  });

  it("find Shibuya with its lines", () => {
    const shibuya = findStation(built("tokyo"), "station:tokyo:渋谷");
    expect(shibuya?.props.en).toBe("Shibuya");
    expect(shibuya?.props.lines).toEqual(["ginza", "hanzomon", "fukutoshin"]);
  });
});

describe("stations, checked against the lines' own counts (update on purpose)", () => {
  const count = (region: string, id: string) =>
    built(region).features.filter((f) => f.properties.kind === "station" && (f.properties as TransitStationProps).lines.includes(id)).length;

  it("finds every station of lines wholly inside the map box", () => {
    expect(count("tokyo", "ginza")).toBe(19);
    expect(count("tokyo", "marunouchi")).toBe(28);
    expect(count("tokyo", "asakusa")).toBe(20);
    expect(count("tokyo", "hanzomon")).toBe(14);
    expect(count("kyoto", "karasuma")).toBe(15);
    expect(count("kyoto", "kyoto-tozai")).toBe(17);
  });

  it("puts interchanges on all their lines, and through-running stops on none of ours", () => {
    const at = (name: string) =>
      (built("tokyo").features.find((f) => f.properties.kind === "station" && (f.properties as TransitStationProps).name === name)?.properties as
        | TransitStationProps
        | undefined)?.lines;
    expect(at("表参道")).toEqual(["ginza", "chiyoda", "hanzomon"]);
    expect(at("大手町")).toEqual(["marunouchi", "tozai", "chiyoda", "hanzomon", "mita"]);
    expect(at("三軒茶屋")).toBeUndefined(); // the Hanzomon runs on to it as the Tokyu Den-en-toshi line
    expect(at("向原")).toBeUndefined(); // a tram stop right over the Marunouchi line
  });
});

describe("normaliseStation", () => {
  it("drops aliases, notes and 駅, and spells the small ケ one way", () => {
    expect(normaliseStation("明治神宮前〈原宿〉")).toBe("明治神宮前");
    expect(normaliseStation("押上（スカイツリー前）")).toBe("押上");
    expect(normaliseStation("渋谷駅")).toBe("渋谷");
    expect(normaliseStation("市ヶ谷")).toBe(normaliseStation("市ケ谷"));
  });
});

describe("the hide filters", () => {
  it("hide lines by id", () => {
    expect(lineFilter(new Set(["ginza"]))).toEqual(["all", ["==", ["get", "kind"], "line"], ["!", ["in", ["get", "id"], ["literal", ["ginza"]]]]]);
  });

  it("keep a station while any of its lines shows; none shown, none kept", () => {
    expect(stationFilter(new Set(["ginza"]), ["ginza", "oedo"])).toEqual([
      "all",
      ["==", ["get", "kind"], "station"],
      ["any", ["in", "oedo", ["get", "lines"]], false],
    ]);
    expect(stationFilter(new Set(["ginza", "oedo"]), ["ginza", "oedo"])).toEqual(["all", ["==", ["get", "kind"], "station"], ["any", false]]);
  });
});
