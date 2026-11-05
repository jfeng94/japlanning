import { ICON_IDS } from "../config/icons.ts";
import { regionOptions } from "../config/regions.ts";
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
  /** Where the copy bundled with the site lives (the same file the network tier fetches). Default /data/<id>.csv. */
  bundledUrl?: (layerId: LayerId) => string;
  /** When the bundled snapshot was taken; reported as its fetchedAt. */
  bundledBuiltAt?: Date;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export const cacheKey = (layerId: LayerId) => `layer:${layerId}`;

type Attempt = { ok: true; result: LoadResult } | { ok: false; reason: string };
type Source = (layer: LayerConfig, deps: LoadDeps, parse: (text: string) => ParseResult) => Promise<Attempt>;

/**
 * Load one layer, trying the network, then the cached last good copy,
 * then the snapshot bundled with the site. The first source that both
 * fetches and parses wins. Bad data never overwrites a good cache.
 */
export async function loadLayer(layer: LayerConfig, deps: LoadDeps): Promise<LoadResult> {
  const parse = parserFor(layer);
  const reasons: string[] = [];
  for (const source of [fromNetwork, fromCache, fromBundled]) {
    const attempt = await source(layer, deps, parse);
    if (attempt.ok) return withReasons(attempt.result, reasons);
    reasons.push(attempt.reason);
  }
  return none(layer, reasons);
}

/**
 * Like loadLayer, but reports twice when it can: first whatever is on the
 * device (cache, else bundled snapshot) so the UI has something to show
 * at once, then the network result when it arrives. `emit` is called with
 * `final: true` exactly once; the promise resolves with that same result.
 */
export async function loadLayerStaged(
  layer: LayerConfig,
  deps: LoadDeps,
  emit: (result: LoadResult, final: boolean) => void,
): Promise<LoadResult> {
  const parse = parserFor(layer);

  let local: LoadResult | undefined;
  const localReasons: string[] = [];
  for (const source of [fromCache, fromBundled]) {
    const attempt = await source(layer, deps, parse);
    if (attempt.ok) {
      local = attempt.result;
      break;
    }
    localReasons.push(attempt.reason);
  }
  if (local) emit(local, false);

  const net = await fromNetwork(layer, deps, parse);
  const final = net.ok ? net.result : local ? withReasons(local, [net.reason]) : none(layer, [net.reason, ...localReasons]);
  emit(final, true);
  return final;
}

/** Load every layer in parallel. One failing never blocks the others. */
export function loadAllLayers(layers: LayerConfig[], deps: LoadDeps): Promise<LoadResult[]> {
  return Promise.all(layers.map((layer) => loadLayer(layer, deps)));
}

/**
 * Staged load of every layer. `onChange` gets the latest result per layer
 * (in `layers` order, layers with nothing yet omitted) after every
 * emission; `done` is true on the last one.
 */
export async function loadAllLayersStaged(
  layers: LayerConfig[],
  deps: LoadDeps,
  onChange: (results: LoadResult[], done: boolean) => void,
): Promise<LoadResult[]> {
  const latest = new Map<LayerId, LoadResult>();
  let finals = 0;
  return Promise.all(
    layers.map((layer) =>
      loadLayerStaged(layer, deps, (result, final) => {
        latest.set(layer.id, result);
        if (final) finals++;
        const results = layers.map((l) => latest.get(l.id)).filter((r): r is LoadResult => r !== undefined);
        onChange(results, finals === layers.length);
      }),
    ),
  );
}

// ---- sources ----

const fromNetwork: Source = async (layer, deps, parse) => {
  try {
    const text = await fetchText(deps, layer.dataUrl);
    const parsed = parse(text); // throws ParseError on an unusable sheet
    const fetchedAt = deps.now();
    await deps.store.set(cacheKey(layer.id), { text, fetchedAt: fetchedAt.toISOString() });
    return { ok: true, result: { layerId: layer.id, source: "network", fetchedAt, ...parsed } };
  } catch (e) {
    return { ok: false, reason: `network: ${describe(e)}` };
  }
};

const fromCache: Source = async (layer, deps, parse) => {
  try {
    const cached = await deps.store.get(cacheKey(layer.id));
    if (!cached) return { ok: false, reason: "cache: empty" };
    const parsed = parse(cached.text);
    return {
      ok: true,
      result: { layerId: layer.id, source: "cache", fetchedAt: new Date(cached.fetchedAt), ...parsed },
    };
  } catch (e) {
    return { ok: false, reason: `cache: ${describe(e)}` };
  }
};

const fromBundled: Source = async (layer, deps, parse) => {
  try {
    const url = (deps.bundledUrl ?? defaultBundledUrl)(layer.id);
    const text = await fetchText(deps, url);
    const parsed = parse(text);
    return {
      ok: true,
      result: { layerId: layer.id, source: "bundled", fetchedAt: deps.bundledBuiltAt, ...parsed },
    };
  } catch (e) {
    return { ok: false, reason: `bundled: ${describe(e)}` };
  }
};

// ---- helpers ----

function parserFor(layer: LayerConfig): (text: string) => ParseResult {
  return (text) => parseLayerCsv(text, layer, { ...regionOptions(), icons: ICON_IDS });
}

function withReasons(result: LoadResult, reasons: string[]): LoadResult {
  return reasons.length === 0 ? result : { ...result, error: reasons.join("; ") };
}

function none(layer: LayerConfig, reasons: string[]): LoadResult {
  return { layerId: layer.id, source: "none", places: [], warnings: [], error: reasons.join("; ") };
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
