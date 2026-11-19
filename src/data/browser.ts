import type { LoadDeps } from "./load.ts";
import { createIdbStore } from "./store.ts";

/** The real browser dependencies for the loader. The only place that touches global fetch and IndexedDB. */
export function browserDeps(): LoadDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    store: createIdbStore(),
    now: () => new Date(),
    // The bundled copy is dated by its own Last-Modified header, not __BUILD_TIME__, which follows code only.
  };
}
