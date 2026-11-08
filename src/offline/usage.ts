import type { RegionConfig } from "../data/types.ts";
import type { BasemapStore } from "./basemap.ts";

/**
 * What this app holds on the device, added up by us: WebKit's
 * `storage.estimate()` leaves Blobs in IndexedDB out, so 75 MB of
 * basemaps showed as "5 MB used". Maps come from the sidecars, the shell
 * from the worker's cache; the data cache is tens of KB and is folded
 * into "other" from the estimate when that is larger.
 */
export interface AppUsage {
  /** Stored basemap archives, bytes. */
  maps: number;
  /** The service worker's precache, bytes. */
  shell: number;
  /** Regions with an archive on the device. */
  regions: string[];
}

export async function appUsage(store: BasemapStore, regions: readonly RegionConfig[]): Promise<AppUsage> {
  let maps = 0;
  const stored: string[] = [];
  for (const region of regions) {
    if (!region.bbox) continue;
    const s = await store.status(region);
    if (s.kind !== "none") {
      maps += s.meta.bytes;
      stored.push(region.label);
    }
  }
  let shell = 0;
  if ("caches" in globalThis) {
    try {
      for (const name of await caches.keys()) {
        if (!name.startsWith("japlanning-")) continue;
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const res = await cache.match(req);
          if (res) shell += (await res.blob()).size;
        }
      }
    } catch {
      /* a cache that vanished mid-count: leave what was summed */
    }
  }
  return { maps, shell, regions: stored };
}

export function formatMb(bytes: number): string {
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MB`;
}
