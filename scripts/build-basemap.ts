/**
 * Extract one PMTiles basemap per region that has a bbox, from the pinned
 * Protomaps planet build, into public/basemap/<region>.pmtiles, and mirror
 * the glyphs and sprites the style needs into public/fonts and
 * public/sprites (M7: the map must not depend on a third-party host
 * offline). Mirrored files are verified against src/config/assets-lock.json;
 * run with PIN_ASSETS=1 to (re)write the lock after a deliberate change.
 *
 *   node scripts/build-basemap.ts
 *
 * The pmtiles CLI (a Go binary) is downloaded once into .cache/pmtiles/,
 * verified against the SHA-256 pinned in src/config/basemap.ts. Extracts
 * are skipped when the existing file was made with the same build, zoom
 * and bbox (recorded in a sidecar .json), so re-runs are instant locally.
 * CI starts clean and takes about 10 s per region.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BASEMAP } from "../src/config/basemap.ts";
import { regions } from "../src/config/regions.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "basemap");
const FONTS_DIR = path.join(ROOT, "public", "fonts");
const SPRITES_DIR = path.join(ROOT, "public", "sprites");
const LOCK_FILE = path.join(ROOT, "src", "config", "assets-lock.json");
const CACHE_DIR = path.join(ROOT, ".cache", "pmtiles", BASEMAP.cli.version);
const RELEASE_BASE = `https://github.com/protomaps/go-pmtiles/releases/download/v${BASEMAP.cli.version}`;
const PLANET_URL = `https://build.protomaps.com/${BASEMAP.build}.pmtiles`;

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function download(url: string, to: string): Promise<void> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(to));
}

/** Path to a verified pmtiles binary, downloading and extracting it if needed. */
async function ensureCli(): Promise<string> {
  const exe = path.join(CACHE_DIR, process.platform === "win32" ? "pmtiles.exe" : "pmtiles");
  if (await exists(exe)) return exe;

  const key = `${process.platform}-${process.arch}`;
  const asset = BASEMAP.cli.assets[key];
  if (!asset) {
    throw new Error(
      `no pinned pmtiles CLI for ${key}; add its archive name and SHA-256 to src/config/basemap.ts ` +
        `(releases: ${RELEASE_BASE})`,
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const archive = path.join(CACHE_DIR, asset.file);
  console.log(`downloading ${asset.file}`);
  await download(`${RELEASE_BASE}/${asset.file}`, archive);

  const actual = await sha256(archive);
  if (actual !== asset.sha256) {
    throw new Error(`${asset.file}: SHA-256 ${actual} does not match pinned ${asset.sha256}`);
  }

  // Windows' own tar.exe (bsdtar) reads zips; Git Bash's GNU tar does not.
  const tar = process.platform === "win32" ? path.join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  const flags = asset.file.endsWith(".tar.gz") ? "-xzf" : "-xf";
  const r = spawnSync(tar, [flags, archive, "-C", CACHE_DIR], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`extracting ${asset.file} failed`);
  if (process.platform !== "win32") await chmod(exe, 0o755);
  return exe;
}

/** Every mirrored asset: its path under public/ and where it comes from. */
function mirroredAssets(): { rel: string; url: string }[] {
  const { base, fonts, ranges, spriteVersion, sprites } = BASEMAP.assets;
  const out: { rel: string; url: string }[] = [];
  for (const font of fonts) {
    for (const range of ranges) {
      out.push({ rel: `fonts/${font}/${range}.pbf`, url: `${base}/fonts/${encodeURIComponent(font)}/${range}.pbf` });
    }
  }
  for (const flavor of sprites) {
    for (const suffix of ["", "@2x"]) {
      for (const ext of ["json", "png"]) {
        out.push({ rel: `sprites/${flavor}${suffix}.${ext}`, url: `${base}/sprites/${spriteVersion}/${flavor}${suffix}.${ext}` });
      }
    }
  }
  return out;
}

/**
 * Download the mirrored assets that are missing and check every one against
 * the lock. With PIN_ASSETS=1 the lock is rewritten from what was fetched.
 */
async function mirrorAssets(): Promise<boolean> {
  const pin = process.env["PIN_ASSETS"] === "1";
  let lock: Record<string, string> = {};
  if (!pin) {
    try {
      lock = JSON.parse(await readFile(LOCK_FILE, "utf8")) as Record<string, string>;
    } catch {
      console.error(`${path.relative(ROOT, LOCK_FILE)} is missing; run with PIN_ASSETS=1 once to create it`);
      return false;
    }
  }
  await mkdir(FONTS_DIR, { recursive: true });
  await mkdir(SPRITES_DIR, { recursive: true });
  const hashes: Record<string, string> = {};
  let ok = true;
  for (const { rel, url } of mirroredAssets()) {
    const file = path.join(ROOT, "public", rel);
    if (!(await exists(file))) {
      await mkdir(path.dirname(file), { recursive: true });
      console.log(`fetching ${rel}`);
      await download(url, file);
    }
    const hash = await sha256(file);
    hashes[rel] = hash;
    if (!pin && lock[rel] !== hash) {
      ok = false;
      console.error(`${rel}: SHA-256 ${hash} does not match the lock (${lock[rel] ?? "not in lock"})`);
    }
  }
  if (pin) {
    await writeFile(LOCK_FILE, JSON.stringify(hashes, null, 2) + "\n");
    console.log(`pinned ${Object.keys(hashes).length} assets in ${path.relative(ROOT, LOCK_FILE)}`);
  } else {
    console.log(`assets: ${Object.keys(hashes).length} mirrored files match the lock`);
  }
  return ok;
}

interface Sidecar {
  build: string;
  maxzoom: number;
  bbox: readonly [number, number, number, number];
}

async function main(): Promise<void> {
  if (!(await mirrorAssets())) process.exit(1);
  const targets = regions.filter((r) => r.bbox);
  if (targets.length === 0) {
    console.log("no regions have a bbox; nothing to extract");
    return;
  }
  const cli = await ensureCli();
  await mkdir(OUT_DIR, { recursive: true });

  let failed = false;
  for (const region of targets) {
    const bbox = region.bbox!;
    const out = path.join(OUT_DIR, `${region.id}.pmtiles`);
    const sidecarPath = `${out}.json`;
    const want: Sidecar = { build: BASEMAP.build, maxzoom: BASEMAP.maxzoom, bbox };

    if (await exists(out)) {
      try {
        const have = JSON.parse(await readFile(sidecarPath, "utf8")) as Sidecar;
        if (JSON.stringify(have) === JSON.stringify(want)) {
          console.log(`${region.id}: up to date (${await sizeMb(out)} MB)`);
          continue;
        }
      } catch {
        /* no or unreadable sidecar: rebuild */
      }
    }

    console.log(`${region.id}: extracting ${BASEMAP.build} bbox=${bbox.join(",")} maxzoom=${BASEMAP.maxzoom}`);
    const r = spawnSync(
      cli,
      ["extract", PLANET_URL, out, `--bbox=${bbox.join(",")}`, `--maxzoom=${BASEMAP.maxzoom}`],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (r.status !== 0) {
      failed = true;
      console.error(`${region.id}: extract failed (exit ${r.status})`);
      continue;
    }
    await writeFile(sidecarPath, JSON.stringify(want));
    console.log(`${region.id}: ${await sizeMb(out)} MB -> ${path.relative(ROOT, out)}`);
  }
  if (failed) process.exit(1);
}

async function sizeMb(file: string): Promise<string> {
  return ((await stat(file)).size / 1e6).toFixed(1);
}

await main();
