/**
 * Fetch every configured layer's CSV and write it to public/data/<id>.csv,
 * so the built site ships a snapshot the loader can fall back to when
 * there's no network and no cache (a first launch offline).
 *
 * Run with Node 26, which executes TypeScript directly:
 *   node scripts/snapshot-data.ts
 *
 * Fails the build if a sheet can't be fetched after retries, is missing a
 * required column, or has ID problems (blank, non-integer or repeated), since
 * those rows would silently get name-based ids. Other parse warnings are
 * printed but don't fail.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { layers } from "../src/config/layers.ts";
import { regionById } from "../src/config/regions.ts";
import { formatIdReport, idReport } from "../src/data/ids.ts";
import { parseLayerCsv } from "../src/data/parse.ts";

const OUT_DIR = path.resolve(import.meta.dirname, "..", "public", "data");
const ATTEMPTS = 3;

async function fetchWithRetry(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastError = e;
      if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw lastError;
}

await mkdir(OUT_DIR, { recursive: true });

let failed = false;
for (const layer of layers) {
  const file = path.join(OUT_DIR, `${layer.id}.csv`);
  try {
    const text = await fetchWithRetry(layer.csvUrl);
    const result = parseLayerCsv(text, layer, {
      neighborhoods: regionById(layer.region).neighborhoods,
    });
    const { places, warnings } = result;
    await writeFile(file, text);
    console.log(`${layer.id}: ${places.length} places, ${warnings.length} warnings -> ${path.relative(process.cwd(), file)}`);
    for (const w of warnings) {
      console.log(`  row ${w.row ?? "?"}${w.column ? ` ${w.column}` : ""}: ${w.message}`);
    }
    const ids = idReport(layer, result);
    for (const line of formatIdReport(layer, ids)) console.log(`  ${line}`);
    if (ids.problems.length > 0) {
      failed = true;
      console.error(`${layer.id}: FAILED: fix the ID column (npm run ids shows the next free ID)`);
    }
  } catch (e) {
    failed = true;
    console.error(`${layer.id}: FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) process.exit(1);
