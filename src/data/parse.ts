import Papa from "papaparse";
import type { LayerConfig, ParseResult, ParseWarning, Place, RegionId } from "./types.ts";

/** Thrown when the sheet is unusable as a whole (not for bad rows). */
export class ParseError extends Error {
  override name = "ParseError";
}

export interface ParseOptions {
  /** Known region ids; a Region cell outside them warns and skips the row (layers without a fixed region). */
  regions?: readonly string[];
  /** A region's shared neighborhood list; a Neighborhood outside it warns. */
  neighborhoodsFor?: (region: RegionId) => readonly string[] | undefined;
  /** Known icon ids; an Icon cell outside them warns and is dropped. */
  icons?: string[];
}

const REQUIRED_COLUMNS = ["Name", "Latitude", "Longitude"] as const;

/** The sheet's stable integer id column; optional per sheet, required per row once present. */
export const ID_COLUMN = "ID";

/** Core optional columns, by header text. */
const COL = {
  id: ID_COLUMN,
  branch: "Branch",
  key: "Key",
  region: "Region",
  neighborhood: "Neighborhood",
  hours: "Hours",
  hoursOsm: "Hours (OSM)",
  link: "Link",
  address: "Address (JA)",
  notes: "Notes",
  lastVerified: "Last verified",
  icon: "Icon",
} as const;

/** Rough bounds of Japan; anything outside is a mis-pasted coordinate. */
const JAPAN = { west: 122, south: 24, east: 154, north: 46 };

const STAR = "★";
/** Key-column spellings that mean yes (a Sheets checkbox publishes TRUE/FALSE). */
const KEY_YES = new Set(["★", "true", "yes", "y", "1", "x"]);
const KEY_NO = new Set(["false", "no", "n", "0"]);
const APPROX_PREFIXES = ["~", "～"];
const MULTI_VALUE_SEPARATOR = ";";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type Row = Record<string, string | undefined>;

/**
 * Parse one layer's CSV text into Place records.
 *
 * Columns are found by header text, so order doesn't matter and unknown
 * columns are kept under `extra`. Missing required columns throw; bad rows
 * are skipped with a warning. Blank cells become undefined / [].
 */
export function parseLayerCsv(
  text: string,
  layer: LayerConfig,
  options: ParseOptions = {},
): ParseResult {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    throw new ParseError(`layer ${layer.id}: missing required column(s): ${missing.join(", ")}`);
  }

  const warnings: ParseWarning[] = parsed.errors.map((e) => ({
    row: typeof e.row === "number" ? e.row + 1 : undefined,
    message: `csv: ${e.message}`,
  }));

  const facetColumns = new Set(layer.facets.map((f) => f.column));
  const knownColumns = new Set<string>([
    ...REQUIRED_COLUMNS,
    ...Object.values(COL),
    ...facetColumns,
  ]);
  const extraColumns = headers.filter((h) => h !== "" && !knownColumns.has(h));
  const icons = options.icons ? new Set(options.icons) : undefined;

  const places: Place[] = [];
  const seenIds = new Map<string, number>();
  const hasIdColumn = headers.includes(COL.id);
  const seenSheetIds = new Set<string>();

  /**
   * The row's id. From the ID column when the sheet has one and the cell is a
   * fresh positive integer; otherwise from the name, with a warning on the
   * ID column so the build check and Diagnostics can single it out.
   */
  const placeId = (name: string, rawId: string | undefined, warn: (m: string, c?: string) => void): string => {
    if (hasIdColumn) {
      if (rawId === undefined) {
        warn(`${name}: ID is blank; using the name as id until one is assigned`, COL.id);
      } else if (!/^\d+$/.test(rawId) || Number(rawId) === 0) {
        warn(`${name}: ID "${rawId}" is not a positive integer; using the name as id`, COL.id);
      } else if (seenSheetIds.has(rawId)) {
        warn(`${name}: ID ${rawId} is already used by another row; using the name as id`, COL.id);
      } else {
        seenSheetIds.add(rawId);
        return `${layer.id}:${Number(rawId)}`;
      }
    }
    let id = `${layer.id}:${slug(name)}`;
    const seen = seenIds.get(id) ?? 0;
    seenIds.set(id, seen + 1);
    if (seen > 0) {
      warn(`${name}: duplicate name; id suffixed`, "Name");
      id = `${id}-${seen + 1}`;
    }
    return id;
  };

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 1; // 1-based data row; header is row 0
    const warn = (message: string, column?: string) =>
      warnings.push(column ? { row: rowNumber, column, message } : { row: rowNumber, message });
    const cell = (column: string): string | undefined => {
      const v = row[column]?.trim();
      return v ? v : undefined;
    };

    const rawName = cell("Name");
    if (!rawName) {
      warn("blank Name; row skipped", "Name");
      return;
    }
    const starPrefix = rawName.startsWith(STAR);
    const name = starPrefix ? rawName.slice(STAR.length).trim() : rawName;
    if (!name) {
      warn("Name is only a ★; row skipped", "Name");
      return;
    }
    // Key branch: the Key column, or the older ★ prefix on the name. Either marks it.
    const rawKey = cell(COL.key)?.toLowerCase();
    if (rawKey !== undefined && !KEY_YES.has(rawKey) && !KEY_NO.has(rawKey)) {
      warn(`${name}: Key "${cell(COL.key)}" is not ★, yes or no; treated as no`, COL.key);
    }
    const starred = starPrefix || (rawKey !== undefined && KEY_YES.has(rawKey));

    // Region: the layer's, or the row's own cell when the layer spans regions.
    let region: RegionId;
    if (layer.region) {
      region = layer.region;
    } else {
      const raw = cell(COL.region);
      if (!raw || (options.regions && !options.regions.includes(raw))) {
        warn(`${name}: Region ${raw ? `"${raw}" is not a known region` : "is blank"}; row skipped`, COL.region);
        return;
      }
      region = raw as RegionId;
    }

    const lat = parseCoordinate(cell("Latitude"), JAPAN.south, JAPAN.north);
    const lng = parseCoordinate(cell("Longitude"), JAPAN.west, JAPAN.east);
    if (lat === undefined || lng === undefined) {
      warn(`${name}: bad or missing coordinates; row skipped`, lat === undefined ? "Latitude" : "Longitude");
      return;
    }

    const rawAddress = cell(COL.address);
    const approxPrefix = APPROX_PREFIXES.find((p) => rawAddress?.startsWith(p));
    const address = approxPrefix ? rawAddress!.slice(approxPrefix.length).trim() || undefined : rawAddress;

    const rawDate = cell(COL.lastVerified);
    const lastVerified = rawDate && isIsoDate(rawDate) ? rawDate : undefined;
    if (rawDate && !lastVerified) {
      warn(`${name}: Last verified "${rawDate}" is not YYYY-MM-DD; ignored`, COL.lastVerified);
    }

    const neighborhood = cell(COL.neighborhood);
    const neighborhoods = options.neighborhoodsFor?.(region);
    if (neighborhood && neighborhoods && !neighborhoods.includes(neighborhood)) {
      warn(`${name}: Neighborhood "${neighborhood}" is not in the region's list`, COL.neighborhood);
    }

    let icon = cell(COL.icon);
    if (icon && icons && !icons.has(icon)) {
      warn(`${name}: Icon "${icon}" is not a known icon; using the layer default`, COL.icon);
      icon = undefined;
    }

    const facets: Record<string, string[]> = {};
    for (const facet of layer.facets) {
      const values = splitMulti(cell(facet.column));
      facets[facet.column] = values;
      for (const v of values) {
        if (!facet.values.includes(v)) {
          warn(`${name}: ${facet.column} "${v}" is not a configured value`, facet.column);
        }
      }
    }

    const extra: Record<string, string> = {};
    for (const column of extraColumns) {
      const v = cell(column);
      if (v) extra[column] = v;
    }

    places.push({
      id: placeId(name, cell(COL.id), warn),
      layerId: layer.id,
      region,
      name,
      branch: cell(COL.branch),
      starred,
      lat,
      lng,
      neighborhood,
      hours: cell(COL.hours),
      hoursOsm: cell(COL.hoursOsm),
      link: cell(COL.link),
      address,
      addressApproximate: approxPrefix !== undefined,
      notes: cell(COL.notes),
      lastVerified,
      icon,
      facets,
      extra,
    });
  });

  return { places, warnings, columns: headers.filter((h) => h !== "") };
}

function parseCoordinate(raw: string | undefined, min: number, max: number): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Split a multi-value cell on ";", trimming and dropping empties. */
export function splitMulti(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(MULTI_VALUE_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * URL-safe id fragment. Keeps letters and digits in any script (so Japanese
 * names stay readable), lowercases, joins everything else with "-".
 */
export function slug(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
