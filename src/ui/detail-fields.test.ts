import { describe, expect, it } from "vitest";
import type { LayerConfig } from "../data/types.ts";
import { coffee, place } from "../filter/testing.ts";
import { detailFields } from "./detail-fields.ts";

const layer: LayerConfig = { ...coffee, rowFacets: ["Format", "Specialty"] };

describe("detailFields", () => {
  it("full place: essentials, chips and every section in order", () => {
    const f = detailFields(
      place({
        name: "Glitch",
        address: "東京都千代田区神田錦町3-16",
        hours: "Weekdays 8–19",
        hoursOsm: "Mo-Fr 08:00-19:00",
        notes: "Queues on weekends.",
        lastVerified: "2026-11-04",
        facets: { Format: ["Café"], Specialty: ["Pour-over", "Espresso"] },
        extra: { Floor: "2F" },
      }),
      layer,
    );
    expect(f.essentials).toEqual([
      { label: "Address", value: "東京都千代田区神田錦町3-16" },
      { label: "Hours", value: "Weekdays 8–19" },
    ]);
    expect(f.chips).toEqual(["Café", "Pour-over", "Espresso"]);
    expect(f.details.map((s) => s.title)).toEqual(["Notes", "Details", "Also in the sheet", "Verified"]);
    expect(f.details[1]!.rows).toEqual([
      { label: "Format", value: "Café" },
      { label: "Specialty", value: "Pour-over, Espresso" },
    ]);
    expect(f.details[2]!.rows).toEqual([{ label: "Floor", value: "2F" }]);
    expect(f.details[3]!.rows).toEqual([{ label: "Last verified", value: "2026-11-04" }]);
  });

  it("sparse place: blanks are omitted except hours and verification, which say so", () => {
    const f = detailFields(place({ name: "Mystery", facets: {} }), layer);
    expect(f.essentials).toEqual([{ label: "Hours", value: "Hours unknown", flag: "unknown" }]);
    expect(f.chips).toEqual([]);
    expect(f.details.map((s) => s.title)).toEqual(["Details", "Verified"]);
    expect(f.details[0]!.rows.every((r) => r.value === "Unknown" && r.flag === "unknown")).toBe(true);
    expect(f.details[1]!.rows).toEqual([{ label: "Last verified", value: "Hours unverified", flag: "unverified" }]);
  });

  it("flags an approximate address", () => {
    const f = detailFields(place({ name: "x", address: "東京都台東区浅草", addressApproximate: true }), layer);
    expect(f.essentials[0]).toEqual({ label: "Address", value: "東京都台東区浅草", flag: "approximate" });
  });

  it("falls back to the first two facets as chips when the layer names none", () => {
    const f = detailFields(place({ name: "x", facets: { Format: ["Stand"], Specialty: ["Espresso"] } }), { ...coffee, rowFacets: undefined });
    expect(f.chips).toEqual(["Stand", "Espresso"]);
  });

  it("works with no layer at all", () => {
    const f = detailFields(place({ name: "x" }), undefined);
    expect(f.chips).toEqual([]);
    expect(f.details.map((s) => s.title)).toEqual(["Verified"]);
  });
});
