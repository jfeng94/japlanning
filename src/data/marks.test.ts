import { describe, expect, it } from "vitest";
import { markFor } from "./marks.ts";

describe("markFor", () => {
  const seeking = { seekingOpen: true };
  const browsing = { seekingOpen: false };

  it("picks one mark by precedence: unknown > closed > bookmark > star", () => {
    expect(markFor({ hours: "unknown", bookmarked: true, starred: true, ...seeking })).toBe("unknown");
    expect(markFor({ hours: "closed", bookmarked: true, starred: true, ...seeking })).toBe("closed");
    expect(markFor({ hours: "open", bookmarked: true, starred: true, ...seeking })).toBe("bookmark");
    expect(markFor({ hours: "open", bookmarked: false, starred: true, ...seeking })).toBe("star");
    expect(markFor({ bookmarked: false, starred: false, ...seeking })).toBeUndefined();
  });

  it("shows unknown only while seeking open places; closed shows regardless", () => {
    expect(markFor({ hours: "unknown", bookmarked: true, starred: true, ...browsing })).toBe("bookmark");
    expect(markFor({ hours: "unknown", bookmarked: false, starred: false, ...browsing })).toBeUndefined();
    expect(markFor({ hours: "closed", bookmarked: false, starred: false, ...browsing })).toBe("closed");
  });

  it("treats no evaluation (parser not loaded, or a layer without hours) as nothing to say about hours", () => {
    expect(markFor({ bookmarked: false, starred: true, ...seeking })).toBe("star");
    expect(markFor({ hours: "open", bookmarked: false, starred: false, ...seeking })).toBeUndefined();
  });
});
