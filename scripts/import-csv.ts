/**
 * Normalise a layer's CSV into the repo's canonical file, data/<layer>.csv:
 *
 *   node scripts/import-csv.ts <layer-id> [<csv url or file>]
 *
 * With no source, the repo file itself is rewritten (a round trip that
 * only reorders columns and tidies quoting). With a source, that CSV
 * replaces the file. Either way:
 *
 * - the ID, Branch and Key columns exist; ID first, Branch and Key after
 *   Name, then Latitude, Longitude, Neighborhood, then every other column
 *   in the source's order;
 * - a ★ prefix on Name moves into Key;
 * - rows without a valid, unique ID get the next free one, in row order,
 *   and each assignment is printed (existing IDs are never changed);
 * - cells are trimmed; rows are written in ID order; cells are quoted only
 *   when they need it; LF line endings; trailing newline; no BOM.
 *
 * Then the result is parsed the way the app parses it and every warning
 * is printed, so a bad import is visible before it is committed.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { layerById } from "../src/config/layers.ts";
import { regionOptions } from "../src/config/regions.ts";
import { formatIdReport, idReport } from "../src/data/ids.ts";
import { ID_COLUMN, parseLayerCsv } from "../src/data/parse.ts";
import type { LayerId } from "../src/data/types.ts";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "data");
const STAR = "★";
/** Canonical leading columns; anything else follows in source order. */
const LEADING = [ID_COLUMN, "Name", "Branch", "Key", "Region", "Latitude", "Longitude", "Neighborhood"];

export function dataFile(layerId: string): string {
  return path.join(DATA_DIR, `${layerId}.csv`);
}

type Row = Record<string, string>;

/** The normalised CSV text for `text`; `log` gets one line per change worth knowing about. */
export function normaliseCsv(text: string, log: (line: string) => void = () => {}): string {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  for (const e of parsed.errors) log(`csv: row ${e.row ?? "?"}: ${e.message}`);

  // ID, Branch and Key are always present; the other leading columns only when the source has them
  // (a missing Latitude is the app's problem to report, not ours to invent). The rest keep their order.
  const sourceHeaders = (parsed.meta.fields ?? []).filter((h) => h !== "");
  const always = new Set([ID_COLUMN, "Branch", "Key"]);
  const headers = LEADING.filter((h) => always.has(h) || sourceHeaders.includes(h));
  for (const h of sourceHeaders) if (!headers.includes(h)) headers.push(h);

  const rows: Row[] = parsed.data.map((r) => {
    const row: Row = {};
    for (const h of headers) row[h] = (r[h] ?? "").trim();
    return row;
  });

  // ★ prefix → Key column.
  for (const row of rows) {
    if (row["Name"]?.startsWith(STAR)) {
      row["Name"] = row["Name"].slice(STAR.length).trim();
      if (!row["Key"]) row["Key"] = STAR;
      log(`${row["Name"]}: ★ prefix moved to Key`);
    }
  }

  // IDs: keep valid unique ones, assign the next free to the rest in row order.
  const used = new Set<number>();
  let max = 0;
  for (const row of rows) {
    const raw = row[ID_COLUMN] ?? "";
    if (/^\d+$/.test(raw) && Number(raw) > 0 && !used.has(Number(raw))) {
      used.add(Number(raw));
      max = Math.max(max, Number(raw));
    }
  }
  const seen = new Set<number>();
  for (const row of rows) {
    const raw = row[ID_COLUMN] ?? "";
    const n = Number(raw);
    if (/^\d+$/.test(raw) && n > 0 && !seen.has(n)) {
      seen.add(n);
      continue;
    }
    max += 1;
    log(`${row["Name"] ?? "?"}: ID ${raw ? `"${raw}"` : "blank"} → ${max}`);
    row[ID_COLUMN] = String(max);
    seen.add(max);
  }

  rows.sort((a, b) => Number(a[ID_COLUMN]) - Number(b[ID_COLUMN]));

  const out = Papa.unparse({ fields: headers, data: rows.map((r) => headers.map((h) => r[h] ?? "")) }, { newline: "\n" });
  return out + "\n";
}

async function readSource(source: string): Promise<string> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source}`);
    return res.text();
  }
  return readFile(source, "utf8");
}

const [layerArg, sourceArg] = process.argv.slice(2);
if (!layerArg) {
  console.error("usage: node scripts/import-csv.ts <layer-id> [<csv url or file>]");
  process.exit(2);
}
const layer = layerById(layerArg as LayerId);
const file = dataFile(layer.id);
const text = await readSource(sourceArg ?? file);
const normalised = normaliseCsv(text, (line) => console.log(`  ${line}`));
await writeFile(file, normalised);

const result = parseLayerCsv(normalised, layer, regionOptions());
console.log(`${layer.id}: ${result.places.length} places, ${result.warnings.length} warnings -> ${path.relative(process.cwd(), file)}`);
for (const w of result.warnings) console.log(`  row ${w.row ?? "?"}${w.column ? ` ${w.column}` : ""}: ${w.message}`);
for (const line of formatIdReport(layer, idReport(layer, result))) console.log(`  ${line}`);
