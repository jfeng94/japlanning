/**
 * Looks up each place's Google place ID (docs/proposals/directions-place-ids.md)
 * with the Places API (New) Text Search, and writes findings for Jerry to
 * review. Nothing goes into data/ here: the IDs he accepts are written in a
 * later step.
 *
 *   npm run placeids                    every place without a Place ID
 *   npm run placeids -- drinks:77 ...   just these
 *   npm run placeids -- --apply         write the accepted IDs into data/
 *
 * Each finding's decision starts as "accept" when nothing about it is in
 * doubt (`autoAccept`), else blank; Claude and Jerry settle the rest in
 * .cache/place-ids/findings.csv before --apply, which writes the Place ID
 * column of every row marked "accept" and leaves the others blank.
 *
 * The key is never in a request this script builds when it runs in a cloud
 * session: the cloud's proxy adds the X-Goog-Api-Key header (a network secret
 * for places.googleapis.com). On the PC it reads GOOGLE_MAPS_KEY and sends it
 * in that header. Neither way is it printed.
 *
 * Billing: the field mask asks for the ID plus Google's name, address,
 * location and status, to check each match. That is Text Search Pro, with
 * 5,000 free calls a month (pricing page, read 2026-11-18); one run is about
 * 510 places.
 *
 * Google's terms let us store place IDs but not the rest of what it returns
 * (its coordinates for 30 days at most). So responses are cached in
 * .cache/place-ids/ (gitignored) for reruns, for 30 days, and the findings,
 * which show Google's names and addresses, go there too, never into the repo.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { layers } from "../src/config/layers.ts";
import { regionOptions } from "../src/config/regions.ts";
import { parseLayerCsv } from "../src/data/parse.ts";
import type { Place } from "../src/data/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".cache", "place-ids");
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = ["id", "displayName", "formattedAddress", "location", "businessStatus"].map((f) => `places.${f}`).join(",");
/** Google's coordinates may be kept for 30 days; older cached responses are fetched again. */
const MAX_AGE_DAYS = 30;
/** Further than this from our pin, a match is flagged. */
const FAR_M = 100;

/** Places with no Google listing, never searched: a friend's home (docs/design/regions-layers-filters.md, "Lodging"). */
const NO_LISTING = new Set(["lodging:1", "lodging:2"]);

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
}

interface Cached {
  query: string;
  fetched: string;
  places: GooglePlace[];
}

/** One row of the findings. */
export interface Finding {
  place: string;
  name: string;
  branch: string;
  region: string;
  approximate: boolean;
  googleId: string;
  googleName: string;
  googleAddress: string;
  distanceM: number | "";
  status: string;
  /** Other listings that match the name within 50 m of the chosen one: "id name; id name". */
  others: string;
  flags: string[];
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Letters and digits only, lower case, without accents or long vowels,
 * full-width folded: "COVERT COFFEE" and "Covert Coffee" compare equal, as
 * do Himitsudō and Himitsudo, Shouten and Shoten.
 */
export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/ou|oo/g, "o")
    .replace(/uu/g, "u");
}

/**
 * Words that say what a place is, not which: "Wayfarer Hotel" is WAYFARER
 * Kyoto Shijo on Google, "Kameido Gyoza Honten" is Kameido Gyoza Main Store.
 */
const GENERIC = new Set([
  "the", "and", "co", "hotel", "coffee", "cafe", "tea", "bar", "shop", "store", "roasters", "roastery", "bakery",
  "honten", "sohonten", "honpo", "main", "temple", "shrine",
]);

/**
 * Our brand appears in Google's name or Google's in ours; or every word of
 * ours that isn't generic appears in Google's; or, for a name of three or
 * more such words, most of them, one at least four letters long ("Yaesu
 * Unagi Hashimoto" is Yaesu Hashimoto). Two-word names must match whole:
 * "Baji Tofu" is not Oni-tofu.
 */
export function namesMatch(ours: string, google: string): boolean {
  const [a, b] = [normName(ours), normName(google)];
  if (a === "" || b === "") return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words = ours
    .split(/[^\p{L}\p{N}]+/u)
    .map(normName)
    .filter((w) => w !== "" && !GENERIC.has(w));
  const found = words.filter((w) => b.includes(w));
  if (words.length > 0 && found.length === words.length) return true;
  return words.length >= 3 && found.length * 2 >= words.length && found.some((w) => w.length >= 4);
}

function queryFor(p: Place): string {
  return [p.name, p.addressApproximate ? p.branch : undefined, p.address].filter(Boolean).join(" ");
}

/**
 * The numbers in an address, in order, without the postal code or floors:
 * [3, 27, 10] for 東京都新宿区新宿3-27-10 武蔵野ビルB1F, [3, 27, 10] again
 * for Google's "〒160-0022 … 3-chōme−27−１０", [232, 7, 10011] for
 * 232 7th Ave, New York, NY 10011.
 */
export function addressNumbers(addr: string): number[] {
  const s = addr
    .normalize("NFKC")
    .replace(/〒?\d{3}-\d{4}/g, " ")
    .replace(/\bB?\d+F\b|\d+階|\d+号館/gi, " ");
  return [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

/**
 * Google's address holds our first two numbers in a row (the chome and
 * block, or a house number and street), or our only one: 3-27-10 matches
 * Google's 3-27 or 3-27-10, not 3-17-7.
 */
export function addressesMatch(ours: string, google: string): boolean {
  const o = addressNumbers(ours).slice(0, 2);
  const g = addressNumbers(google);
  if (o.length === 0) return true;
  return g.some((_, i) => o.every((n, j) => g[i + j] === n));
}

async function search(p: Place): Promise<Cached> {
  const file = path.join(CACHE, "responses", `${p.id.replace(":", "-")}.json`);
  const query = queryFor(p);
  try {
    const cached = JSON.parse(await readFile(file, "utf8")) as Cached;
    const age = (Date.now() - Date.parse(cached.fetched)) / 86_400_000;
    if (cached.query === query && age < MAX_AGE_DAYS) return cached;
  } catch {
    /* not cached yet */
  }
  const body = {
    textQuery: query,
    languageCode: "en",
    regionCode: p.region === "nyc" ? "US" : "JP",
    pageSize: 5,
    locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: p.addressApproximate ? 1500 : 300 } },
  };
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Goog-FieldMask": FIELDS };
  if (process.env.GOOGLE_MAPS_KEY) headers["X-Goog-Api-Key"] = process.env.GOOGLE_MAPS_KEY;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    const json = (await res.json()) as { places?: GooglePlace[]; error?: { status: string; message: string } };
    if (!res.ok) throw new Error(`${p.id}: HTTP ${res.status} ${json.error?.status ?? ""} ${json.error?.message?.slice(0, 200) ?? ""}`);
    const cached: Cached = { query, fetched: new Date().toISOString(), places: json.places ?? [] };
    await writeFile(file, JSON.stringify(cached, null, 1));
    return cached;
  }
}

/** Picks the listing for a place from Google's answers, and says what needs Jerry's eye. */
export function judge(p: Place, found: GooglePlace[]): Finding {
  const base = {
    place: p.id,
    name: p.name,
    branch: p.branch ?? "",
    region: p.region,
    approximate: p.addressApproximate,
  };
  const located = found.filter((g) => g.location);
  if (located.length === 0) {
    return { ...base, googleId: "", googleName: "", googleAddress: "", distanceM: "", status: "", others: "", flags: ["none"] };
  }
  const dist = (g: GooglePlace) => distanceM(p, { lat: g.location!.latitude, lng: g.location!.longitude });
  const sameAddress = (g: GooglePlace) => p.addressApproximate || addressesMatch(p.address ?? "", g.formattedAddress ?? "");
  // A listing whose name matches ours, at our address if one is, nearest first; else Google's first answer.
  const named = located
    .filter((g) => namesMatch(p.name, g.displayName?.text ?? ""))
    .sort((a, b) => Number(sameAddress(b)) - Number(sameAddress(a)) || dist(a) - dist(b));
  const pick = named[0] ?? located[0]!;
  const d = dist(pick);
  const others = named
    .filter((g) => g !== pick && distanceM({ lat: pick.location!.latitude, lng: pick.location!.longitude }, { lat: g.location!.latitude, lng: g.location!.longitude }) < 50)
    .map((g) => `${g.id} ${g.displayName?.text ?? ""}`);
  const flags: string[] = [];
  if (named.length === 0) flags.push("name");
  if (!sameAddress(pick)) flags.push("address");
  if (d > FAR_M) flags.push("far");
  if (others.length > 0) flags.push("two-listings");
  if (pick.businessStatus && pick.businessStatus !== "OPERATIONAL") flags.push("status");
  if (p.addressApproximate) flags.push("approx");
  return {
    ...base,
    googleId: pick.id,
    googleName: pick.displayName?.text ?? "",
    googleAddress: pick.formattedAddress ?? "",
    distanceM: Math.round(d),
    status: pick.businessStatus ?? "",
    others: others.join("; "),
    flags,
  };
}

/**
 * Accepted without review: the name and address match ours, Google doesn't
 * say it closed for good, and its pin is within 500 m of ours (further
 * means a pin of ours to fix, or another branch).
 */
export function autoAccept(f: Finding): boolean {
  return (
    !f.flags.includes("name") &&
    !f.flags.includes("address") &&
    !f.flags.includes("none") &&
    f.status !== "CLOSED_PERMANENTLY" &&
    typeof f.distanceM === "number" &&
    f.distanceM <= 500
  );
}

/** Writes each accepted ID into its layer's Place ID column, by the row's ID. */
async function apply(): Promise<void> {
  const rows = Papa.parse<Record<string, string>>(await readFile(path.join(CACHE, "findings.csv"), "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const accepted = new Map(rows.filter((r) => r.decision === "accept" && r.googleId).map((r) => [r.place, r.googleId!]));
  for (const layer of layers) {
    const file = path.join(ROOT, "data", `${layer.id}.csv`);
    const parsed = Papa.parse<Record<string, string>>(await readFile(file, "utf8"), { header: true, skipEmptyLines: "greedy" });
    const fields = parsed.meta.fields ?? [];
    let written = 0;
    for (const row of parsed.data) {
      const id = accepted.get(`${layer.id}:${row.ID}`);
      if (id && !row["Place ID"]) {
        row["Place ID"] = id;
        written++;
      }
    }
    if (written === 0) continue;
    const columns = fields.includes("Place ID") ? fields : [...fields, "Place ID"];
    await writeFile(file, Papa.unparse(parsed.data, { columns, newline: "\n" }) + "\n");
    console.log(`  ${layer.id}: ${written} Place IDs written`);
  }
  console.log("Now run npm run import -- <layer> for each, to normalise the files, and the tests.");
}

async function main(): Promise<void> {
  if (process.argv.includes("--apply")) return apply();
  const wanted = new Set(process.argv.slice(2));
  const places: Place[] = [];
  for (const layer of layers) {
    const text = await readFile(path.join(ROOT, "data", `${layer.id}.csv`), "utf8");
    for (const p of parseLayerCsv(text, layer, regionOptions()).places) {
      if (NO_LISTING.has(p.id) || p.googlePlaceId) continue;
      if (wanted.size > 0 && !wanted.has(p.id)) continue;
      places.push(p);
    }
  }
  await mkdir(path.join(CACHE, "responses"), { recursive: true });
  console.log(`placeids: ${places.length} places to look up`);

  const findings: Finding[] = [];
  let errors = 0;
  for (const [i, p] of places.entries()) {
    try {
      findings.push(judge(p, (await search(p)).places));
    } catch (e) {
      errors++;
      console.log(`  ${(e as Error).message}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1} / ${places.length}`);
  }

  const csv = Papa.unparse(findings.map((f) => ({ ...f, flags: f.flags.join(" "), decision: autoAccept(f) ? "accept" : "" })), { newline: "\n" });
  const out = path.join(CACHE, wanted.size > 0 ? "findings-partial.csv" : "findings.csv");
  await writeFile(out, csv + "\n");

  const count = (flag: string) => findings.filter((f) => f.flags.includes(flag)).length;
  console.log(`\n${findings.length} looked up, ${errors} errors -> ${path.relative(ROOT, out)}`);
  console.log(`  clean (name and address match, within ${FAR_M} m, one listing, operating): ${findings.filter((f) => f.flags.length === 0).length}`);
  console.log(`  accepted without review (autoAccept): ${findings.filter(autoAccept).length}`);
  for (const flag of ["none", "name", "address", "far", "two-listings", "status", "approx"]) console.log(`  ${flag.padEnd(13)} ${count(flag)}`);
}

if (import.meta.main) await main();
