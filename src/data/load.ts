import { regionById } from "../config/regions.ts";
import { parseLayerCsv } from "./parse.ts";
import type { TextStore } from "./store.ts";
import type { LayerConfig, LayerId, LoadResult, ParseResult } from "./types.ts";

/** The subset of fetch the loader uses; narrow so tests can script it. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface LoadDeps {
  fetch: FetchLike;
  store: TextStore;
  /** Clock, injectable for tests. */
  now: () => Date;
  /** Abort a network fetch after this long. Default 10 s. */
  timeoutMs?: number;
  /** Where the build-time snapshot of a layer lives. Default /data/<id>.csv. */
  bundledUrl?: (layerId: LayerId) => string;
  /** When the bundled snapshot was taken; reported as its fetchedAt. */
  bundledBuiltAt?: Date;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export const cacheKey = (layerId: LayerId) => `layer:${layerId}`;

/**
 * Load one layer, trying the network, then the cached last good copy,
 * then the snapshot bundled with the site. The first source that both
 * fetches and parses wins. Bad data never overwrites a good cache.
 */
export async function loadLayer(layer: LayerConfig, deps: LoadDeps): Promise<LoadResult> {
  const key = cacheKey(layer.id);
  const reasons: string[] = [];
  const parse = (text: string): ParseResult =>
    parseLayerCsv(text, layer, { neighborhoods: regionById(layer.region).neighborhoods });

  // 1. Network
  try {
    const text = await fetchText(deps, layer.csvUrl);
    const parsed = parse(text); // throws ParseError on an unusable sheet
    const fetchedAt = deps.now();
    await deps.store.set(key, { text, fetchedAt: fetchedAt.toISOString() });
    return { layerId: layer.id, source: "network", fetchedAt, ...parsed };
  } catch (e) {
    reasons.push(`network: ${describe(e)}`);
  }

  // 2. Cache
  try {
    const cached = await deps.store.get(key);
    if (cached) {
      const parsed = parse(cached.text);
      return {
        layerId: layer.id,
        source: "cache",
        fetchedAt: new Date(cached.fetchedAt),
        error: reasons.join("; "),
        ...parsed,
      };
    }
    reasons.push("cache: empty");
  } catch (e) {
    reasons.push(`cache: ${describe(e)}`);
  }

  // 3. Bundled snapshot
  try {
    const url = (deps.bundledUrl ?? defaultBundledUrl)(layer.id);
    const text = await fetchText(deps, url);
    const parsed = parse(text);
    return {
      layerId: layer.id,
      source: "bundled",
      fetchedAt: deps.bundledBuiltAt,
      error: reasons.join("; "),
      ...parsed,
    };
  } catch (e) {
    reasons.push(`bundled: ${describe(e)}`);
  }

  return { layerId: layer.id, source: "none", places: [], warnings: [], error: reasons.join("; ") };
}

/** Load every layer in parallel. One failing never blocks the others. */
export function loadAllLayers(layers: LayerConfig[], deps: LoadDeps): Promise<LoadResult[]> {
  return Promise.all(layers.map((layer) => loadLayer(layer, deps)));
}

const defaultBundledUrl = (layerId: LayerId) => `/data/${layerId}.csv`;

/**
 * GET a URL as text, failing on non-2xx or after the timeout.
 * `cache: "no-store"` bypasses the browser's HTTP cache so our store is the
 * only cache in play; Google already marks the CSV private, max-age=300.
 */
async function fetchText(deps: LoadDeps, url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await deps.fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.name === "AbortError" ? "timeout" : e.message;
  return String(e);
}
