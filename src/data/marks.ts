import type { HoursState } from "../hours/evaluate-all.ts";

/**
 * The one marker a row or pin shows next to a place, highest precedence
 * first: hours unknown, closed at the chosen moment, bookmarked, key
 * branch. Rows and pins read the same answer so the list and the map
 * never disagree.
 */
export type Mark = "unknown" | "closed" | "bookmark" | "star";

export interface MarkInputs {
  /** The evaluated open state, only for a layer with hours and once the parser has run; otherwise undefined. */
  hours?: HoursState;
  bookmarked: boolean;
  starred: boolean;
}

export function markFor({ hours, bookmarked, starred }: MarkInputs): Mark | undefined {
  if (hours === "unknown") return "unknown";
  if (hours === "closed") return "closed";
  if (bookmarked) return "bookmark";
  if (starred) return "star";
  return undefined;
}

/** Accessible names for the marks. */
export const MARK_LABELS: Record<Mark, string> = {
  unknown: "Hours unknown",
  closed: "Closed",
  bookmark: "Bookmarked",
  star: "Key branch",
};
