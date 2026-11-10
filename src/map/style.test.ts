import { describe, expect, it } from "vitest";
import { atlasLayers, atlasStyle, DROPPED_LAYERS, KEPT_POI_KINDS, OWN_TRANSIT_REPLACES, QUIET_RAIL, quietHides, quietRailPaint, RAIL, railPaint, SOURCE_ID } from "./style.ts";

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

  it("restricts POIs to stations, named a little larger, busier stations first", () => {
    const pois = light.find((l) => l.id === "pois")! as AnyLayer & { layout: Record<string, unknown> };
    expect(KEPT_POI_KINDS).toEqual(["station"]);
    expect(pois.filter).toEqual(["in", ["get", "kind"], ["literal", ["station"]]]);
    expect(pois.layout["symbol-sort-key"]).toEqual(["get", "min_zoom"]);
    expect(pois.layout["text-size"]).toEqual(["interpolate", ["linear"], ["zoom"], 12, 10.5, 15, 12, 17, 13, 19, 16]);
  });

  it("drops what a trip atlas doesn't need (M8): land-use tints, boundaries, arrows, shields, minor road names, sea and island names, country and region names", () => {
    const ids = new Set(light.map((l) => l.id));
    for (const id of DROPPED_LAYERS) expect(ids.has(id), id).toBe(false);
    for (const id of ["landuse_hospital", "boundaries", "roads_oneway", "roads_shields", "roads_labels_minor", "places_country", "places_region"]) {
      expect(DROPPED_LAYERS.has(id), id).toBe(true);
    }
    // Ward and district names stay: they're how the group orients.
    for (const id of ["places_locality", "places_subplace", "roads_labels_major", "water_waterway_label"]) expect(ids.has(id), id).toBe(true);
  });

  it("draws rail above every road, before the first label, solid and heavier", () => {
    const at = (id: string) => light.findIndex((l) => l.id === id);
    const rail = at(RAIL);
    const lastRoad = Math.max(...light.map((l, i) => (l.id.startsWith("roads_") && l.id !== RAIL && l.type === "line" ? i : -1)));
    const firstLabel = light.findIndex((l) => l.type === "symbol");
    expect(rail).toBe(lastRoad + 1);
    expect(rail).toBeLessThan(firstLabel);
    const paint = (light[rail] as AnyLayer & { paint: Record<string, unknown> }).paint;
    expect(paint).toMatchObject(railPaint("light"));
  });

  it("hides service roads until zoom 15 and calms the land-use fills that stay", () => {
    const byId = (id: string) => light.find((l) => l.id === id) as AnyLayer & { minzoom?: number; paint: Record<string, unknown> };
    expect(byId("roads_minor_service").minzoom).toBe(15);
    expect(byId("roads_minor_service_casing").minzoom).toBe(15);
    expect(byId("landuse_urban_green").paint["fill-opacity"]).toBe(0.45);
    expect(byId("landuse_beach").paint["fill-opacity"]).toBe(0.6);
  });

  it("leaves out the basemap's rail and stations where our own subway lines are drawn, and nothing else", () => {
    const own = (atlasLayers("light", "en", true) as AnyLayer[]).map((l) => l.id);
    expect(own).not.toContain(RAIL);
    expect(own).not.toContain("pois");
    expect(own).toEqual(light.map((l) => l.id).filter((id) => !OWN_TRANSIT_REPLACES.has(id)));
  });

  it("lightens station names on the dark map, where Protomaps' blue doesn't read", () => {
    const dark = atlasLayers("dark") as (AnyLayer & { paint: Record<string, unknown> })[];
    expect(dark.find((l) => l.id === "pois")!.paint["text-color"]).toBe("#8fb0f5");
    const lightPois = light.find((l) => l.id === "pois") as AnyLayer & { paint: Record<string, unknown> };
    expect(lightPois.paint["text-color"]).not.toBe("#8fb0f5");
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

describe("the Area page's quiet basemap", () => {
  const light = atlasLayers("light") as (AnyLayer & { source?: string })[];
  const hidden = new Set(light.filter(quietHides).map((l) => l.id));

  it("hides every label and every road", () => {
    for (const l of light) {
      if (l.type === "symbol") expect(hidden.has(l.id), l.id).toBe(true);
      if (l.id.startsWith("roads_") && l.id !== QUIET_RAIL) expect(hidden.has(l.id), l.id).toBe(true);
    }
  });

  it("keeps land, water, parks and the rail lines", () => {
    for (const id of ["background", "earth", "water", "water_river", "landuse_park", "landuse_urban_green", QUIET_RAIL]) {
      expect(light.some((l) => l.id === id), id).toBe(true);
      expect(hidden.has(id), id).toBe(false);
    }
  });

  it("leaves our own layers alone", () => {
    expect(quietHides({ id: "pins-icon", type: "symbol", source: "pins" })).toBe(false);
    expect(quietHides({ id: "areas-label", type: "symbol", source: "areas-labels" })).toBe(false);
  });

  it("restyles only paint the rail layer already has", () => {
    const rail = light.find((l) => l.id === QUIET_RAIL) as { paint?: Record<string, unknown> };
    for (const prop of Object.keys(quietRailPaint("light"))) expect(rail.paint?.[prop], prop).toBeDefined();
  });
});

describe("atlasStyle", () => {
  it("wires the pmtiles source, glyphs and sprite", () => {
    const s = atlasStyle({ pmtilesUrl: "https://example.test/basemap/tokyo.pmtiles", flavor: "light", assetsOrigin: "https://example.test" });
    expect(s.version).toBe(8);
    expect((s.sources[SOURCE_ID] as { url: string }).url).toBe("pmtiles://https://example.test/basemap/tokyo.pmtiles");
    expect(s.glyphs).toBe("https://example.test/fonts/{fontstack}/{range}.pbf");
    expect(s.sprite).toBe("https://example.test/sprites/light");
    expect(s.layers.length).toBeGreaterThan(50);
  });
});
