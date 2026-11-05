import { describe, expect, it } from "vitest";
import { markFor } from "./marks.ts";

describe("markFor", () => {
  it("picks one mark by precedence: unknown > closed > bookmark > star", () => {
    expect(markFor({ hours: "unknown", bookmarked: true, starred: true })).toBe("unknown");
    expect(markFor({ hours: "closed", bookmarked: true, starred: true })).toBe("closed");
    expect(markFor({ hours: "open", bookmarked: true, starred: true })).toBe("bookmark");
    expect(markFor({ hours: "open", bookmarked: false, starred: true })).toBe("star");
    expect(markFor({ bookmarked: false, starred: false })).toBeUndefined();
  });

  it("treats no evaluation (parser not loaded, or a layer without hours) as nothing to say about hours", () => {
    expect(markFor({ bookmarked: false, starred: true })).toBe("star");
    expect(markFor({ hours: "open", bookmarked: false, starred: false })).toBeUndefined();
  });
});
