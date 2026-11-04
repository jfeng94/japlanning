process.env["TZ"] = "America/Los_Angeles";

import OpeningHours from "opening_hours";
import { describe, expect, it } from "vitest";
import { place } from "../filter/testing.ts";
import { evaluateAll } from "./evaluate-all.ts";
import { tokyoNow, tokyoWallClock, wallClockString, type OpeningHoursCtor } from "./open.ts";

const OH = OpeningHours as unknown as OpeningHoursCtor;

describe("evaluateAll", () => {
  const places = [
    place({ name: "glitch", hoursOsm: "Mo-Fr 08:00-19:00; Sa,Su 09:00-19:00" }),
    place({ name: "fuglen", hoursOsm: "Mo,Tu 07:00-23:00; We-Su 07:00-01:00" }),
    place({ name: "blank" }),
    place({ name: "junk", hoursOsm: "whenever" }),
    place({ name: "tue off", hoursOsm: "Mo,We-Su 11:00-17:30; Tu off" }),
  ];
  const byName = (m: Map<string, string>) => Object.fromEntries(places.map((p) => [p.name, m.get(p.id)]));

  it("at 18:30 Wednesday Tokyo (01:30 in LA)", () => {
    expect(byName(evaluateAll(OH, places, tokyoNow(new Date("2026-11-04T09:30:00Z"))))).toEqual({
      glitch: "open",
      fuglen: "open",
      blank: "unknown",
      junk: "unknown",
      "tue off": "closed",
    });
  });

  it("at a picked Tokyo wall-clock time: Tuesday 12:00", () => {
    expect(byName(evaluateAll(OH, places, tokyoWallClock("2026-11-03T12:00")!))).toEqual({
      glitch: "open",
      fuglen: "open",
      blank: "unknown",
      junk: "unknown",
      "tue off": "closed",
    });
  });
});

describe("tokyoWallClock / wallClockString", () => {
  it("round-trips and rejects junk", () => {
    const d = tokyoWallClock("2026-11-10T10:05")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 10, 10, 5]);
    expect(wallClockString(d)).toBe("2026-11-10T10:05");
    expect(tokyoWallClock("2026-11-10")).toBeUndefined();
    expect(tokyoWallClock("nope")).toBeUndefined();
    expect(tokyoWallClock(undefined)).toBeUndefined();
  });
});
