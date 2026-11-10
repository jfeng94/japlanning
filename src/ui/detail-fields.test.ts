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
    expect(f.notes).toBe("Queues on weekends.");
    expect(f.details.map((s) => s.title)).toEqual(["Details", "Also in the sheet"]);
    expect(f.details[0]!.rows).toEqual([
      { label: "Format", value: "Café" },
      { label: "Specialty", value: "Pour-over, Espresso" },
      { label: "Hours checked", value: "2026-11-04" },
    ]);
    expect(f.details[1]!.rows).toEqual([{ label: "Floor", value: "2F" }]);
  });

  it("badges hours on the Hours row unless they were verified (docs/proposals/content-pass.md)", () => {
    const unverified = detailFields(place({ name: "x", hours: "8:00–18:00" }), layer);
    expect(unverified.essentials).toEqual([{ label: "Hours", value: "8:00–18:00", flag: "unverified" }]);
    const verified = detailFields(place({ name: "x", hours: "8:00–18:00", lastVerified: "2026-11-10" }), layer);
    expect(verified.essentials).toEqual([{ label: "Hours", value: "8:00–18:00" }]);
  });

  it("puts the rating snapshot first and keeps its columns out of the extras; branch leads the details", () => {
    const f = detailFields(
      place({ name: "Onibus", branch: "Yakumo", facets: { Format: ["Café"] }, extra: { "Google rating": "4.3", "Google reviews": "227", "Rated on": "2026-11-04", Floor: "1F" } }),
      layer,
    );
    expect(f.rating).toEqual({ value: "4.3", count: "227", on: "2026-11-04" });
    expect(f.notes).toBeUndefined();
    expect(f.details.find((s) => s.title === "Details")!.rows).toEqual([
      { label: "Branch", value: "Yakumo" },
      { label: "Format", value: "Café" },
    ]);
    expect(f.details.find((s) => s.title === "Also in the sheet")!.rows).toEqual([{ label: "Floor", value: "1F" }]);
    expect(detailFields(place({ name: "x" }), layer).rating).toBeUndefined();
  });

  it("sparse place: blanks are omitted, including every section; the hours say they're unknown", () => {
    const f = detailFields(place({ name: "Mystery", facets: {} }), layer);
    expect(f.essentials).toEqual([{ label: "Hours", value: "Hours unknown", flag: "unknown" }]);
    expect(f.chips).toEqual([]);
    expect(f.details).toEqual([]);
  });

  it("lists only the facets with a value", () => {
    const f = detailFields(place({ name: "Partial", facets: { Format: [], Specialty: ["Espresso"] } }), layer);
    const details = f.details.find((s) => s.title === "Details")!;
    expect(details.rows).toEqual([{ label: "Specialty", value: "Espresso" }]);
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
    expect(f.details).toEqual([]);
  });
});
