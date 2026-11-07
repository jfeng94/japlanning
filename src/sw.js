/*
 * The service worker: the app shell offline.
 *
 * On install it fetches every file listed in PRECACHE (filled in by
 * scripts/build-sw.ts from the built site) into one Cache Storage cache
 * named after this build's VERSION. On a request for one of those files
 * it answers from that cache; a navigation (the page itself) gets the
 * cached page. Data files and basemaps are never touched here: the app
 * keeps its own copies of those in IndexedDB.
 *
 * A new deploy means a new sw.js (the list or its hashes changed), which
 * the browser installs beside the old one. It waits until the page says
 * "SKIP_WAITING" (the Update toast), then activates, deletes the older
 * caches and takes over the open pages, which reload.
 */

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `japlanning-${VERSION}`;
const PASS_THROUGH = ["/data/", "/basemap/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("japlanning-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PASS_THROUGH.some((p) => url.pathname.startsWith(p))) return;

  // The page: whatever the URL's query string, it is the one cached page.
  if (req.mode === "navigate") {
    event.respondWith(caches.match("/").then((hit) => hit || fetch(req)));
    return;
  }
  // Everything else precached: cache first; a miss (nothing we know about) goes to the network.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
