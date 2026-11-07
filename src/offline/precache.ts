/**
 * Which built files the service worker precaches: the app shell (page,
 * scripts, styles, icons, manifest, mirrored fonts and sprites) and nothing
 * the app caches itself. Pure, so the build script and the tests share it.
 */

/** Paths (relative to the site root) that the worker never caches. */
const PASS_THROUGH_PREFIXES = [
  "data/", // the loader keeps its own copy in IndexedDB with its own freshness rules
  "basemap/", // range requests; M7 stores whole archives as Blobs instead
];

const SKIP_FILES = new Set(["sw.js", "CNAME"]);
const SKIP_SUFFIXES = [".map", ".pmtiles.json"];

/** True for a request path the worker should leave to the network. */
export function isPassThrough(pathname: string): boolean {
  const rel = pathname.replace(/^\//, "");
  return PASS_THROUGH_PREFIXES.some((p) => rel.startsWith(p));
}

/**
 * The URLs to precache, from the built site's file list (paths relative to
 * dist, forward slashes). The page is cached under "/" as well as its file
 * name, since that is the URL a cold launch asks for.
 */
export function precacheList(files: readonly string[]): string[] {
  const out = new Set<string>();
  for (const f of files) {
    const rel = f.replace(/\\/g, "/").replace(/^\//, "");
    if (isPassThrough(rel) || SKIP_FILES.has(rel) || SKIP_SUFFIXES.some((s) => rel.endsWith(s))) continue;
    out.add(`/${rel}`);
    if (rel === "index.html") out.add("/");
  }
  return [...out].sort();
}
