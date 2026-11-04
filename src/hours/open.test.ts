// The whole point: answers must not depend on the process time zone.
process.env["TZ"] = "America/Los_Angeles";

import OpeningHours from "opening_hours";
import { describe, expect, it } from "vitest";
import { evaluate, openStatus, tokyoNow } from "./open.ts";

const OH = OpeningHours as unknown as Parameters<typeof evaluate>[0];
const at = (iso: string) => new Date(iso);
const status = (hours: string, iso: string) => evaluate(OH, hours, at(iso));

const GLITCH = "Mo-Fr 08:00-19:00; Sa,Su 09:00-19:00";
const FUGLEN = "Mo,Tu 07:00-23:00; We-Su 07:00-01:00";
const THIRD_WED_OFF = "Mo-Su 09:00-20:00; We[3] off";
const TUE_OFF = "Mo,We-Su 11:00-17:30; Tu off";

describe("tokyoNow", () => {
  it("has Tokyo's wall clock in its local fields, whatever the process TZ", () => {
    expect(process.env["TZ"]).toBe("America/Los_Angeles");
    const t = tokyoNow(at("2026-11-04T09:30:00Z")); // 18:30 Wed in Tokyo, 01:30 Wed in LA
    expect([t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes(), t.getDay()]).toEqual([2026, 11, 4, 18, 30, 3]);
  });

  it("crosses the date line correctly", () => {
    const t = tokyoNow(at("2026-11-04T15:30:00Z")); // 00:30 Thu in Tokyo, still Wed in LA and UTC
    expect([t.getDate(), t.getHours(), t.getDay()]).toEqual([5, 0, 4]);
  });
});

describe("evaluate in Tokyo time", () => {
  it("open in Tokyo while closed by the device's own clock", () => {
    // 18:30 Wed Tokyo: open until 19:00. Same instant is 01:30 in LA, when Glitch would read closed.
    expect(status(GLITCH, "2026-11-04T09:30:00Z")).toEqual({ state: "open", label: "Open · until 19:00" });
  });

  it("closed in Tokyo while open by the device's own clock", () => {
    // 03:00 Thu Tokyo. Same instant is 10:00 Wed in LA.
    expect(status(GLITCH, "2026-11-04T18:00:00Z")).toEqual({ state: "closed", label: "Closed · opens 08:00" });
  });

  it("hours past midnight: Wednesday's 07:00-01:00 is still open at 00:30 Thursday", () => {
    expect(status(FUGLEN, "2026-11-04T15:30:00Z")).toEqual({ state: "open", label: "Open · until 01:00" });
    // and closed at 01:30 Thursday, opening 07:00
    expect(status(FUGLEN, "2026-11-04T16:30:00Z")).toEqual({ state: "closed", label: "Closed · opens 07:00" });
  });

  it("nth-weekday closure: the third Wednesday of November 2026 is the 18th", () => {
    expect(status(THIRD_WED_OFF, "2026-11-18T03:00:00Z").state).toBe("closed"); // 12:00 Wed 18th
    expect(status(THIRD_WED_OFF, "2026-11-11T03:00:00Z").state).toBe("open"); // 12:00 Wed 11th
  });

  it("closed for the day says which day it opens", () => {
    // 20:00 Tue Tokyo, Tuesday off anyway; next is Wed 11:00.
    expect(status(TUE_OFF, "2026-11-03T11:00:00Z")).toEqual({ state: "closed", label: "Closed today · opens Wed 11:00" });
  });

  it("weekend hours differ from weekday hours", () => {
    expect(status(GLITCH, "2026-11-07T23:30:00Z")).toEqual({ state: "closed", label: "Closed · opens 09:00" }); // 08:30 Sun
    expect(status(GLITCH, "2026-11-04T23:30:00Z")).toEqual({ state: "open", label: "Open · until 19:00" }); // 08:30 Thu
  });

  it("unparsable text is reported, not treated as closed", () => {
    expect(status("every day except when raining", "2026-11-04T09:30:00Z")).toEqual({ state: "unparsable", label: "Hours unparsable" });
  });
});

describe("open at a picked time", () => {
  it("labels say when they're for", async () => {
    const { evaluateLocal, tokyoWallClock } = await import("./open.ts");
    expect(evaluateLocal(OH, GLITCH, tokyoWallClock("2026-11-10T10:00")!, false)).toEqual({
      state: "open",
      label: "Open at Tue 10:00 · until 19:00",
    });
    expect(evaluateLocal(OH, GLITCH, tokyoWallClock("2026-11-10T20:00")!, false)).toEqual({
      state: "closed",
      label: "Closed at Tue 20:00 · opens Wed 08:00",
    });
  });
});

describe("openStatus (async, lazy parser)", () => {
  it("blank hours are unknown with no label", async () => {
    expect(await openStatus(undefined)).toEqual({ state: "unknown", label: "" });
    expect(await openStatus("  ")).toEqual({ state: "unknown", label: "" });
  });

  it("loads the parser and evaluates at a Tokyo wall-clock Date", async () => {
    expect((await openStatus(GLITCH, tokyoNow(at("2026-11-04T09:30:00Z")), true)).state).toBe("open");
  });
});
