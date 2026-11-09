/**
 * Core data types. See docs/design/regions-layers-filters.md for the config
 * shapes and docs/proposals/m1-data-layer.md for the record rules.
 */

export type RegionId = "tokyo" | "kyoto" | "hakone";

/** Every layer id, as a tuple so LayerId is a checked string union. */
export const LAYER_IDS = ["drinks"] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export interface RegionConfig {
  id: RegionId;
  label: string;
  /**
   * Raw areas: where a place is, as a visitor would name it, with the ward
   * its addresses name and its neighbours. The data's Area column holds
   * these (docs/proposals/filters-and-areas.md).
   */
  areas: AreaConfig[];
  /** Merges that fold raw areas into one filter chip; an unmerged raw area is its own chip. */
  areaGroups?: AreaGroup[];
  /** Headings over wards for the area chips; none means one flat list. */
  areaSections?: AreaSection[];
  /** [west, south, east, north] in degrees. Basemap extract bounds (M7). */
  bbox?: [number, number, number, number];
}

export interface AreaConfig {
  /** "Takanawa": the value in the data's Area column. */
  label: string;
  /** As written in its places' addresses, e.g. "港区"; the build checks every address against it. */
  ward: string;
  /** Raw labels one hop away; the graph must be symmetric. */
  adjacent: string[];
}

export interface AreaGroup {
  /** The chip, e.g. "Tamachi · Takanawa". */
  label: string;
  /** Raw labels it folds together; the first decides the chip's section. */
  areas: string[];
}

export interface AreaSection {
  /** The heading, e.g. "Central". */
  label: string;
  /** Wards as written in addresses, e.g. ["千代田区", "中央区", "港区"]. */
  wards: string[];
}

export interface FacetConfig {
  /** Exact header text in the sheet, e.g. "Specialty". */
  column: string;
  /** Display name; defaults to column. */
  label?: string;
  /** Ordered. Values in the sheet but not listed here still render, after these. */
  values: string[];
  /**
   * Another facet column whose selection scopes this one: a value is
   * offered only when some row matching that selection holds it (Specialty
   * scoped by Kind shows coffee specialties for Coffee, tea ones for Tea).
   * No selection there means every value. A selected value is always kept.
   */
  scopeBy?: string;
}

export interface LayerConfig {
  id: LayerId;
  /**
   * Fixed region: every row is in it and the file needs no Region column.
   * Absent: each row says in its Region column (a region id); the layer
   * is available in every region. One file for the whole trip.
   */
  region?: RegionId;
  label: string;
  /** The layer's CSV, served from the site: data/<id>.csv in the repo, copied by the build. */
  dataUrl: string;
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
  /** The brand, for multi-branch shops; an older ★ prefix is stripped. */
  name: string;
  /** Which branch, when the name alone is ambiguous ("Yakumo" for Onibus Coffee). */
  branch?: string;
  /** Key branch of a brand: the Key column, or the older ★ prefix on Name. */
  starred: boolean;
  lat: number;
  lng: number;
  /** The raw area the place is in (the Area column). */
  area?: string;
  /** The filter chip it falls under: its area's merge, or the area itself. */
  areaGroup?: string;
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
