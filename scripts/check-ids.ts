/**
 * Check every layer's live sheet for ID problems and print the next free ID,
 * for use before editing a sheet:
 *   npm run ids
 *
 * Exits 1 when any row's ID is blank, not an integer, or a repeat. A sheet
 * with no ID column is reported but doesn't fail (ids come from names).
 */

import { layers } from "../src/config/layers.ts";
import { formatIdReport, idReport } from "../src/data/ids.ts";
import { parseLayerCsv } from "../src/data/parse.ts";

let failed = false;
for (const layer of layers) {
  try {
    const res = await fetch(layer.csvUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const report = idReport(layer, parseLayerCsv(await res.text(), layer));
    for (const line of formatIdReport(layer, report)) console.log(line);
    if (report.problems.length > 0) failed = true;
  } catch (e) {
    failed = true;
    console.error(`${layer.id}: FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) process.exit(1);
