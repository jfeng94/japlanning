/**
 * The state of a sheet's ID column, for the build check (scripts/snapshot-data.ts),
 * `npm run ids`, and Diagnostics. Pure: works on a parse result.
 */

import { ID_COLUMN } from "./parse.ts";
import type { LayerConfig, ParseResult, ParseWarning } from "./types.ts";

export interface IdReport {
  /** The sheet has an ID column at all. Without one every id comes from the name. */
  hasIdColumn: boolean;
  /** Rows whose ID was blank, not an integer, or a repeat; each fell back to a name id. */
  problems: ParseWarning[];
  /** One more than the largest ID in use (1 for an empty column). */
  nextId: number;
}

export function idReport(layer: LayerConfig, result: ParseResult): IdReport {
  const prefix = `${layer.id}:`;
  let max = 0;
  for (const p of result.places) {
    const n = Number(p.id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return {
    hasIdColumn: result.columns.includes(ID_COLUMN),
    problems: result.warnings.filter((w) => w.column === ID_COLUMN),
    nextId: max + 1,
  };
}

/** Lines for a terminal: the problems, then the next free id. */
export function formatIdReport(layer: LayerConfig, report: IdReport): string[] {
  const lines: string[] = [];
  if (!report.hasIdColumn) {
    lines.push(`${layer.id}: no ID column; ids come from names (a rename breaks bookmarks and links)`);
    return lines;
  }
  for (const w of report.problems) lines.push(`${layer.id}: row ${w.row ?? "?"}: ${w.message}`);
  lines.push(`${layer.id}: ${report.problems.length === 0 ? "IDs OK" : `${report.problems.length} ID problem(s)`}; next free ID is ${report.nextId}`);
  return lines;
}
