import { describe, expect, it } from "vitest";
import type { RegionConfig } from "../data/types.ts";
import type { BasemapStore, StoredBasemap } from "./basemap.ts";
import { createDownloadManager } from "./downloads.ts";

const tokyo: RegionConfig = { id: "tokyo", label: "Tokyo", neighborhoods: [], bbox: [139.6, 35.58, 139.85, 35.75] };
const kyoto: RegionConfig = { id: "kyoto", label: "Kyoto", neighborhoods: [], bbox: [135.65, 34.86, 135.85, 35.1] };
const hakone: RegionConfig = { id: "hakone", label: "Hakone", neighborhoods: [] };

/** A store whose download reports two progress steps, then succeeds or fails by region. */
function fakeStore(failFor: string[] = []): BasemapStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    status: async () => ({ kind: "none" }),
    async download(region, _url, onProgress) {
      calls.push(region.id);
      onProgress?.(0.5);
      onProgress?.(1);
      if (failFor.includes(region.id)) throw new Error("HTTP 500");
      return { build: "b", maxzoom: 15, bbox: region.bbox!, bytes: 10, savedAt: "" } as StoredBasemap;
    },
    remove: async () => undefined,
    blob: async () => undefined,
  };
}

describe("createDownloadManager", () => {
  it("runs downloads one at a time, reports progress, and tells the app what was stored", async () => {
    const store = fakeStore();
    const stored: string[] = [];
    const seen: (number | undefined)[] = [];
    const m = createDownloadManager(store, (r) => `/basemap/${r.id}.pmtiles`, (r) => stored.push(r.id), () => undefined);
    m.subscribe(() => seen.push(m.active("tokyo")?.fraction));
    const a = m.start(tokyo);
    const b = m.start(kyoto);
    expect(m.active("tokyo")).toBeDefined();
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(store.calls).toEqual(["tokyo", "kyoto"]);
    expect(stored).toEqual(["tokyo", "kyoto"]);
    expect(seen).toContain(0.5);
    expect(m.active("tokyo")).toBeUndefined();
  });

  it("ignores a repeat start, a region without a bbox, and reports failures without blocking the queue", async () => {
    const store = fakeStore(["tokyo"]);
    const errors: string[] = [];
    const m = createDownloadManager(store, (r) => r.id, () => undefined, (r, msg) => errors.push(`${r.id}: ${msg}`));
    const first = m.start(tokyo);
    expect(await m.start(tokyo)).toBe(false);
    expect(await m.start(hakone)).toBe(false);
    const second = m.start(kyoto);
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(errors).toEqual(["tokyo: HTTP 500"]);
    expect(store.calls).toEqual(["tokyo", "kyoto"]);
  });
});
