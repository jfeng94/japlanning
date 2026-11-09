import type { AreaConfig, RegionConfig } from "./types.ts";

/**
 * Areas in three layers (docs/proposals/filters-and-areas.md):
 *
 * - raw areas are facts: where a place is (the data's Area column), with
 *   the ward its addresses name and its neighbours;
 * - merges fold raw areas into the filter chips, as interpretation that
 *   can change without touching the data;
 * - sections put the chips under headings by ward in the filter sheet.
 *
 * Everything here derives from config and is pure.
 */

export interface AreaChip {
  label: string;
  /** Raw areas it stands for, in config order. */
  members: string[];
  /** The ward of its first member, which decides its section. */
  ward: string;
}

export interface AreaSectionView {
  /** The heading; undefined for a region shown as one flat list. */
  label?: string;
  /** Alphabetical. */
  chips: AreaChip[];
}

export interface AreaIndex {
  /** Raw labels, config order. */
  raw: readonly string[];
  has(raw: string): boolean;
  wardOf(raw: string): string | undefined;
  /** The chip a raw area falls under (itself when unmerged); undefined for an unknown label. */
  groupOf(raw: string): string | undefined;
  chip(label: string): AreaChip | undefined;
  /** Every chip, alphabetical. */
  chips: readonly AreaChip[];
  /** Headings in config order, each with its chips; one unlabelled section when the region has none. */
  sections: readonly AreaSectionView[];
  /**
   * The chips one hop from any of the given ones, on the graph where each
   * merge is a single node: everything a member touches, minus the given
   * chips. One hop, not everything connected, which would be the city.
   */
  neighbours(chips: Iterable<string>): Set<string>;
}

type AreaSource = Pick<RegionConfig, "areas" | "areaGroups" | "areaSections">;

const byLabel = (a: { label: string }, b: { label: string }): number => a.label.localeCompare(b.label, "en", { sensitivity: "base" });

export function areaIndex(region: AreaSource): AreaIndex {
  const rawConfig = new Map(region.areas.map((a) => [a.label, a]));
  const groupOfRaw = new Map<string, string>();
  const chips: AreaChip[] = [];
  for (const g of region.areaGroups ?? []) {
    const members = g.areas.filter((a) => rawConfig.has(a) && !groupOfRaw.has(a));
    if (members.length === 0) continue;
    for (const m of members) groupOfRaw.set(m, g.label);
    chips.push({ label: g.label, members, ward: rawConfig.get(members[0]!)!.ward });
  }
  for (const a of region.areas) {
    if (groupOfRaw.has(a.label)) continue;
    groupOfRaw.set(a.label, a.label);
    chips.push({ label: a.label, members: [a.label], ward: a.ward });
  }
  chips.sort(byLabel);
  const chipByLabel = new Map(chips.map((c) => [c.label, c]));

  // The contracted graph: each chip and the chips its members touch.
  const chipNeighbours = new Map<string, Set<string>>();
  for (const c of chips) {
    const out = new Set<string>();
    for (const m of c.members) {
      for (const b of rawConfig.get(m)?.adjacent ?? []) {
        const g = groupOfRaw.get(b);
        if (g !== undefined && g !== c.label) out.add(g);
      }
    }
    chipNeighbours.set(c.label, out);
  }

  // Sections in config order; a ward no section names gets a heading of its own after them.
  const sections: AreaSectionView[] = [];
  if (region.areaSections && region.areaSections.length > 0) {
    const sectionOfWard = new Map<string, number>();
    region.areaSections.forEach((s, i) => s.wards.forEach((w) => sectionOfWard.set(w, i)));
    const views: AreaSectionView[] = region.areaSections.map((s) => ({ label: s.label, chips: [] }));
    for (const c of chips) {
      let i = sectionOfWard.get(c.ward);
      if (i === undefined) {
        i = views.length;
        sectionOfWard.set(c.ward, i);
        views.push({ label: c.ward, chips: [] });
      }
      views[i]!.chips.push(c);
    }
    sections.push(...views.filter((v) => v.chips.length > 0));
  } else if (chips.length > 0) {
    sections.push({ chips });
  }

  return {
    raw: region.areas.map((a) => a.label),
    has: (raw) => rawConfig.has(raw),
    wardOf: (raw) => rawConfig.get(raw)?.ward,
    groupOf: (raw) => groupOfRaw.get(raw),
    chip: (label) => chipByLabel.get(label),
    chips,
    sections,
    neighbours(selected) {
      const sel = new Set(selected);
      const out = new Set<string>();
      for (const s of sel) {
        for (const n of chipNeighbours.get(s) ?? []) if (!sel.has(n)) out.add(n);
      }
      return out;
    },
  };
}

/** Everything wrong with a region's area config, for the tests; empty when it is sound. */
export function areaProblems(region: AreaSource): string[] {
  const out: string[] = [];
  const raw = new Map<string, AreaConfig>();
  for (const a of region.areas) {
    if (raw.has(a.label)) out.push(`${a.label} is defined twice`);
    raw.set(a.label, a);
    if (!a.ward) out.push(`${a.label} has no ward`);
  }
  for (const a of region.areas) {
    for (const b of a.adjacent) {
      const other = raw.get(b);
      if (b === a.label) out.push(`${a.label} lists itself as a neighbour`);
      else if (!other) out.push(`${a.label} lists an unknown neighbour, ${b}`);
      else if (!other.adjacent.includes(a.label)) out.push(`${a.label} lists ${b}, but ${b} does not list ${a.label}`);
    }
  }
  const seen = new Map<string, string>();
  for (const g of region.areaGroups ?? []) {
    for (const m of g.areas) {
      if (!raw.has(m)) out.push(`merge ${g.label} names an unknown area, ${m}`);
      else if (seen.has(m)) out.push(`${m} is in two merges, ${seen.get(m)} and ${g.label}`);
      else seen.set(m, g.label);
    }
  }
  const labels = areaIndex(region).chips.map((c) => c.label);
  for (const l of new Set(labels.filter((l, i) => labels.indexOf(l) !== i))) out.push(`two chips are labelled ${l}`);
  return out;
}

/**
 * The ward (区) or city a Japanese address names: 渋谷区 in 東京都渋谷区神宮前,
 * 東山区 in 京都府京都市東山区清水, 宇治市 in 京都府宇治市宇治妙楽, 箱根町 in
 * 神奈川県足柄下郡箱根町. Undefined when there is no address.
 */
export function wardFromAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;
  const rest = address.replace(/^[~～]/, "").replace(/^(?:東京都|北海道|京都府|大阪府|[^都道府県]{2,3}県)/, "");
  const cityWard = /^.+?市(.+?区)/.exec(rest); // a city with wards: 京都市東山区
  if (cityWard) return cityWard[1];
  return /^(?:.+?郡)?(.+?[区市町村])/.exec(rest)?.[1];
}
