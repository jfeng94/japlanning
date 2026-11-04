import { createStore, get, set } from "idb-keyval";

/**
 * Bookmarks: a set of place ids kept on the device, never in the sheet.
 * Stored whole under one key in the app's IndexedDB (same database as the
 * CSV cache, so M7's persistence request covers both).
 */

const KEY = "bookmarks:v1";

export interface BookmarkStorage {
  load(): Promise<string[]>;
  save(ids: string[]): Promise<void>;
}

export function createIdbBookmarkStorage(dbName = "japlanning", storeName = "kv"): BookmarkStorage {
  const store = createStore(dbName, storeName);
  return {
    load: async () => {
      const v = await get<unknown>(KEY, store);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    },
    save: (ids) => set(KEY, ids, store),
  };
}

export function createMemoryBookmarkStorage(initial: string[] = []): BookmarkStorage {
  let ids = [...initial];
  return {
    load: async () => [...ids],
    save: async (next) => {
      ids = [...next];
    },
  };
}

export interface Bookmarks {
  has(id: string): boolean;
  toggle(id: string): void;
  /** The current set; treat as read-only. */
  all(): ReadonlySet<string>;
  readonly size: number;
  subscribe(listener: () => void): () => void;
  /** Resolves once the stored set has been loaded. */
  readonly ready: Promise<void>;
}

/**
 * In-memory set with write-through. Toggles apply immediately and are
 * saved in order; a failed save is logged, not surfaced, since the
 * in-memory state is still right for this session.
 */
export function createBookmarks(storage: BookmarkStorage): Bookmarks {
  const ids = new Set<string>();
  const listeners = new Set<() => void>();
  let queue: Promise<void> = Promise.resolve();

  const notify = () => {
    for (const l of [...listeners]) l();
  };

  const ready = storage
    .load()
    .then((stored) => {
      for (const id of stored) ids.add(id);
      notify();
    })
    .catch(() => {
      /* nothing stored, or storage blocked: start empty */
    });

  return {
    has: (id) => ids.has(id),
    toggle(id) {
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      notify();
      const snapshot = [...ids];
      queue = queue.then(() => storage.save(snapshot)).catch((e: unknown) => console.warn("bookmark save failed", e));
    },
    all: () => ids,
    get size() {
      return ids.size;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ready,
  };
}
