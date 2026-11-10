import { createStore, del, get, set } from "idb-keyval";
import { PMTiles, type Protocol, type Source } from "pmtiles";
import { sameVersion, versionFileUrl, versionFor, type BasemapVersion } from "../config/basemap.ts";
import type { RegionConfig, RegionId } from "../data/types.ts";

/**
 * Offline basemaps (M7): each region's PMTiles archive downloaded once,
 * whole, and kept as a Blob in the app's IndexedDB beside a sidecar record
 * saying which build it is. The map reads it through a Source over the
 * Blob, so the style is unchanged: only what is behind the archive's URL
 * swaps from range requests to slices of the Blob.
 *
 * Versioning: the sidecar (build, maxzoom, bbox) is compared with the
 * config on every look; a mismatch is "update available", shown and
 * never acted on by itself, since an archive is tens of MB.
 *
 * The archives live on their own site (docs/proposals/maps-site.md),
 * deployed apart from the app, so before downloading, the app reads the
 * site's version file for the archive and only goes ahead when it is the
 * version this app expects. Otherwise a phone could store an old map under
 * the new version's label, and keep it.
 */

/** What the app knows about a stored archive. */
export interface StoredBasemap {
  build: string;
  maxzoom: number;
  bbox: readonly [number, number, number, number];
  bytes: number;
  /** ISO 8601, when the download finished. */
  savedAt: string;
}

export type BasemapStatus =
  | { kind: "none" }
  | { kind: "ready"; meta: StoredBasemap }
  /** Stored, but not the build or bbox the app was built with. */
  | { kind: "stale"; meta: StoredBasemap };

/** The sidecar an archive extracted for this build and region would carry. */
export function expectedSidecar(region: Pick<RegionConfig, "bbox">): BasemapVersion | undefined {
  return region.bbox ? versionFor(region.bbox) : undefined;
}

/** "ready" when the stored sidecar matches what the app expects for the region. */
export function statusFor(region: Pick<RegionConfig, "bbox">, meta: StoredBasemap | undefined): BasemapStatus {
  if (!meta) return { kind: "none" };
  return sameVersion(meta, expectedSidecar(region)) ? { kind: "ready", meta } : { kind: "stale", meta };
}

/** The maps site doesn't have the version of a map this app expects (yet): the app's deploy ran ahead of the maps'. */
export class MapNotPublishedError extends Error {
  constructor() {
    super("this version of the map isn't published yet; try again later");
    this.name = "MapNotPublishedError";
  }
}

/**
 * Throw MapNotPublishedError unless the version file beside the archive
 * says it is `want`. Network errors pass through, as for the download.
 */
export async function checkPublished(archive: string, want: BasemapVersion, fetchFn: typeof fetch = fetch, signal?: AbortSignal): Promise<void> {
  const res = await fetchFn(versionFileUrl(archive), { signal, cache: "no-store" });
  if (!res.ok) throw new MapNotPublishedError();
  let have: BasemapVersion | undefined;
  try {
    have = (await res.json()) as BasemapVersion;
  } catch {
    throw new MapNotPublishedError();
  }
  if (!sameVersion(have, want)) throw new MapNotPublishedError();
}

/** A pmtiles Source over a Blob, keyed by the archive's URL so the style's `pmtiles://<url>` finds it. */
export class BlobSource implements Source {
  private readonly blob: Blob;
  private readonly key: string;
  constructor(blob: Blob, key: string) {
    this.blob = blob;
    this.key = key;
  }
  getKey(): string {
    return this.key;
  }
  async getBytes(offset: number, length: number): Promise<{ data: ArrayBuffer }> {
    return { data: await this.blob.slice(offset, offset + length).arrayBuffer() };
  }
}

export interface BasemapStore {
  status(region: RegionConfig): Promise<BasemapStatus>;
  /** Download the archive from the site and keep it; progress is 0..1 (NaN when the size is unknown). */
  download(region: RegionConfig, url: string, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<StoredBasemap>;
  remove(region: RegionConfig): Promise<void>;
  /** The stored Blob, if any. */
  blob(region: RegionConfig): Promise<Blob | undefined>;
}

const blobKey = (id: RegionId) => `basemap:${id}`;
const metaKey = (id: RegionId) => `basemap-meta:${id}`;

export function createIdbBasemapStore(dbName = "japlanning", storeName = "kv"): BasemapStore {
  const store = createStore(dbName, storeName);
  return {
    async status(region) {
      return statusFor(region, await get<StoredBasemap>(metaKey(region.id), store));
    },
    async download(region, url, onProgress, signal) {
      const want = expectedSidecar(region);
      if (!want) throw new Error(`${region.id} has no bbox, so no basemap`);
      await checkPublished(url, want, fetch, signal);
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get("content-length")) || NaN;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress?.(received / total);
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/octet-stream" });
      const meta: StoredBasemap = { ...want, bytes: blob.size, savedAt: new Date().toISOString() };
      await set(blobKey(region.id), blob, store);
      await set(metaKey(region.id), meta, store);
      return meta;
    },
    async remove(region) {
      await del(blobKey(region.id), store);
      await del(metaKey(region.id), store);
    },
    blob: (region) => get<Blob>(blobKey(region.id), store),
  };
}

/**
 * Point the map's pmtiles protocol at every stored archive, so tile
 * requests for those URLs read the Blob. Called before the first style is
 * set and again after a download. A region with nothing stored keeps the
 * default: range requests against the site.
 */
export async function registerStoredBasemaps(
  protocol: Pick<Protocol, "add">,
  store: Pick<BasemapStore, "blob">,
  regions: readonly RegionConfig[],
  urlFor: (region: RegionConfig) => string,
): Promise<RegionId[]> {
  const registered: RegionId[] = [];
  for (const region of regions) {
    if (!region.bbox) continue;
    const blob = await store.blob(region);
    if (!blob) continue;
    protocol.add(new PMTiles(new BlobSource(blob, urlFor(region))));
    registered.push(region.id);
  }
  return registered;
}
