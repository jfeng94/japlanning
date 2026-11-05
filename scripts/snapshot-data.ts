/**
 * Validate every layer's data file (data/<id>.csv, the source of truth)
 * and copy it to public/data/<id>.csv so the built site serves it: the
 * app fetches it from there, and falls back to the same copy when there
 * is no network and no cache.
 *
 * Run with Node 26, which executes TypeScript directly:
 *   node scripts/snapshot-data.ts
 *
 * Fails the build on any parse warning: a missing required column, a bad
 * ID (blank, non-integer, repeated), a facet value outside the configured
 * list, a neighborhood outside the region's list, a malformed date. The
 * data is in the repo, so a warning is an edit to fix, not a condition
 * to tolerate.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { layers } from "../src/config/layers.ts";
import { regionOptions } from "../src/config/regions.ts";
import { formatIdReport, idReport } from "../src/data/ids.ts";
import { parseLayerCsv } from "../src/data/parse.ts";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "data");
const OUT_DIR = path.resolve(import.meta.dirname, "..", "public", "data");

await mkdir(OUT_DIR, { recursive: true });

let failed = false;
for (const layer of layers) {
  const source = path.join(DATA_DIR, `${layer.id}.csv`);
  const out = path.join(OUT_DIR, `${layer.id}.csv`);
  try {
    const text = await readFile(source, "utf8");
    const result = parseLayerCsv(text, layer, regionOptions());
    const { places, warnings } = result;
    console.log(`${layer.id}: ${places.length} places, ${warnings.length} warnings`);
    for (const w of warnings) {
      console.log(`  row ${w.row ?? "?"}${w.column ? ` ${w.column}` : ""}: ${w.message}`);
    }
    for (const line of formatIdReport(layer, idReport(layer, result))) console.log(`  ${line}`);
    if (warnings.length > 0) {
      failed = true;
      console.error(`${layer.id}: FAILED: fix ${path.relative(process.cwd(), source)} (npm run ids shows the next free ID)`);
      continue;
    }
    await writeFile(out, text);
    console.log(`  -> ${path.relative(process.cwd(), out)}`);
  } catch (e) {
    failed = true;
    console.error(`${layer.id}: FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) process.exit(1);
