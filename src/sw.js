/*
 * The service worker: the app shell offline.
 *
 * On install it fetches every file listed in PRECACHE (filled in by
 * scripts/build-sw.ts from the built site) into one Cache Storage cache
 * named after this build's VERSION. On a request for one of those files
 * it answers from that cache, and so does a navigation (the page itself):
 * cache first, the network only when nothing is cached (2026-11-23,
 * docs/proposals/weak-signal.md). Until then the page went to the network
 * first, and on weak signal a launch waited out the stalled request on a
 * blank screen. A new deploy still arrives as before: the browser checks
 * sw.js in the background and the Update toast offers it. Data files are never touched here: the app keeps
 * its own copies of those in IndexedDB, as of the basemaps, which live on the maps site (another origin, which
 * a service worker never sees; docs/proposals/maps-site.md).
 *
 * A new deploy means a new sw.js (the list or its hashes changed), which
 * the browser installs beside the old one. It waits until the page says
 * "SKIP_WAITING" (the Update toast), then activates, deletes the older
 * caches and takes over the open pages, which reload. (M7, 2026-11-07.)
 */

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `japlanning-${VERSION}`;
const PASS_THROUGH = ["/data/"];

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

  // The page: cache first, from this worker's own cache, so the page always
  // names the hashed assets cached beside it; that cache is only deleted when
  // a newer worker takes over, which reloads the page from the newer cache.
  // Nothing cached yet (a first visit) goes to the network.
  if (req.mode === "navigate") {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match("/"))
        .then((hit) => hit || fetch(req)),
    );
    return;
  }
  // Everything else precached: cache first; a miss (nothing we know about) goes to the network.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
