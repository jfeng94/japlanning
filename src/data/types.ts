/**
 * Core data types. See docs/design/regions-layers-filters.md for the config
 * shapes and docs/proposals/m1-data-layer.md for the record rules.
 */

export type RegionId = "tokyo" | "kyoto" | "hakone";

/** Every layer id, as a tuple so LayerId is a checked string union. */
export const LAYER_IDS = ["tokyo-coffee"] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export interface RegionConfig {
  id: RegionId;
  label: string;
  /** Ordered. The shared Neighborhood enum for every layer in this region. */
  neighborhoods: string[];
  /** [west, south, east, north] in degrees. Basemap extract bounds (M7). */
  bbox?: [number, number, number, number];
}

export interface FacetConfig {
  /** Exact header text in the sheet, e.g. "Specialty". */
  column: string;
  /** Display name; defaults to column. */
  label?: string;
  /** Ordered. Values in the sheet but not listed here still render, after these. */
  values: string[];
}

export interface LayerConfig {
  id: LayerId;
  region: RegionId;
  label: string;
  /** Published-to-web CSV URL. */
  csvUrl: string;
  /** Pin colour, one per layer type. */
  color: string;
  /** Pin glyph; interpreted by the map layer in M3. */
  icon: string;
  /** Whether rows carry hours and take part in "open now". */
  hasHours: boolean;
  facets: FacetConfig[];
  /** Facet columns shown as chips on a list row. Defaults to the first two facets. */
  rowFacets?: string[];
}

/** One row of a sheet after parsing. Blank cells become undefined, never "". */
export interface Place {
  /**
   * `${layerId}:${ID}` from the sheet's integer ID column: survives renames
   * and reorders, so bookmarks and share links keep working. A sheet without
   * the column, or a row whose ID is missing or duplicated, falls back to
   * `${layerId}:${slug(name)}` (with a -2, -3 suffix on repeats).
   */
  id: string;
  layerId: LayerId;
  region: RegionId;
  /** Display name with the ★ prefix stripped. The brand, for multi-branch shops. */
  name: string;
  /** Which branch, when the name alone is ambiguous ("Yakumo" for Onibus Coffee). */
  branch?: string;
  starred: boolean;
  lat: number;
  lng: number;
  neighborhood?: string;
  /** Human-readable hours, may contain caveats. */
  hours?: string;
  /** OpenStreetMap opening_hours syntax. */
  hoursOsm?: string;
  link?: string;
  /** Japanese address with any leading ~ stripped. */
  address?: string;
  /** True when the sheet marked the address with a leading ~ (neighborhood-level only). */
  addressApproximate: boolean;
  notes?: string;
  /** YYYY-MM-DD, only when the cell parsed as one. */
  lastVerified?: string;
  /** Icon id from the sheet's Icon column, when set and known; else the layer's default applies. */
  icon?: string;
  /** Facet column -> values. Always an array; [] means unknown. */
  facets: Record<string, string[]>;
  /** Non-blank cells in columns the layer config doesn't know about. */
  extra: Record<string, string>;
}

export interface ParseWarning {
  /** 1-based data row number (header is row 0), when the warning is about one row. */
  row?: number;
  column?: string;
  message: string;
}

export interface ParseResult {
  places: Place[];
  warnings: ParseWarning[];
  /** Header text of every column in the sheet, in sheet order. */
  columns: string[];
}

/** Where a layer's data came from, in order of preference. */
export type LoadSource = "network" | "cache" | "bundled" | "none";

export interface LoadResult {
  layerId: LayerId;
  source: LoadSource;
  places: Place[];
  warnings: ParseWarning[];
  /** When the text was fetched from the network (or built, for "bundled"). */
  fetchedAt?: Date;
  /** Set when source is "none", or to explain why a better source was skipped. */
  error?: string;
}
