import { describe, expect, it } from "vitest";
import drinksCsv from "../../data/drinks.csv?raw";
import lodgingCsv from "./__fixtures__/stub-lodging.csv?raw";
import { layers } from "../config/layers.ts";
import { areasOf, regionById, regionOptions } from "../config/regions.ts";
import { inBbox } from "../geo/distance.ts";
import { areaAt, areaIndex, wardFromAddress } from "./areas.ts";
import { ParseError, parseLayerCsv, slug, splitMulti } from "./parse.ts";
import type { LayerConfig, LayerId } from "./types.ts";

const coffee = layers.find((l) => l.id === "drinks")!;

/** A second layer with a different schema. Not in LAYER_IDS on purpose. */
const lodging: LayerConfig = {
  id: "stub-lodging" as LayerId,
  region: "tokyo",
  label: "Lodging",
  dataUrl: "https://example.invalid/lodging.csv",
  color: "#333",
  icon: "bed",
  hasHours: false,
  facets: [{ column: "Style", values: ["Hotel", "Ryokan", "Hostel"] }],
};

/** Minimal layer for inline CSV edge cases. */
const minimal: LayerConfig = {
  ...lodging,
  id: "stub-minimal" as LayerId,
  facets: [{ column: "Kind", values: ["A", "B"] }],
};

const csv = (lines: string[]) => lines.join("\n") + "\n";

describe("drinks data (the repo file, so every test run validates it)", () => {
  const { places, warnings } = parseLayerCsv(drinksCsv, coffee, regionOptions());

  it("parses every row with no warnings", () => {
    expect(places).toHaveLength(74);
    expect(warnings).toEqual([]);
  });

  it("puts every place inside its region's map box, which is all the offline map covers (else grow the bbox; docs/design/adding-places.md)", () => {
    const outside = places
      .filter((p) => {
        const bbox = regionById(p.region).bbox;
        return bbox !== undefined && !inBbox(p, bbox);
      })
      .map((p) => `${p.name}${p.branch ? ` ${p.branch}` : ""} (${p.region})`);
    expect(outside).toEqual([]);
  });

  it("matches the profile of the data (update these when rows change on purpose)", () => {
    expect(places.filter((p) => p.starred)).toHaveLength(12);
    expect(places.filter((p) => p.addressApproximate)).toHaveLength(11);
    expect(places.filter((p) => p.hoursOsm === undefined)).toHaveLength(19);
    expect(places.filter((p) => p.lastVerified === undefined)).toHaveLength(33);
    expect(places.filter((p) => p.facets["Format"]!.length === 0)).toHaveLength(4);
    expect(places.filter((p) => p.facets["Reservation"]!.length === 0)).toHaveLength(40);
    expect(places.filter((p) => p.region === "kyoto")).toHaveLength(13);
  });

  it("reads the key branch from the Key column, the id from ID and the branch from Branch", () => {
    const glitch = places.find((p) => p.name === "Glitch Coffee & Roasters")!;
    expect(glitch.starred).toBe(true);
    expect(glitch.branch).toBe("Jimbocho");
    expect(glitch.id).toBe("drinks:1");
    expect(glitch.facets["Specialty"]).toEqual(["Light roast / Nordic"]);
    expect(glitch.lastVerified).toBe("2026-11-04");
  });

  it("lands only the rating snapshot columns in extra (they have no UI yet)", () => {
    const allowed = new Set(["Google rating", "Google reviews", "Rated on"]);
    expect(places.every((p) => Object.keys(p.extra).every((k) => allowed.has(k)))).toBe(true);
    expect(places.filter((p) => p.extra["Google rating"] !== undefined)).toHaveLength(43);
  });

  it("gives every place a raw area in the ward its address names, and a chip", () => {
    const { areasFor } = regionOptions();
    for (const p of places) {
      const areas = areasFor(p.region)!;
      expect(p.area, p.name).toBeDefined();
      expect(p.areaGroup, p.name).toBe(areas.groupOf(p.area!));
      // Every address yields a ward, so the parser's ward check never passes by skipping.
      expect(wardFromAddress(p.address), p.name).toBe(areas.wardOf(p.area!));
    }
  });

  it("gives every place a unique id", () => {
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
  });

  it("gives every place its kind (the category chips select on it)", () => {
    expect(places.filter((p) => p.kinds.length === 0).map((p) => p.name)).toEqual([]);
    expect(places.filter((p) => p.kinds.includes("Coffee"))).toHaveLength(57);
    expect(places.filter((p) => p.kinds.includes("Tea"))).toHaveLength(17);
  });

  it("Here picks the expected area at a few landmarks", () => {
    const tokyo = places.filter((p) => p.region === "tokyo");
    const here = (lat: number, lng: number) => areaAt(areasOf("tokyo"), tokyo, { lat, lng }, { bbox: regionById("tokyo").bbox! });
    expect(here(35.658, 139.7016)).toBe("Shibuya"); // Shibuya station
    expect(here(35.6717, 139.765)).toBe("Ginza"); // Ginza 4-chome crossing
    expect(here(35.7148, 139.7967)).toBe("Asakusa"); // Sensō-ji
    expect(here(35.6436, 139.6694)).toBe("Sangenjaya"); // Sangenjaya station
    expect(here(37.7749, -122.4194)).toBeUndefined(); // San Francisco
  });
});

describe("lodging fixture (different schema, deliberate problems)", () => {
  const { places, warnings } = parseLayerCsv(lodgingCsv, lodging);

  it("keeps the good rows and skips the bad coordinate row", () => {
    expect(places.map((p) => p.name)).toEqual([
      "Book Hotel Jimbocho",
      "Asakusa Ryokan",
      "Harajuku Hostel",
      "Book Hotel Jimbocho",
      "Nakameguro Flat",
    ]);
    expect(warnings).toContainEqual({
      row: 5,
      column: "Longitude",
      message: "Shinjuku Tower: bad or missing coordinates; row skipped",
    });
  });

  it("finds columns by header regardless of order", () => {
    const hotel = places[0]!;
    expect(hotel.lat).toBeCloseTo(35.696, 3);
    expect(hotel.lng).toBeCloseTo(139.758, 3);
    expect(hotel.link).toBe("https://example.com/jimbocho");
    expect(hotel.address).toBe("東京都千代田区神田神保町1-1");
  });

  it("puts unknown columns in extra, skipping blanks", () => {
    expect(places[0]!.extra).toEqual({ Who: "Jerry", Floor: "7" });
    expect(places[2]!.extra).toEqual({ Who: "Alex" });
    expect(places[4]!.extra).toEqual({});
  });

  it("leaves missing optional columns undefined", () => {
    expect(places[0]!.hours).toBeUndefined();
    expect(places[0]!.hoursOsm).toBeUndefined();
    expect(places[0]!.area).toBeUndefined();
    expect(places[0]!.lastVerified).toBeUndefined();
  });

  it("splits multi-value cells and warns on unlisted values", () => {
    const ryokan = places[1]!;
    expect(ryokan.facets["Style"]).toEqual(["Ryokan", "Onsen"]);
    expect(warnings).toContainEqual({
      row: 2,
      column: "Style",
      message: 'Asakusa Ryokan: Style "Onsen" is not a configured value',
    });
  });

  it("handles the approximate-address marker", () => {
    const ryokan = places[1]!;
    expect(ryokan.addressApproximate).toBe(true);
    expect(ryokan.address).toBe("東京都台東区浅草");
    expect(places[0]!.addressApproximate).toBe(false);
  });

  it("suffixes duplicate ids and warns", () => {
    expect(places[0]!.id).toBe("stub-lodging:book-hotel-jimbocho");
    expect(places[3]!.id).toBe("stub-lodging:book-hotel-jimbocho-2");
    expect(warnings).toContainEqual({
      row: 4,
      column: "Name",
      message: "Book Hotel Jimbocho: duplicate name; id suffixed",
    });
  });

  it("blank facet cell means unknown, not a value", () => {
    expect(places[4]!.facets["Style"]).toEqual(["Hotel"]);
    const { places: p2 } = parseLayerCsv(
      csv(["Name,Latitude,Longitude,Style", "X,35.6,139.7,"]),
      lodging,
    );
    expect(p2[0]!.facets["Style"]).toEqual([]);
  });
});

describe("edge cases", () => {
  it("throws when a required column is missing", () => {
    expect(() => parseLayerCsv(csv(["Name,Latitude", "X,35.6"]), minimal)).toThrow(ParseError);
    expect(() => parseLayerCsv(csv(["Name,Latitude", "X,35.6"]), minimal)).toThrow(/Longitude/);
  });

  it("skips rows with a blank name", () => {
    const { places, warnings } = parseLayerCsv(
      csv(["Name,Latitude,Longitude", ",35.6,139.7", "Y,35.6,139.7"]),
      minimal,
    );
    expect(places.map((p) => p.name)).toEqual(["Y"]);
    expect(warnings[0]).toMatchObject({ row: 1, column: "Name" });
  });

  it("rejects coordinates outside Japan or non-numeric", () => {
    const { places, warnings } = parseLayerCsv(
      csv([
        "Name,Latitude,Longitude",
        "ok,35.6,139.7",
        "swapped,139.7,35.6",
        "text,abc,139.7",
        "blank,,139.7",
      ]),
      minimal,
    );
    expect(places.map((p) => p.name)).toEqual(["ok"]);
    expect(warnings).toHaveLength(3);
  });

  it("strips the full-width approximate marker", () => {
    const { places } = parseLayerCsv(
      csv(["Name,Latitude,Longitude,Address (JA)", "X,35.6,139.7,～東京都渋谷区"]),
      minimal,
    );
    expect(places[0]!.addressApproximate).toBe(true);
    expect(places[0]!.address).toBe("東京都渋谷区");
  });

  it("ignores a Last verified that is not a real YYYY-MM-DD date, with a warning", () => {
    const { places, warnings } = parseLayerCsv(
      csv([
        "Name,Latitude,Longitude,Last verified",
        "good,35.6,139.7,2026-02-28",
        "slash,35.6,139.7,2026/02/28",
        "impossible,35.6,139.7,2026-02-30",
      ]),
      minimal,
    );
    expect(places.map((p) => p.lastVerified)).toEqual(["2026-02-28", undefined, undefined]);
    expect(warnings.map((w) => w.row)).toEqual([2, 3]);
  });

  it("warns on an area that is blank, unknown, or in another ward than the address; maps a raw area to its chip", () => {
    const areas = areaIndex({
      areas: [
        { label: "Ginza", ward: "中央区", adjacent: [] },
        { label: "Tsukiji", ward: "中央区", adjacent: [] },
      ],
      areaGroups: [{ label: "Ginza", areas: ["Ginza", "Tsukiji"] }],
    });
    const { places, warnings } = parseLayerCsv(
      csv([
        "Name,Latitude,Longitude,Area,Address (JA)",
        "Turret,35.6,139.7,Tsukiji,東京都中央区築地2-12-6",
        "Blank,35.6,139.7,,",
        "Atlantis,35.6,139.7,Atlantis,",
        "Wrong ward,35.6,139.7,Ginza,東京都港区芝5-14-16",
      ]),
      minimal,
      { areasFor: () => areas },
    );
    expect(places.map((p) => [p.name, p.area, p.areaGroup])).toEqual([
      ["Turret", "Tsukiji", "Ginza"],
      ["Blank", undefined, undefined],
      ["Atlantis", undefined, undefined],
      ["Wrong ward", "Ginza", "Ginza"],
    ]);
    expect(warnings.map((w) => [w.row, w.column, w.message])).toEqual([
      [2, "Area", "Blank: Area is blank"],
      [3, "Area", 'Atlantis: Area "Atlantis" is not one of tokyo\'s areas'],
      [4, "Area", "Wrong ward: the address is in 港区, but Ginza is in 中央区"],
    ]);
  });

  it("trims header whitespace and ignores a UTF-8 BOM", () => {
    const { places } = parseLayerCsv(
      "﻿ Name , Latitude,Longitude \nX,35.6,139.7\n",
      minimal,
    );
    expect(places).toHaveLength(1);
  });

  it("reads Kind for a layer with kinds (blank and unknown values warn); one without leaves it in extra", () => {
    const withKinds: LayerConfig = { ...minimal, kinds: ["Coffee", "Tea", "Bar"], facets: [] };
    const { places, warnings } = parseLayerCsv(
      csv(["Name,Latitude,Longitude,Kind", "a,35.6,139.7,Tea; Coffee", "b,35.6,139.7,", "c,35.6,139.7,Juice;Bar"]),
      withKinds,
    );
    expect(places.map((p) => p.kinds)).toEqual([["Coffee", "Tea"], [], ["Bar"]]);
    expect(warnings.map((w) => [w.row, w.column, w.message])).toEqual([
      [2, "Kind", "b: Kind is blank"],
      [3, "Kind", 'c: Kind "Juice" is not one of Coffee, Tea, Bar'],
    ]);
    const without = parseLayerCsv(csv(["Name,Latitude,Longitude,Kind", "a,35.6,139.7,Hotel"]), lodging);
    expect(without.places[0]!.kinds).toEqual([]);
    expect(without.places[0]!.extra).toEqual({ Kind: "Hotel" });
  });

  it("reads the Icon column and drops unknown icons with a warning", () => {
    const { places, warnings } = parseLayerCsv(
      csv(["Name,Latitude,Longitude,Icon", "a,35.6,139.7,coffee", "b,35.6,139.7,", "c,35.6,139.7,teapot"]),
      minimal,
      { icons: ["coffee", "tea"] },
    );
    expect(places.map((p) => p.icon)).toEqual(["coffee", undefined, undefined]);
    expect(warnings).toEqual([{ row: 3, column: "Icon", message: 'c: Icon "teapot" is not a known icon; using the layer default' }]);
  });

  it("keeps any Icon value when no icon list is given", () => {
    const { places, warnings } = parseLayerCsv(csv(["Name,Latitude,Longitude,Icon", "a,35.6,139.7,anything"]), minimal);
    expect(places[0]!.icon).toBe("anything");
    expect(warnings).toEqual([]);
  });

  it("treats a star-only name as blank", () => {
    const { places, warnings } = parseLayerCsv(csv(["Name,Latitude,Longitude", "★,35.6,139.7"]), minimal);
    expect(places).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("splitMulti", () => {
    expect(splitMulti(undefined)).toEqual([]);
    expect(splitMulti("")).toEqual([]);
    expect(splitMulti("Pour-over")).toEqual(["Pour-over"]);
    expect(splitMulti(" Pour-over ;Espresso; ;")).toEqual(["Pour-over", "Espresso"]);
  });

  it("slug keeps letters in any script and collapses the rest", () => {
    expect(slug("Glitch Coffee & Roasters (Jimbocho)")).toBe("glitch-coffee-roasters-jimbocho");
    expect(slug("Fuglen Tokyo")).toBe("fuglen-tokyo");
    expect(slug("カフェ・ド・ランブル")).toBe("カフェ-ド-ランブル");
    expect(slug("  -- Café --  ")).toBe("café");
  });
});

describe("ID and Branch columns", () => {
  const header = "ID,Name,Branch,Latitude,Longitude";

  it("uses the integer ID for the place id and keeps the branch", () => {
    const { places, warnings, columns } = parseLayerCsv(
      csv([header, "7,Onibus Coffee,Yakumo,35.6,139.7", "12,Onibus Coffee,Jiyugaoka,35.6,139.7"]),
      minimal,
    );
    expect(places.map((p) => p.id)).toEqual(["stub-minimal:7", "stub-minimal:12"]);
    expect(places.map((p) => p.branch)).toEqual(["Yakumo", "Jiyugaoka"]);
    expect(warnings).toEqual([]);
    expect(columns).toEqual(["ID", "Name", "Branch", "Latitude", "Longitude"]);
  });

  it("falls back to the name id, with a warning on the ID column, for blank, non-integer and repeated IDs", () => {
    const { places, warnings } = parseLayerCsv(
      csv([header, ",A,,35.6,139.7", "x,B,,35.6,139.7", "4,C,,35.6,139.7", "4,C,,35.6,139.7", "0,D,,35.6,139.7"]),
      minimal,
    );
    expect(places.map((p) => p.id)).toEqual([
      "stub-minimal:a",
      "stub-minimal:b",
      "stub-minimal:4",
      "stub-minimal:c",
      "stub-minimal:d",
    ]);
    expect(warnings.filter((w) => w.column === "ID").map((w) => w.row)).toEqual([1, 2, 4, 5]);
    expect(warnings).toContainEqual({ row: 4, column: "ID", message: "C: ID 4 is already used by another row; using the name as id" });
  });

  it("without an ID column, ids still come from names", () => {
    const { places, warnings, columns } = parseLayerCsv(csv(["Name,Latitude,Longitude", "Sidewalk Stand,35.6,139.7"]), minimal);
    expect(places[0]!.id).toBe("stub-minimal:sidewalk-stand");
    expect(places[0]!.branch).toBeUndefined();
    expect(warnings).toEqual([]);
    expect(columns).not.toContain("ID");
  });
});

describe("Key column", () => {
  const header = "Name,Latitude,Longitude,Key";
  const rows = (...r: string[]) => parseLayerCsv(csv([header, ...r]), minimal);

  it("marks the key branch from the column, with checkbox and ★ spellings", () => {
    const { places, warnings } = rows("A,35.6,139.7,★", "B,35.6,139.7,TRUE", "C,35.6,139.7,yes", "D,35.6,139.7,", "E,35.6,139.7,FALSE");
    expect(places.map((p) => p.starred)).toEqual([true, true, true, false, false]);
    expect(warnings).toEqual([]);
  });

  it("still honours the ★ prefix and warns on an unknown Key value", () => {
    const { places, warnings } = rows("★ A,35.6,139.7,", "B,35.6,139.7,maybe");
    expect(places.map((p) => [p.name, p.starred])).toEqual([["A", true], ["B", false]]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ row: 2, column: "Key" });
  });
});

describe("Region column (a layer without a fixed region)", () => {
  const spanning: LayerConfig = { ...minimal, region: undefined };
  const header = "Name,Latitude,Longitude,Region,Area";

  it("takes each row's region from the cell and validates the area against that region", () => {
    const { places, warnings } = parseLayerCsv(
      csv([header, "A,35.6,139.7,tokyo,Ginza", "B,35.0,135.7,kyoto,Uji", "C,35.6,139.7,tokyo,Atlantis"]),
      spanning,
      regionOptions(),
    );
    expect(places.map((p) => [p.name, p.region])).toEqual([["A", "tokyo"], ["B", "kyoto"], ["C", "tokyo"]]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ row: 3, column: "Area" });
  });

  it("skips a row with a blank or unknown region, with a warning on the Region column", () => {
    const { places, warnings } = parseLayerCsv(csv([header, "A,35.6,139.7,,", "B,35.6,139.7,atlantis,", "C,35.6,139.7,hakone,"]), spanning, regionOptions());
    expect(places.map((p) => p.name)).toEqual(["C"]);
    expect(warnings.map((w) => [w.row, w.column])).toEqual([[1, "Region"], [2, "Region"]]);
  });

  it("ignores the column when the layer has a fixed region", () => {
    const { places, warnings } = parseLayerCsv(csv([header, "A,35.6,139.7,kyoto,Ginza"]), minimal, regionOptions());
    expect(places[0]!.region).toBe("tokyo");
    expect(warnings).toEqual([]);
  });
});
