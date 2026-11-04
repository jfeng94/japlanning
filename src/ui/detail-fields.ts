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

export interface DetailFields {
  /** Shown at half height: the street-corner set. */
  essentials: DetailRow[];
  /** The layer's row facets, as chips, at half height. */
  chips: string[];
  /** Shown at full height, below the essentials. */
  details: DetailSection[];
}

export function detailFields(place: Place, layer: LayerConfig | undefined): DetailFields {
  const essentials: DetailRow[] = [];
  if (place.address) {
    essentials.push({ label: "Address", value: place.address, ...(place.addressApproximate ? { flag: "approximate" as const } : {}) });
  }
  essentials.push(
    place.hours ? { label: "Hours", value: place.hours } : { label: "Hours", value: "Hours unknown", flag: "unknown" },
  );

  const rowFacets = layer?.rowFacets ?? layer?.facets.slice(0, 2).map((f) => f.column) ?? [];
  const chips = rowFacets.flatMap((column) => place.facets[column] ?? []);

  const details: DetailSection[] = [];
  if (place.notes) details.push({ title: "Notes", rows: [{ label: "", value: place.notes }] });

  if (layer && layer.facets.length > 0) {
    details.push({
      title: "Details",
      rows: layer.facets.map((f) => {
        const values = place.facets[f.column] ?? [];
        const label = f.label ?? f.column;
        return values.length > 0 ? { label, value: values.join(", ") } : { label, value: "Unknown", flag: "unknown" as const };
      }),
    });
  }

  const extra = Object.entries(place.extra);
  if (extra.length > 0) {
    details.push({ title: "Also in the sheet", rows: extra.map(([label, value]) => ({ label, value })) });
  }

  details.push({
    title: "Verified",
    rows: [
      place.lastVerified
        ? { label: "Last verified", value: place.lastVerified }
        : { label: "Last verified", value: "Hours unverified", flag: "unverified" },
    ],
  });

  return { essentials, chips, details };
}
