import { describe, expect, it } from "vitest";
import { distanceM } from "./distance.ts";
import { circleRing, formatRadius, NEARBY_STOPS, snapRadius, walkMinutes } from "./nearby.ts";

describe("Nearby's radius", () => {
  it("snaps any distance to the closest stop", () => {
    expect([100, 700, 800, 1200, 1300, 2600, 50_000].map(snapRadius)).toEqual([500, 500, 1000, 1000, 1500, 3000, 3000]);
    for (const stop of NEARBY_STOPS) expect(snapRadius(stop)).toBe(stop);
  });

  it("reads as metres under a kilometre, kilometres above", () => {
    expect(NEARBY_STOPS.map(formatRadius)).toEqual(["500 m", "1 km", "1.5 km", "2 km", "3 km"]);
  });

  it("gives the walk at 80 m a minute on a route 1.3 times the straight line", () => {
    expect(NEARBY_STOPS.map(walkMinutes)).toEqual([8, 16, 24, 33, 49]);
  });
});

describe("circleRing", () => {
  it("is a closed ring of points at the radius from the centre", () => {
    const center = { lat: 35.658, lng: 139.7016 };
    const ring = circleRing(center, 1000);
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[64]);
    for (const [lng, lat] of ring) expect(distanceM(center, { lat, lng })).toBeCloseTo(1000, 0);
  });
});
