import type { RegionConfig, RegionId } from "../data/types.ts";
import type { BasemapStore } from "./basemap.ts";

/**
 * One place that runs basemap downloads, whether Settings started them or
 * the app did on launch: progress per region, cancel, and a change signal
 * the Settings section redraws on. Downloads run one at a time; a second
 * request for a region already in flight is ignored.
 */

export interface ActiveDownload {
  /** 0..1, NaN while the size is unknown. */
  fraction: number;
}

export interface DownloadManager {
  /** Start a region's download unless one is already running; resolves when it is stored (or failed). */
  start(region: RegionConfig): Promise<boolean>;
  cancel(id: RegionId): void;
  active(id: RegionId): ActiveDownload | undefined;
  /** Called on every progress step, start and end. Returns the unsubscribe. */
  subscribe(cb: () => void): () => void;
}

export function createDownloadManager(
  store: BasemapStore,
  urlFor: (region: RegionConfig) => string,
  onStored: (region: RegionConfig) => void,
  onError: (region: RegionConfig, message: string) => void,
): DownloadManager {
  const active = new Map<RegionId, ActiveDownload & { controller: AbortController }>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  let queue: Promise<unknown> = Promise.resolve();

  return {
    start(region) {
      if (active.has(region.id) || !region.bbox) return Promise.resolve(false);
      const controller = new AbortController();
      const entry = { fraction: NaN, controller };
      active.set(region.id, entry);
      notify();
      const run = async (): Promise<boolean> => {
        try {
          // Ask the browser to keep our storage; a "no" (or no API) still lets the download go ahead.
          try {
            await navigator.storage?.persist?.();
          } catch {
            /* ignore */
          }
          await store.download(
            region,
            urlFor(region),
            (fraction) => {
              entry.fraction = fraction;
              notify();
            },
            controller.signal,
          );
          onStored(region);
          return true;
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) onError(region, e instanceof Error ? e.message : String(e));
          return false;
        } finally {
          active.delete(region.id);
          notify();
        }
      };
      // One at a time: chain behind whatever is running, without letting an earlier failure block.
      const result = queue.then(run, run);
      queue = result;
      return result;
    },
    cancel(id) {
      active.get(id)?.controller.abort();
    },
    active(id) {
      const a = active.get(id);
      return a ? { fraction: a.fraction } : undefined;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
