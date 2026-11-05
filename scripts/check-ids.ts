/**
 * Check every layer's data file for ID problems and print the next free ID,
 * for use before adding rows:
 *   npm run ids
 *
 * Exits 1 when any row's ID is blank, not an integer, or a repeat.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { layers } from "../src/config/layers.ts";
import { formatIdReport, idReport } from "../src/data/ids.ts";
import { parseLayerCsv } from "../src/data/parse.ts";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "data");

let failed = false;
for (const layer of layers) {
  try {
    const text = await readFile(path.join(DATA_DIR, `${layer.id}.csv`), "utf8");
    const report = idReport(layer, parseLayerCsv(text, layer));
    for (const line of formatIdReport(layer, report)) console.log(line);
    if (report.problems.length > 0) failed = true;
  } catch (e) {
    failed = true;
    console.error(`${layer.id}: FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) process.exit(1);
