import { describe, expect, it } from "vitest";
import { layers } from "../config/layers.ts";
import { cacheKey, loadAllLayers, loadLayer, type FetchLike, type LoadDeps } from "./load.ts";
import { createMemoryStore, type CachedText } from "./store.ts";
import type { LayerConfig, LayerId } from "./types.ts";

const coffee = layers.find((l) => l.id === "tokyo-coffee")!;
const KEY = cacheKey(coffee.id);
const NOW = new Date("2026-11-10T01:00:00Z");
const BUILT = new Date("2026-11-04T10:00:00Z");

const GOOD = "Name,Latitude,Longitude\nFresh,35.6,139.7\n";
const CACHED = "Name,Latitude,Longitude\nCached,35.6,139.7\n";
const BUNDLED = "Name,Latitude,Longitude\nBundled,35.6,139.7\n";
const BROKEN = "Name,Latitude\nNoLongitude,35.6\n"; // missing required column

type Script = Record<string, () => Response | Promise<Response>>;

/** fetch that answers from a URL→response script; unknown URLs throw like a network error. */
function scriptedFetch(script: Script): FetchLike {
  return async (url) => {
    const handler = script[url];
    if (!handler) throw new TypeError(`Failed to fetch ${url}`);
    return handler();
  };
}

/** fetch that never answers, but honours the abort signal. */
const hangingFetch: FetchLike = (_url, init) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

const ok = (body: string) => () => new Response(body, { status: 200 });
const status = (code: number) => () => new Response("", { status: code });

function deps(fetch: FetchLike, initial: Record<string, CachedText> = {}, extra: Partial<LoadDeps> = {}) {
  const store = createMemoryStore(initial);
  return { store, deps: { fetch, store, now: () => NOW, bundledBuiltAt: BUILT, ...extra } as LoadDeps };
}

const cachedEntry: CachedText = { text: CACHED, fetchedAt: "2026-11-01T00:00:00.000Z" };

describe("loadLayer source chain", () => {
  it("network OK: returns network data and stores it", async () => {
    const { store, deps: d } = deps(scriptedFetch({ [coffee.csvUrl]: ok(GOOD) }));
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("network");
    expect(r.places.map((p) => p.name)).toEqual(["Fresh"]);
    expect(r.fetchedAt).toEqual(NOW);
    expect(r.error).toBeUndefined();
    expect(await store.get(KEY)).toEqual({ text: GOOD, fetchedAt: NOW.toISOString() });
  });

  it("network 500 with cache: returns cache, leaves it untouched, explains why", async () => {
    const { store, deps: d } = deps(scriptedFetch({ [coffee.csvUrl]: status(500) }), { [KEY]: cachedEntry });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("cache");
    expect(r.places.map((p) => p.name)).toEqual(["Cached"]);
    expect(r.fetchedAt).toEqual(new Date(cachedEntry.fetchedAt));
    expect(r.error).toBe("network: HTTP 500");
    expect(await store.get(KEY)).toEqual(cachedEntry);
  });

  it("network OK but unparsable: cache wins and is not overwritten", async () => {
    const { store, deps: d } = deps(scriptedFetch({ [coffee.csvUrl]: ok(BROKEN) }), { [KEY]: cachedEntry });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("cache");
    expect(r.error).toMatch(/^network: layer tokyo-coffee: missing required column\(s\): Longitude$/);
    expect(await store.get(KEY)).toEqual(cachedEntry);
  });

  it("network down, no cache, bundled present: returns bundled with build time", async () => {
    const { deps: d } = deps(scriptedFetch({ "/data/tokyo-coffee.csv": ok(BUNDLED) }));
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("bundled");
    expect(r.places.map((p) => p.name)).toEqual(["Bundled"]);
    expect(r.fetchedAt).toEqual(BUILT);
    expect(r.error).toBe(`network: Failed to fetch ${coffee.csvUrl}; cache: empty`);
  });

  it("honours a custom bundled URL", async () => {
    const { deps: d } = deps(scriptedFetch({ "/snap/tokyo-coffee.csv": ok(BUNDLED) }), {}, {
      bundledUrl: (id) => `/snap/${id}.csv`,
    });
    expect((await loadLayer(coffee, d)).source).toBe("bundled");
  });

  it("everything fails: source none with every reason", async () => {
    const { deps: d } = deps(scriptedFetch({ "/data/tokyo-coffee.csv": status(404) }));
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("none");
    expect(r.places).toEqual([]);
    expect(r.error).toBe(`network: Failed to fetch ${coffee.csvUrl}; cache: empty; bundled: HTTP 404`);
  });

  it("timeout counts as a network failure", async () => {
    const { deps: d } = deps(hangingFetch, { [KEY]: cachedEntry }, { timeoutMs: 10 });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("cache");
    expect(r.error).toBe("network: timeout");
  });

  it("a cache that no longer parses is skipped, not fatal", async () => {
    const broken: CachedText = { text: BROKEN, fetchedAt: "2026-11-01T00:00:00.000Z" };
    const { deps: d } = deps(scriptedFetch({ "/data/tokyo-coffee.csv": ok(BUNDLED) }), { [KEY]: broken });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("bundled");
    expect(r.error).toContain("cache: layer tokyo-coffee: missing required column(s): Longitude");
  });

  it("passes the region's neighborhoods to the parser", async () => {
    const csv = "Name,Latitude,Longitude,Neighborhood\nX,35.6,139.7,Atlantis\n";
    const { deps: d } = deps(scriptedFetch({ [coffee.csvUrl]: ok(csv) }));
    const r = await loadLayer(coffee, d);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]!.column).toBe("Neighborhood");
  });
});

describe("loadAllLayers", () => {
  it("loads in parallel and one failure does not block the others", async () => {
    const other: LayerConfig = { ...coffee, id: "stub-other" as LayerId, csvUrl: "https://example.invalid/other.csv" };
    const { deps: d } = deps(scriptedFetch({ [coffee.csvUrl]: ok(GOOD) }));
    const results = await loadAllLayers([coffee, other], d);
    expect(results.map((r) => [r.layerId, r.source])).toEqual([
      ["tokyo-coffee", "network"],
      ["stub-other", "none"],
    ]);
  });
});
