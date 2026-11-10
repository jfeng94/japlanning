import type { LayerConfig, Place } from "../data/types.ts";

/**
 * What the card shows, as data. Pure so the rows and their order are
 * testable, and so a new layer gets a complete card from its config.
 */

export type RowFlag = "approximate" | "unverified" | "unknown";

export interface DetailRow {
  label: string;
  value: string;
  flag?: RowFlag;
}

export interface DetailSection {
  title?: string;
  rows: DetailRow[];
}

export interface DetailRating {
  /** As written in the data, e.g. "4.3". */
  value: string;
  /** Review count, when known. */
  count?: string;
  /** Snapshot date, when known. */
  on?: string;
}

export interface DetailFields {
  /** The Google rating snapshot, first thing in the body (2026-11-05). */
  rating?: DetailRating;
  /** Free text, right under the rating: the natural way to browse (2026-11-05). */
  notes?: string;
  /** Shown at half height: the street-corner set. */
  essentials: DetailRow[];
  /** The layer's row facets, as chips, at half height. */
  chips: string[];
  /** Shown at full height, below the essentials. */
  details: DetailSection[];
}

const RATING_COLUMNS = ["Google rating", "Google reviews", "Rated on"];

export function detailFields(place: Place, layer: LayerConfig | undefined): DetailFields {
  const ratingValue = place.extra["Google rating"];
  const rating: DetailRating | undefined = ratingValue
    ? { value: ratingValue, ...(place.extra["Google reviews"] ? { count: place.extra["Google reviews"] } : {}), ...(place.extra["Rated on"] ? { on: place.extra["Rated on"] } : {}) }
    : undefined;

  const essentials: DetailRow[] = [];
  if (place.address) {
    essentials.push({ label: "Address", value: place.address, ...(place.addressApproximate ? { flag: "approximate" as const } : {}) });
  }
  // Hours not read from the shop's own site or Instagram carry their badge here, as an approximate address does
  // (docs/proposals/content-pass.md, 2026-11-10).
  essentials.push(
    place.hours
      ? { label: "Hours", value: place.hours, ...(place.lastVerified ? {} : { flag: "unverified" as const }) }
      : { label: "Hours", value: "Hours unknown", flag: "unknown" },
  );

  const rowFacets = layer?.rowFacets ?? layer?.facets.slice(0, 2).map((f) => f.column) ?? [];
  const chips = rowFacets.flatMap((column) => place.facets[column] ?? []);

  const details: DetailSection[] = [];

  // Branch first, then only the facets this place has a value for; a blank is nothing to read, so it
  // says nothing (2026-11-05). Verified hours end the list with the date they were read, to judge freshness.
  const rows: DetailRow[] = place.branch ? [{ label: "Branch", value: place.branch }] : [];
  for (const f of layer?.facets ?? []) {
    const values = place.facets[f.column] ?? [];
    if (values.length > 0) rows.push({ label: f.label ?? f.column, value: values.join(", ") });
  }
  if (place.lastVerified) rows.push({ label: "Hours checked", value: place.lastVerified });
  if (rows.length > 0) details.push({ title: "Details", rows });

  const extra = Object.entries(place.extra).filter(([k]) => !RATING_COLUMNS.includes(k));
  if (extra.length > 0) {
    details.push({ title: "Also in the sheet", rows: extra.map(([label, value]) => ({ label, value })) });
  }

  return { ...(rating ? { rating } : {}), ...(place.notes ? { notes: place.notes } : {}), essentials, chips, details };
}
