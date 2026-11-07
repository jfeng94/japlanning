/**
 * Write dist/sw.js from src/sw.js after `vite build`: the list of built files
 * to precache (src/offline/precache.ts decides which) and a version derived
 * from their contents, so any change to the site produces a new worker and
 * an unchanged site produces the same one.
 *
 *   node scripts/build-sw.ts
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { precacheList } from "../src/offline/precache.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SOURCE = path.join(ROOT, "src", "sw.js");

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p, base)));
    else out.push(path.relative(base, p).replace(/\\/g, "/"));
  }
  return out;
}

const files = await walk(DIST);
const list = precacheList(files);

// Version: a hash over every precached file's bytes, so it tracks content, not the clock.
const hash = createHash("sha256");
let bytes = 0;
for (const url of list) {
  const rel = url === "/" ? "index.html" : url.slice(1);
  const data = await readFile(path.join(DIST, rel));
  bytes += data.length;
  hash.update(rel).update(data);
}
const version = hash.digest("hex").slice(0, 12);

const source = await readFile(SOURCE, "utf8");
if (!source.includes("__PRECACHE__") || !source.includes("__VERSION__")) throw new Error("src/sw.js lost its placeholders");
const out = source.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(list));
await writeFile(path.join(DIST, "sw.js"), out);
await stat(path.join(DIST, "sw.js"));
console.log(`sw.js: version ${version}, ${list.length} files, ${(bytes / 1_048_576).toFixed(1)} MB precached`);
