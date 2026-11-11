import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSIT_LINES, TRANSIT_REGIONS } from "../config/transit.ts";
import {
  findStation,
  isStationSelection,
  lineFilter,
  lineNeighbours,
  normaliseStation,
  STATION_SELECTION,
  stationFilter,
  stationRegion,
  type StationsFile,
  type TransitData,
  type TransitLineProps,
  type TransitStationProps,
} from "./transit.ts";

const built = (region: string): TransitData =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../../public/transit", `${region}.geojson`), "utf8")) as TransitData;
const builtStations = (region: string): StationsFile =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../../public/transit", `${region}.stations.json`), "utf8")) as StationsFile;

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

describe.each(TRANSIT_REGIONS.map((r) => [r]))("public/transit/%s.stations.json (npm run stations)", (region) => {
  const geo = built(region);
  const file = builtStations(region);
  const stations = new Map(
    geo.features.flatMap((f) => (f.properties.kind === "station" ? [[f.properties.id, f.properties] as const] : [])),
  );

  it("orders every line's stations, each once, all of them on the line", () => {
    for (const l of TRANSIT_LINES.filter((x) => x.region === region)) {
      const order = file.order[l.id] ?? [];
      const main = order[0] ?? [];
      expect(new Set(main).size, l.id).toBe(main.length);
      const listed = new Set(order.flat());
      for (const id of listed) expect(stations.get(id)?.lines, `${l.id}: ${id}`).toContain(l.id);
      for (const [id, s] of stations) if (s.lines.includes(l.id)) expect(listed.has(id), `${l.id}: ${id}`).toBe(true);
    }
  });

  it("has times only for stations and lines it knows, from a credited source", () => {
    for (const [id, facts] of Object.entries(file.stations)) {
      expect(stations.has(id), id).toBe(true);
      for (const [lineId, lf] of Object.entries(facts.lines)) {
        expect(stations.get(id)!.lines, `${id}: ${lineId}`).toContain(lineId);
        expect(file.sources[lf.source], `${id}: ${lf.source}`).toBeDefined();
        expect(lf.from, `${id}: ${lineId}`).toMatch(/^\d{4}-\d\d-\d\d$/);
        expect(lf.directions.length, `${id}: ${lineId}`).toBeGreaterThan(0);
        for (const d of lf.directions) {
          expect(d.label, `${id}: ${lineId}`).toMatch(/^(to|via) \S/);
          for (const svc of [d.weekday, d.holiday]) {
            if (!svc) continue;
            expect(svc.first, `${id} ${d.label}`).toMatch(/^\d\d:\d\d$/);
            expect(svc.last, `${id} ${d.label}`).toMatch(/^\d\d:\d\d$/);
          }
        }
      }
    }
  });
});

describe("Toei's stations (public in ODPT)", () => {
  const geo = built("tokyo");
  const file = builtStations("tokyo");
  const toei = new Set(TRANSIT_LINES.filter((l) => l.odpt?.some((r) => r.startsWith("odpt.Railway:Toei."))).map((l) => l.id));

  it("all have their code and first and last trains", () => {
    for (const f of geo.features) {
      if (f.properties.kind !== "station") continue;
      for (const lineId of f.properties.lines.filter((x) => toei.has(x))) {
        const lf = file.stations[f.properties.id]?.lines[lineId];
        expect(lf, `${f.properties.id}: ${lineId}`).toBeDefined();
        expect(lf!.code, `${f.properties.id}: ${lineId}`).toMatch(/^[A-Z]-\d\d$/);
      }
    }
  });

  it("name directions as a visitor reads them, and say where a short last train stops", () => {
    const shinjuku = file.stations["tokyo:新宿"]!.lines;
    expect(shinjuku["shinjuku"]!.code).toBe("S-01");
    expect(shinjuku["shinjuku"]!.directions.map((d) => d.label)).toEqual(["to Motoyawata"]);
    expect(shinjuku["shinjuku"]!.directions[0]!.weekday).toMatchObject({ first: "05:00", lastTo: "Iwamotocho" });
    expect(file.stations["tokyo:六本木"]!.lines["oedo"]!.directions.map((d) => d.label)).toEqual(["to Hikarigaoka", "via Azabu-juban"]);
  });
});

describe("shared track and renamed platforms", () => {
  const stations = new Map(built("tokyo").features.flatMap((f) => (f.properties.kind === "station" ? [[f.properties.id, f.properties] as const] : [])));

  it("puts the Mita on the Namboku's track to Meguro", () => {
    expect(stations.get("tokyo:目黒")?.lines).toEqual(["namboku", "mita"]);
    expect(stations.get("tokyo:白金台")?.lines).toEqual(["namboku", "mita"]);
  });

  it("makes the Shinjuku Line's 新線新宿 platforms part of Shinjuku", () => {
    expect(stations.has("tokyo:新線新宿")).toBe(false);
    expect(stations.get("tokyo:新宿")?.lines).toEqual(["marunouchi", "shinjuku", "oedo"]);
  });

  it("draws shared track apart, so it can be dashed", () => {
    expect(lineFilter(new Set(), true)).toContainEqual(["has", "shared"]);
    expect(lineFilter(new Set(), false)).toContainEqual(["!", ["has", "shared"]]);
  });
});

describe("lineNeighbours (the station card's arrows)", () => {
  const order = builtStations("tokyo").order;

  it("step away from station 01, with nothing before it", () => {
    expect(lineNeighbours(order["ginza"], "tokyo:表参道")).toEqual({ prev: "tokyo:渋谷", next: "tokyo:外苑前" });
    expect(lineNeighbours(order["ginza"], "tokyo:渋谷")).toEqual({ next: "tokyo:表参道" });
    expect(lineNeighbours(order["asakusa"], "tokyo:西馬込").prev).toBeUndefined();
  });

  it("go round the Oedo's loop at Tochomae and on along its tail", () => {
    expect(lineNeighbours(order["oedo"], "tokyo:都庁前")).toEqual({ prev: "tokyo:新宿", next: "tokyo:西新宿五丁目" });
    expect(lineNeighbours(order["oedo"], "tokyo:新宿西口").prev).toBe("tokyo:都庁前");
  });

  it("let an earlier sequence win where two give a link", () => {
    expect(lineNeighbours([["a", "b", "c"], ["x", "b"]], "b")).toEqual({ prev: "a", next: "c" });
    expect(lineNeighbours([["a", "b"], ["b", "x"]], "b")).toEqual({ prev: "a", next: "x" });
    expect(lineNeighbours(undefined, "b")).toEqual({});
  });
});
