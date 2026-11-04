import { createStore, get, set } from "idb-keyval";

/** A cached copy of a layer's CSV text and when it was fetched. */
export interface CachedText {
  text: string;
  /** ISO 8601. A string rather than a Date so it round-trips through any storage. */
  fetchedAt: string;
}

/**
 * The only storage the loader knows about. One implementation over
 * IndexedDB for the browser, one over a Map for tests.
 */
export interface TextStore {
  get(key: string): Promise<CachedText | undefined>;
  set(key: string, value: CachedText): Promise<void>;
}

/**
 * IndexedDB-backed store. Each call opens the database lazily and the
 * browser keeps it open, so there's nothing to initialise or close.
 *
 * Why IndexedDB and not localStorage: it's asynchronous, holds any
 * structured value (M7 will put a basemap Blob of tens of MB here) and has
 * a quota in the GBs. Why idb-keyval and not the raw API: the raw API is
 * event-callback-based and needs ~40 lines to do what get/set do here.
 */
export function createIdbStore(dbName = "japlanning", storeName = "kv"): TextStore {
  const store = createStore(dbName, storeName);
  return {
    get: (key) => get<CachedText>(key, store),
    set: (key, value) => set(key, value, store),
  };
}

/** In-memory store for tests and for environments without IndexedDB. */
export function createMemoryStore(initial: Record<string, CachedText> = {}): TextStore {
  const map = new Map(Object.entries(initial));
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
  };
}
