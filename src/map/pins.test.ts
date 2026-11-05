import { describe, expect, it } from "vitest";
import type { LayerConfig, LayerId } from "../data/types.ts";
import { coffee, place } from "../filter/testing.ts";
import { pinsToGeoJson, placesToPins } from "./pins.ts";

const coffeeLayer: LayerConfig = { ...coffee, icon: "coffee", color: "#b5452b" };

describe("placesToPins", () => {
  it("carries name, position, layer colour and the mark", () => {
    const glitch = place({ name: "Glitch", starred: true, lat: 35.69, lng: 139.76 });
    const pins = placesToPins([glitch], [coffeeLayer], new Map([[glitch.id, "star" as const]]));
    expect(pins).toEqual([
      { id: expect.any(String), name: "Glitch", lat: 35.69, lng: 139.76, icon: "coffee", color: "#b5452b", mark: "star", layerId: "tokyo-coffee" },
    ]);
  });

  it("passes marks through to GeoJSON, with an empty string for none", () => {
    const [a, b] = [place({ name: "a" }), place({ name: "b" })];
    const pins = placesToPins([a, b], [coffeeLayer], new Map([[b.id, "closed" as const]]));
    expect(pins.map((p) => p.mark)).toEqual([undefined, "closed"]);
    expect(pinsToGeoJson(pins).features.map((f) => f.properties.mark)).toEqual(["", "closed"]);
  });

  it("uses the row's icon when known, else the layer's, else the first icon", () => {
    const pins = placesToPins(
      [place({ name: "a", icon: "coffee" }), place({ name: "b" }), place({ name: "c", icon: "nonsense" })],
      [{ ...coffeeLayer, icon: "coffee" }],
    );
    expect(pins.map((p) => p.icon)).toEqual(["coffee", "coffee", "coffee"]);
    const fallback = placesToPins([place({ name: "d" })], [{ ...coffeeLayer, icon: "not-an-icon" }]);
    expect(fallback[0]!.icon).toBe("coffee");
  });

  it("skips places whose layer is not in the list", () => {
    const pins = placesToPins([place({ name: "x", layerId: "elsewhere" as LayerId })], [coffeeLayer]);
    expect(pins).toEqual([]);
  });
});

describe("pinsToGeoJson", () => {
  it("builds point features with the selected flag baked in", () => {
    const pins = placesToPins([place({ name: "a" }), place({ name: "b" })], [coffeeLayer]);
    const fc = pinsToGeoJson(pins, pins[1]!.id);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.geometry).toEqual({ type: "Point", coordinates: [139.7, 35.6] });
    expect(fc.features.map((f) => f.properties.selected)).toEqual([false, true]);
    expect(fc.features[1]!.id).toBe(pins[1]!.id);
  });
});
