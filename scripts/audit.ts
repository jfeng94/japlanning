/**
 * The audit scorecard (docs/design/auditing-places.md): how close each
 * region's places are to scrubbed, and what to work on next.
 *
 *   npm run audit                          every region's scorecard
 *   npm run audit -- --next 5              plus the next five places, in queue order
 *   npm run audit -- --next 1 --region kyoto
 *   npm run audit -- --place food:46       everything we hold on one place
 *
 * It reads the data files (parsed as the app parses them), the audit
 * queue (docs/research/audit-queue.csv: per-place problems) and the
 * decisions file (docs/research/audit-decisions.md: questions for Jerry).
 * It changes nothing.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { layers } from "../src/config/layers.ts";
import { areasOf, regionById, regionOptions } from "../src/config/regions.ts";
import { parseLayerCsv } from "../src/data/parse.ts";
import type { Place, RegionId } from "../src/data/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const QUEUE = "docs/research/audit-queue.csv";
const DECISIONS = "docs/research/audit-decisions.md";
const SOURCES = "docs/research/places-sources-2026-11-09.csv";

/** A stop on the trip: a region, or one of its area sections (by its heading on the Area page). */
interface Stop {
  region: RegionId;
  section?: string;
}

/**
 * The trip in the order the group visits (Jerry, 2026-11-10): Tokyo, then
 * Nara and Uji on a day trip, then the rest of Kyoto. Osaka and Hakone
 * aren't placed yet, so they come last. The queue works through the
 * stops in this order; a place belongs to the first stop it matches.
 */
const TRIP: Stop[] = [
  { region: "tokyo" },
  { region: "nara" },
  { region: "kyoto", section: "Uji" },
  { region: "kyoto" },
  { region: "osaka" },
  { region: "hakone" },
];

const stopLabel = (s: Stop): string => (s.section ? `${s.region}·${s.section.toLowerCase()}` : s.region);

/** The index in TRIP of the stop a place belongs to. */
function stopOf(p: Place): number {
  const ward = p.area ? areasOf(p.region).wardOf(p.area) : undefined;
  const i = TRIP.findIndex((s) => {
    if (s.region !== p.region) return false;
    if (!s.section) return true;
    const section = regionById(s.region).areaSections?.find((x) => x.label === s.section);
    return ward !== undefined && (section?.wards.includes(ward) ?? false);
  });
  return i >= 0 ? i : TRIP.length;
}

/** What keeps a place from being scrubbed, worst first: the order the queue works in within a region. */
const GAPS = [
  ["decide", "a question for Jerry (audit-decisions.md)"],
  ["locate", "not located: the pin is a station or a guess"],
  ["identity", "maybe not the shop the list meant"],
  ["status", "maybe closed or moved"],
  ["address", "approximate address (~)"],
  ["pin", "rough pin: the block, not the door"],
  ["no-hours", "no hours at all"],
  ["disagree", "sources disagree"],
  ["other", "another open point in the queue"],
  ["unverified", "hours not read from the shop's own site or Instagram"],
] as const;
type Gap = (typeof GAPS)[number][0];
const RANK = new Map(GAPS.map(([g], i) => [g, i]));

interface QueueRow {
  priority: string;
  id: string;
  problem: string;
  detail: string;
}

/** A queue tag ("not located: pinned at 下北沢 station") as a gap. */
function gapOfTag(tag: string): Gap {
  if (tag.startsWith("not located")) return "locate";
  if (tag.startsWith("low-confidence identity")) return "identity";
  if (tag.startsWith("status")) return "status";
  if (tag.startsWith("approximate address")) return "address";
  if (tag.startsWith("rough pin")) return "pin";
  if (tag.startsWith("no hours")) return "no-hours";
  if (tag.startsWith("sources disagree")) return "disagree";
  return "other";
}

function gapsOf(p: Place, queue: QueueRow | undefined, question: string | undefined): Set<Gap> {
  const gaps = new Set<Gap>();
  if (question) gaps.add("decide");
  for (const tag of queue?.problem.split(";").map((t) => t.trim()).filter(Boolean) ?? []) gaps.add(gapOfTag(tag));
  if (p.addressApproximate) gaps.add("address");
  if (!p.hours) gaps.add("no-hours");
  else if (!p.lastVerified) gaps.add("unverified");
  return gaps;
}

const worst = (gaps: Set<Gap>): number => Math.min(...[...gaps].map((g) => RANK.get(g)!), GAPS.length);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const places: Place[] = [];
  for (const layer of layers) {
    const text = await readFile(path.join(ROOT, "data", `${layer.id}.csv`), "utf8");
    places.push(...parseLayerCsv(text, layer, regionOptions()).places);
  }
  const queue = new Map(
    Papa.parse<QueueRow>(await readFile(path.join(ROOT, QUEUE), "utf8"), { header: true, skipEmptyLines: true }).data.map((r) => [r.id, r]),
  );
  const questions = new Map<string, string>();
  for (const line of (await readFile(path.join(ROOT, DECISIONS), "utf8")).split("\n")) {
    const m = /^\|.*\(([a-z]+:\d+)\)\s*\|(.*)\|\s*$/.exec(line);
    if (m) questions.set(m[1]!, m[2]!.trim());
  }
  const sources = new Map(
    Papa.parse<Record<string, string>>(await readFile(path.join(ROOT, SOURCES), "utf8"), { header: true, skipEmptyLines: true }).data.map((r) => [r["id"]!, r]),
  );
  const rows = places.map((p) => ({ p, gaps: gapsOf(p, queue.get(p.id), questions.get(p.id)) }));

  // One place, in full: what the session presents and researches from.
  const one = flag("place");
  if (one) {
    const row = rows.find((r) => r.p.id === one);
    if (!row) throw new Error(`no place ${one}`);
    const { p } = row;
    const q = queue.get(p.id);
    const s = sources.get(p.id);
    const lines = [
      `${p.id} ${p.name}${p.branch ? ` (${p.branch})` : ""} [${p.region}/${p.area ?? "?"}]`,
      `  address: ${p.addressApproximate ? "~" : ""}${p.address ?? "(none)"}   pin: ${p.lat}, ${p.lng}`,
      `  hours: ${p.hours ?? "(none)"}   osm: ${p.hoursOsm ?? "(none)"}   verified: ${p.lastVerified ?? "no"}`,
      `  link: ${p.link ?? "(none)"}`,
      `  notes: ${p.notes ?? ""}`,
      `  gaps: ${[...row.gaps].join(", ") || "none: scrubbed"}`,
      ...(q ? [`  queue [${q.priority}] ${q.problem}: ${q.detail}`] : []),
      ...(questions.get(p.id) ? [`  decide: ${questions.get(p.id)}`] : []),
      ...(s ? [`  research: confidence ${s["confidence"] || "?"}; hours from ${s["hours_source"] || "?"}; list line ${s["line"]}`, ...(s["sources"] ? [`  sources: ${s["sources"]}`] : [])] : []),
    ];
    console.log(lines.join("\n"));
    return;
  }

  // The scorecard, one line per stop in trip order.
  const cols: Gap[] = ["decide", "locate", "identity", "status", "address", "pin", "no-hours", "disagree", "other", "unverified"];
  const header = ["stop", "places", "scrubbed", "ready*", ...cols];
  const table: string[][] = [header];
  for (const [i, stop] of [...TRIP.entries(), [TRIP.length, { region: "unplaced" as RegionId }] as const]) {
    const inRegion = rows.filter((r) => stopOf(r.p) === i);
    if (inRegion.length === 0) continue;
    const region = stopLabel(stop);
    const scrubbed = inRegion.filter((r) => r.gaps.size === 0).length;
    const ready = inRegion.filter((r) => [...r.gaps].every((g) => g === "unverified")).length;
    table.push([region, String(inRegion.length), String(scrubbed), String(ready), ...cols.map((g) => String(inRegion.filter((r) => r.gaps.has(g)).length))]);
  }
  const total = rows.length;
  const allReady = rows.filter((r) => [...r.gaps].every((g) => g === "unverified")).length;
  table.push(["all", String(total), String(rows.filter((r) => r.gaps.size === 0).length), String(allReady), ...cols.map((g) => String(rows.filter((r) => r.gaps.has(g)).length))]);
  const widths = header.map((_, i) => Math.max(...table.map((row) => row[i]!.length)));
  console.log("Audit scorecard (docs/design/auditing-places.md)\n");
  for (const row of table) console.log(row.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join("  "));
  console.log(`\n* ready: nothing left but unverified hours. Columns count places with each gap:`);
  for (const [g, what] of GAPS) console.log(`  ${g.padEnd(10)} ${what}`);

  // The next places, in queue order: trip order, then the worst gap, then the queue's priority, then id.
  const next = Number(flag("next") ?? 0);
  if (next > 0) {
    const only = flag("region") as RegionId | undefined;
    const PRIORITY: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const order = (r: (typeof rows)[number]) => [
      stopOf(r.p),
      worst(r.gaps),
      PRIORITY[queue.get(r.p.id)?.priority ?? "low"] ?? 3,
    ];
    const pending = rows
      .filter((r) => [...r.gaps].some((g) => g !== "unverified") && (!only || r.p.region === only))
      .sort((a, b) => {
        const [x, y] = [order(a), order(b)];
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
        return a.p.id.localeCompare(b.p.id, "en", { numeric: true });
      });
    console.log(`\nNext ${Math.min(next, pending.length)} of ${pending.length} not yet ready${only ? ` in ${only}` : ""}:`);
    for (const { p, gaps } of pending.slice(0, next)) {
      console.log(`  ${p.id}  ${p.name}${p.branch ? ` (${p.branch})` : ""} [${p.region}/${p.area ?? "?"}]: ${[...gaps].join(", ")}`);
    }
  }
}

await main();
