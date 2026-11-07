import { describe, expect, it } from "vitest";
import { BASEMAP } from "../config/basemap.ts";
import type { RegionConfig } from "../data/types.ts";
import { BlobSource, expectedSidecar, registerStoredBasemaps, statusFor, type StoredBasemap } from "./basemap.ts";

const tokyo: RegionConfig = { id: "tokyo", label: "Tokyo", neighborhoods: [], bbox: [139.6, 35.58, 139.85, 35.75] };
const hakone: RegionConfig = { id: "hakone", label: "Hakone", neighborhoods: [] };
const stored = (over: Partial<StoredBasemap> = {}): StoredBasemap => ({
  build: BASEMAP.build,
  maxzoom: BASEMAP.maxzoom,
  bbox: [139.6, 35.58, 139.85, 35.75],
  bytes: 1,
  savedAt: "2026-11-07T00:00:00Z",
  ...over,
});

describe("statusFor", () => {
  it("is none without a record, ready on a match, stale on a different build or bbox", () => {
    expect(statusFor(tokyo, undefined)).toEqual({ kind: "none" });
    expect(statusFor(tokyo, stored()).kind).toBe("ready");
    expect(statusFor(tokyo, stored({ build: "20250101" })).kind).toBe("stale");
    expect(statusFor(tokyo, stored({ bbox: [139.6, 35.58, 139.9, 35.75] })).kind).toBe("stale");
    expect(statusFor(tokyo, stored({ maxzoom: 14 })).kind).toBe("stale");
  });

  it("a region without a bbox expects nothing and treats any record as stale", () => {
    expect(expectedSidecar(hakone)).toBeUndefined();
    expect(statusFor(hakone, stored()).kind).toBe("stale");
  });
});

describe("BlobSource", () => {
  it("serves byte ranges of the blob under the archive's URL as its key", async () => {
    const bytes = new Uint8Array(100).map((_, i) => i);
    const src = new BlobSource(new Blob([bytes]), "https://example.test/basemap/tokyo.pmtiles");
    expect(src.getKey()).toBe("https://example.test/basemap/tokyo.pmtiles");
    const { data } = await src.getBytes(10, 5);
    expect([...new Uint8Array(data)]).toEqual([10, 11, 12, 13, 14]);
  });
});

describe("registerStoredBasemaps", () => {
  it("adds one PMTiles per stored region, keyed by its URL, and skips the rest", async () => {
    const added: string[] = [];
    const protocol = { add: (p: { source: { getKey(): string } }) => added.push(p.source.getKey()) };
    const store = { blob: async (r: RegionConfig) => (r.id === "tokyo" ? new Blob([new Uint8Array(8)]) : undefined) };
    const kyoto: RegionConfig = { ...tokyo, id: "kyoto", label: "Kyoto" };
    const got = await registerStoredBasemaps(protocol, store, [tokyo, kyoto, hakone], (r) => `https://s/basemap/${r.id}.pmtiles`);
    expect(got).toEqual(["tokyo"]);
    expect(added).toEqual(["https://s/basemap/tokyo.pmtiles"]);
  });
});
