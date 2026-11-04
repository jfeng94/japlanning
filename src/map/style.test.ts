import { describe, expect, it } from "vitest";
import { atlasLayers, atlasStyle, KEPT_POI_KINDS, SOURCE_ID } from "./style.ts";

type AnyLayer = { id: string; type: string; "source-layer"?: string; filter?: unknown };

describe("atlasLayers", () => {
  const light = atlasLayers("light") as AnyLayer[];

  it("drops buildings and address labels", () => {
    expect(light.some((l) => l["source-layer"] === "buildings")).toBe(false);
    expect(light.some((l) => l.id === "address_label")).toBe(false);
  });

  it("keeps roads, rail, water, parks and place labels", () => {
    const ids = new Set(light.map((l) => l.id));
    for (const id of ["roads_major", "roads_minor", "roads_rail", "water", "landuse_park", "places_subplace", "roads_labels_major"]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("restricts POIs to transport kinds", () => {
    const pois = light.find((l) => l.id === "pois")!;
    expect(pois.filter).toEqual(["in", ["get", "kind"], ["literal", [...KEPT_POI_KINDS]]]);
  });

  it("every vector layer reads from the basemap source", () => {
    for (const l of light) {
      if (l.type !== "background") expect((l as { source?: string }).source, l.id).toBe(SOURCE_ID);
    }
  });

  it("dark flavour is a different palette with the same layer set", () => {
    const dark = atlasLayers("dark") as AnyLayer[];
    expect(dark.map((l) => l.id)).toEqual(light.map((l) => l.id));
    const bg = (f: AnyLayer[]) => (f.find((l) => l.type === "background") as { paint?: Record<string, unknown> }).paint?.["background-color"];
    expect(bg(dark)).not.toEqual(bg(light));
  });
});

describe("atlasStyle", () => {
  it("wires the pmtiles source, glyphs and sprite", () => {
    const s = atlasStyle({ pmtilesUrl: "https://example.test/basemap/tokyo.pmtiles", flavor: "light" });
    expect(s.version).toBe(8);
    expect((s.sources[SOURCE_ID] as { url: string }).url).toBe("pmtiles://https://example.test/basemap/tokyo.pmtiles");
    expect(s.glyphs).toContain("{fontstack}/{range}.pbf");
    expect(s.sprite).toBe("https://protomaps.github.io/basemaps-assets/sprites/v4/light");
    expect(s.layers.length).toBeGreaterThan(50);
  });
});
