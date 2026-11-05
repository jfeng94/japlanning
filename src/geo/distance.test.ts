import { describe, expect, it } from "vitest";
import { distanceM, formatDistance, sortByDistance } from "./distance.ts";

const glitch = { lat: 35.6937428, lng: 139.7613047 }; // Jimbocho
const bearPond = { lat: 35.663983, lng: 139.667899 }; // Shimokitazawa
const tokyoStation = { lat: 35.681236, lng: 139.767125 };

describe("distanceM", () => {
  it("zero for the same point, symmetric, and about right across Tokyo", () => {
    expect(distanceM(glitch, glitch)).toBe(0);
    expect(distanceM(glitch, bearPond)).toBeCloseTo(distanceM(bearPond, glitch), 6);
    // Jimbocho to Shimokitazawa is roughly 9 km as the crow flies.
    expect(distanceM(glitch, bearPond)).toBeGreaterThan(8_500);
    expect(distanceM(glitch, bearPond)).toBeLessThan(9_500);
    // Jimbocho to Tokyo Station: about 1.5 km.
    expect(distanceM(glitch, tokyoStation)).toBeGreaterThan(1_400);
    expect(distanceM(glitch, tokyoStation)).toBeLessThan(1_600);
  });
});

describe("formatDistance", () => {
  it("rounds to what a walker cares about", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(999)).toBe("1000 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(9_949)).toBe("9.9 km");
    expect(formatDistance(12_400)).toBe("12 km");
    expect(formatDistance(NaN)).toBe("");
    expect(formatDistance(-5)).toBe("");
  });
});

describe("sortByDistance", () => {
  it("nearest first, stable for ties, input untouched", () => {
    const items = [
      { name: "far", ...bearPond },
      { name: "near-b", ...tokyoStation },
      { name: "here", ...glitch },
      { name: "near-a", ...tokyoStation },
    ];
    const sorted = sortByDistance(items, glitch);
    expect(sorted.map((i) => i.name)).toEqual(["here", "near-b", "near-a", "far"]);
    expect(items.map((i) => i.name)).toEqual(["far", "near-b", "here", "near-a"]);
  });
});
