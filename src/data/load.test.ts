import { describe, expect, it } from "vitest";
import { layers } from "../config/layers.ts";
import {
  cacheKey,
  loadAllLayers,
  loadAllLayersStaged,
  loadLayer,
  loadLayerStaged,
  type FetchLike,
  type LoadDeps,
} from "./load.ts";
import { createMemoryStore, type CachedText } from "./store.ts";
import type { LayerConfig, LayerId } from "./types.ts";

// In production the network tier and the bundled copy fetch the same path (/data/<id>.csv, with
// different cache modes); the test gives the network tier its own URL so the scripted fetch can
// tell the two apart.
// Fixed to Tokyo so the inline CSVs need no Region column.
const coffee: LayerConfig = { ...layers.find((l) => l.id === "drinks")!, region: "tokyo", dataUrl: "https://example.invalid/coffee.csv" };
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
    const { store, deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(GOOD) }));
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("network");
    expect(r.places.map((p) => p.name)).toEqual(["Fresh"]);
    expect(r.fetchedAt).toEqual(NOW);
    expect(r.error).toBeUndefined();
    expect(await store.get(KEY)).toEqual({ text: GOOD, fetchedAt: NOW.toISOString() });
  });

  it("network 500 with cache: returns cache, leaves it untouched, explains why", async () => {
    const { store, deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: status(500) }), { [KEY]: cachedEntry });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("cache");
    expect(r.places.map((p) => p.name)).toEqual(["Cached"]);
    expect(r.fetchedAt).toEqual(new Date(cachedEntry.fetchedAt));
    expect(r.error).toBe("network: HTTP 500");
    expect(await store.get(KEY)).toEqual(cachedEntry);
  });

  it("network OK but unparsable: cache wins and is not overwritten", async () => {
    const { store, deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(BROKEN) }), { [KEY]: cachedEntry });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("cache");
    expect(r.error).toMatch(/^network: layer drinks: missing required column\(s\): Longitude$/);
    expect(await store.get(KEY)).toEqual(cachedEntry);
  });

  it("network down, no cache, bundled present: returns bundled with build time", async () => {
    const { deps: d } = deps(scriptedFetch({ "/data/drinks.csv": ok(BUNDLED) }));
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("bundled");
    expect(r.places.map((p) => p.name)).toEqual(["Bundled"]);
    expect(r.fetchedAt).toEqual(BUILT);
    expect(r.error).toBe(`network: Failed to fetch ${coffee.dataUrl}; cache: empty`);
  });

  it("honours a custom bundled URL", async () => {
    const { deps: d } = deps(scriptedFetch({ "/snap/drinks.csv": ok(BUNDLED) }), {}, {
      bundledUrl: (id) => `/snap/${id}.csv`,
    });
    expect((await loadLayer(coffee, d)).source).toBe("bundled");
  });

  it("everything fails: source none with every reason", async () => {
    const { deps: d } = deps(scriptedFetch({ "/data/drinks.csv": status(404) }));
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("none");
    expect(r.places).toEqual([]);
    expect(r.error).toBe(`network: Failed to fetch ${coffee.dataUrl}; cache: empty; bundled: HTTP 404`);
  });

  it("timeout counts as a network failure", async () => {
    const { deps: d } = deps(hangingFetch, { [KEY]: cachedEntry }, { timeoutMs: 10 });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("cache");
    expect(r.error).toBe("network: timeout");
  });

  it("a cache that no longer parses is skipped, not fatal", async () => {
    const broken: CachedText = { text: BROKEN, fetchedAt: "2026-11-01T00:00:00.000Z" };
    const { deps: d } = deps(scriptedFetch({ "/data/drinks.csv": ok(BUNDLED) }), { [KEY]: broken });
    const r = await loadLayer(coffee, d);
    expect(r.source).toBe("bundled");
    expect(r.error).toContain("cache: layer drinks: missing required column(s): Longitude");
  });

  it("passes the region's neighborhoods to the parser", async () => {
    const csv = "Name,Latitude,Longitude,Neighborhood\nX,35.6,139.7,Atlantis\n";
    const { deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(csv) }));
    const r = await loadLayer(coffee, d);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]!.column).toBe("Neighborhood");
  });
});

describe("loadLayerStaged", () => {
  type Emitted = [source: string, names: string[], final: boolean, error?: string];
  async function run(d: LoadDeps): Promise<{ emitted: Emitted[]; returned: string }> {
    const emitted: Emitted[] = [];
    const r = await loadLayerStaged(coffee, d, (res, final) =>
      emitted.push([res.source, res.places.map((p) => p.name), final, res.error]),
    );
    return { emitted, returned: r.source };
  }

  it("cache then network: emits cached first, network second and final", async () => {
    const { deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(GOOD) }), { [KEY]: cachedEntry });
    const { emitted, returned } = await run(d);
    expect(emitted).toEqual([
      ["cache", ["Cached"], false, undefined],
      ["network", ["Fresh"], true, undefined],
    ]);
    expect(returned).toBe("network");
  });

  it("no local copy: emits the network result once", async () => {
    const { deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(GOOD) }));
    expect((await run(d)).emitted).toEqual([["network", ["Fresh"], true, undefined]]);
  });

  it("cache then network failure: re-emits the cached data as final with the reason", async () => {
    const { deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: status(500) }), { [KEY]: cachedEntry });
    expect((await run(d)).emitted).toEqual([
      ["cache", ["Cached"], false, undefined],
      ["cache", ["Cached"], true, "network: HTTP 500"],
    ]);
  });

  it("bundled stands in when there is no cache", async () => {
    const { deps: d } = deps(scriptedFetch({ "/data/drinks.csv": ok(BUNDLED) }));
    expect((await run(d)).emitted).toEqual([
      ["bundled", ["Bundled"], false, undefined],
      ["bundled", ["Bundled"], true, `network: Failed to fetch ${coffee.dataUrl}`],
    ]);
  });

  it("nothing anywhere: one final none with every reason, network first", async () => {
    const { deps: d } = deps(scriptedFetch({ "/data/drinks.csv": status(404) }));
    expect((await run(d)).emitted).toEqual([
      ["none", [], true, `network: Failed to fetch ${coffee.dataUrl}; cache: empty; bundled: HTTP 404`],
    ]);
  });
});

describe("loadAllLayersStaged", () => {
  it("reports after every emission and flags done only on the last", async () => {
    const other: LayerConfig = { ...coffee, id: "stub-other" as LayerId, dataUrl: "https://example.invalid/other.csv" };
    const { deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(GOOD), [other.dataUrl]: status(500) }), {
      [KEY]: cachedEntry,
      [cacheKey(other.id)]: cachedEntry,
    });
    const seen: [string[], boolean][] = [];
    const finals = await loadAllLayersStaged([coffee, other], d, (results, done) =>
      seen.push([results.map((r) => `${r.layerId}:${r.source}`), done]),
    );
    expect(finals.map((r) => r.source)).toEqual(["network", "cache"]);
    expect(seen.at(-1)).toEqual([["drinks:network", "stub-other:cache"], true]);
    expect(seen.filter(([, done]) => done)).toHaveLength(1);
    expect(seen.length).toBe(4);
  });
});

describe("loadAllLayers", () => {
  it("loads in parallel and one failure does not block the others", async () => {
    const other: LayerConfig = { ...coffee, id: "stub-other" as LayerId, dataUrl: "https://example.invalid/other.csv" };
    const { deps: d } = deps(scriptedFetch({ [coffee.dataUrl]: ok(GOOD) }));
    const results = await loadAllLayers([coffee, other], d);
    expect(results.map((r) => [r.layerId, r.source])).toEqual([
      ["drinks", "network"],
      ["stub-other", "none"],
    ]);
  });
});
