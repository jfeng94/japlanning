import { describe, expect, it } from "vitest";
import type { LayerConfig, LayerId } from "../data/types.ts";
import { coffee, place } from "../filter/testing.ts";
import { nearestPin, parsePinImageId, pinImageId, pinRank, pinsToGeoJson, placesToPins } from "./pins.ts";

const coffeeLayer: LayerConfig = { ...coffee, icon: "coffee", color: "#b5452b" };

describe("placesToPins", () => {
  it("carries name, position, layer colour and the mark", () => {
    const glitch = place({ name: "Glitch", starred: true, lat: 35.69, lng: 139.76 });
    const pins = placesToPins([glitch], [coffeeLayer], new Map([[glitch.id, "star" as const]]));
    expect(pins).toEqual([
      { id: expect.any(String), name: "Glitch", lat: 35.69, lng: 139.76, icon: "coffee", color: "#b5452b", mark: "star", layerId: "drinks" },
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
  it("builds one point feature per pin, keyed by the place's id", () => {
    const pins = placesToPins([place({ name: "a" }), place({ name: "b" })], [coffeeLayer]);
    const fc = pinsToGeoJson(pins);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.geometry).toEqual({ type: "Point", coordinates: [139.7, 35.6] });
    expect(fc.features[1]!.id).toBe(pins[1]!.id);
    expect(fc.features[1]!.properties.id).toBe(pins[1]!.id);
  });
});

describe("the map layer's images, order and taps", () => {
  it("names one image per icon and badge, and reads the name back", () => {
    expect(pinImageId("coffee")).toBe("pin|coffee|");
    expect(pinImageId("tea", "bookmark")).toBe("pin|tea|bookmark");
    expect(parsePinImageId("pin|coffee|")).toEqual({ icon: "coffee" });
    expect(parsePinImageId("pin|tea|bookmark")).toEqual({ icon: "tea", mark: "bookmark" });
    // The basemap's own sprite names, and anything malformed, aren't ours.
    for (const other of ["station", "pin|nonsense|", "pin|tea|sparkle", "pin|tea|star|extra", "coffee"]) expect(parsePinImageId(other)).toBeUndefined();
  });

  it("puts the image and the draw order in the GeoJSON", () => {
    const [a, b] = [place({ name: "a" }), place({ name: "b" })];
    const props = pinsToGeoJson(placesToPins([a, b], [coffeeLayer], new Map([[b.id, "bookmark" as const]]))).features.map((f) => f.properties);
    expect(props.map((p) => [p.image, p.rank])).toEqual([
      ["pin|coffee|", 1],
      ["pin|coffee|bookmark", 3],
    ]);
  });

  it("draws bookmarks on top, then key branches, then the rest, closed shops underneath", () => {
    expect([pinRank("bookmark"), pinRank("star"), pinRank(undefined), pinRank("unknown"), pinRank("closed")]).toEqual([3, 2, 1, 1, 0]);
  });

  it("picks the pin nearest the tap within the radius, else none", () => {
    const pins = [
      { id: "far", x: 100, y: 100 },
      { id: "near", x: 12, y: 5 },
      { id: "nearer", x: 3, y: 4 },
    ];
    expect(nearestPin(pins, { x: 0, y: 0 }, 27)).toBe("nearer");
    expect(nearestPin(pins, { x: 0, y: 0 }, 4)).toBeUndefined();
    expect(nearestPin([], { x: 0, y: 0 }, 27)).toBeUndefined();
  });
});
