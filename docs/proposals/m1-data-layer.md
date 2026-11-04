# M1: Data layer

Status: **proposed** (2026-11-04). Waiting for go-ahead.

## Goal

Every layer's sheet becomes typed `Place` records in the browser, with the
last good copy cached so the app has data offline and survives a bad fetch.
The page shows, per layer, how many places loaded, where they came from and
when, and any rows or values the parser had to complain about. Implements
the config shapes from `docs/design/regions-layers-filters.md`.

## Done when

- [ ] `npm test` runs the parser and loader tests green, locally and in CI.
- [ ] The deployed page lists each configured layer with place count,
      source (network / cache / bundled), fetch time and warnings.
- [ ] In the installed app: load once online, enable airplane mode, cold
      launch. The page still shows the coffee layer from cache. (The app
      shell itself isn't offline until M7, so this test is "reload while the
      page is open" or run from the dev server with network throttled; the
      full cold-launch test is M7's.)
- [ ] Reordering two columns in the sheet and adding a junk column changes
      nothing except the junk column appearing under "extra" fields.

## What the live sheet looks like (2026-11-04)

39 rows, 14 KB, all coordinates valid, 7 starred names, 12 approximate
addresses, no multi-value cells yet. Blank enum cells are common: Roasting
10, Food 12, Specialty 12, Reservation 13, Hours (OSM) 18, Last verified 24.
So "blank = unknown" is the normal case, not an edge case.

Google serves the published CSV with `Access-Control-Allow-Origin: *` on the
final hop and `Cache-Control: private, max-age=300`. Cross-origin fetch from
the browser works, and edits take up to five minutes to show up.

## Design

### Records

```ts
interface Place {
  id: string;                 // `${layerId}:${slug(name)}`, stable across row reorders
  layerId: LayerId;
  region: RegionId;
  name: string;               // ★ stripped
  starred: boolean;
  lat: number;
  lng: number;
  neighborhood?: string;
  hours?: string;
  hoursOsm?: string;
  link?: string;
  address?: string;           // leading ~ stripped
  addressApproximate: boolean;
  notes?: string;
  lastVerified?: string;      // YYYY-MM-DD, only if it parses as one
  facets: Record<string, string[]>;   // facet column -> values; [] means unknown
  extra: Record<string, string>;      // non-blank cells in columns config doesn't know
}
```

Optional fields are `undefined` when the cell is blank or the column is
missing, never empty strings. Facets are always arrays, even for
single-value columns, so filter code has one code path.

### Parsing rules (`parseLayerCsv(text, layer, region)`)

- PapaParse with `header: true`, `skipEmptyLines: true`. Columns are looked
  up by header text after trimming. Column order is irrelevant.
- `Name`, `Latitude`, `Longitude` are required **columns**. A layer whose
  sheet lacks one fails to parse; the loader reports the error and falls
  back to the cache rather than replacing good data with nothing.
- A **row** with a blank name, or coordinates that don't parse or fall
  outside Japan's bounding box, is skipped with a warning naming the row.
  Current data has none; this catches a mis-pasted cell.
- `★` prefix sets `starred`, is stripped from `name`. Leading `~` or `～`
  sets `addressApproximate`, is stripped from `address`.
- Facet cells split on `;`, trimmed, empties dropped. Values not in the
  facet's configured list are kept (per the design doc) **and** produce a
  warning, so a typo like `Cafe` for `Café` surfaces in the status panel
  instead of silently becoming a seventh Format.
- Duplicate ids within a layer get a `-2`, `-3` suffix and a warning.
- Anything else non-blank in an unconfigured column lands in `extra`.
- Output: `{ places, warnings }`. Warnings are structured
  `{ row?: number, column?: string, message }`.

### Loading (`loadLayer(layer, deps)`)

Three sources, tried in order, first success wins:

1. **Network.** `fetch(csvUrl, { cache: "no-store" })` with a 10 s abort. On
   HTTP 200 and a clean parse, write `{ text, fetchedAt }` to the store and
   return `source: "network"`. A parse hard-error counts as failure: bad
   data never overwrites a good cache.
2. **Cache.** The stored text from the last good network load. Returns
   `source: "cache"` with its original `fetchedAt`.
3. **Bundled snapshot.** `/data/<layerId>.csv`, fetched at build time by
   the deploy workflow and shipped with the site. Returns
   `source: "bundled"` with the build time. This is what a first-ever
   launch with no signal gets, and what M7's service worker will cache for
   free as part of the app shell.

If all three fail the result is `source: "none"` with the error, and the UI
says so. `loadAllLayers(layers)` runs them in parallel; one layer failing
doesn't block the others.

`deps` (fetch, store, clock) are injected so tests can run the whole chain
with an in-memory store and a scripted fetch, without IndexedDB or network.

### Store

A key-value store over IndexedDB via `idb-keyval` (6 kB, no dependencies).
Keys are `layer:<layerId>`. One tiny interface, `get` / `set`, implemented
once for IndexedDB and once as an in-memory Map for tests.

Why not localStorage: it's synchronous, string-only, capped around 5 MB, and
M7 needs the same place to hold a basemap blob of tens of MB. IndexedDB does
both. Why a library rather than raw IndexedDB: the raw API is
event-callback-based and needs about 40 lines of boilerplate to do what
`get`/`set` do; the library is smaller than the boilerplate and widely used.

### Config

`src/config/regions.ts` and `src/config/layers.ts`, typed as in the design
doc. Tokyo gets its six neighborhoods from the sheet. Kyoto and Hakone exist
with empty neighborhood and layer lists, so the region switch in M2 has
something to switch to. Only `tokyo-coffee` is configured; its facets are
Format, Roasting, Food, Linger, Specialty, Reservation with the values from
`CLAUDE.md`.

### Snapshot at build

`scripts/snapshot-data.ts` imports the layer config, fetches each
`csvUrl`, writes `public/data/<layerId>.csv`. Node 26 runs TypeScript
directly, no build step. The deploy workflow runs it before `npm run
build`; `public/data/` is gitignored so the snapshot never gets committed.
Locally it's optional: without it the bundled fallback just 404s and the
loader moves on.

### Page

The M0 page gains a "Data" section above the capability panel: one row per
layer with label, count, source, fetched time, and an expandable warning
list. A "Refresh" button re-runs the network load so the cache can be
exercised by hand. M2 replaces this page; the status rows survive into a
settings/diagnostics view later.

### Tests (vitest)

Fixtures: `src/data/__fixtures__/tokyo-coffee.csv`, a committed snapshot of
today's sheet (public data, 14 kB), and `stub-lodging.csv`, six rows with a
different schema (`Who` column, no hours, one approximate address, one
multi-value cell, one junk column, one row with bad coordinates).

Parser tests:

- parses every row of the coffee fixture; counts match the profile above
- header lookup survives reordered columns and an unknown column
- missing optional column yields `undefined`, not `""`
- missing required column throws
- blank facet cell gives `[]`; `;`-separated cell gives trimmed array
- unlisted facet value is kept and warned
- `★` and `~` handling, including the full-width `～`
- bad coordinate row is skipped with a warning that names the row
- `Last verified` that isn't `YYYY-MM-DD` becomes `undefined` with a warning
- duplicate names get suffixed ids

Loader tests (scripted fetch, in-memory store):

- network OK → stored, `source: "network"`
- network 500 with cache → `source: "cache"`, cache untouched
- network OK but unparsable → cache returned, cache untouched
- no network, no cache, bundled present → `source: "bundled"`
- nothing → `source: "none"` with error
- timeout fires → treated as network failure

CI runs `npm test` before `npm run build`.

## Files

```
src/config/regions.ts            new
src/config/layers.ts             new
src/data/types.ts                new
src/data/parse.ts                new
src/data/load.ts                 new
src/data/store.ts                new
src/data/__fixtures__/*.csv      new
src/data/parse.test.ts           new
src/data/load.test.ts            new
src/ui/data-status.ts            new
src/main.ts                      add the Data section
scripts/snapshot-data.ts         new
vite.config.ts                   vitest config block
package.json                     deps + test script
.github/workflows/deploy.yml     snapshot + test steps
.gitignore                       public/data/
tsconfig.json                    erasableSyntaxOnly (so Node can run the script)
```

Dependencies: `papaparse` 5.7 and `idb-keyval` 6.3 at runtime;
`@types/papaparse`, `vitest` 5.1 for dev.

## Order of work

Each step is one reviewable commit.

1. Config and types, with the coffee layer and three regions.
2. Parser plus fixtures and parser tests. **Self-contained and pure; the
   natural piece if Jerry wants to write one himself.**
3. Store interface, IndexedDB and in-memory implementations.
4. Loader with the three-source chain and loader tests.
5. Data section on the page; verify live on the phone.
6. Snapshot script and workflow steps. Separable: cut it if it feels like
   too much for M1.

## Out of scope

Open-now evaluation (M5), any filtering (M2), service worker (M7), fetching
on an interval or in the background, editing data in-app.

## Open questions

- **Unlisted facet values: keep and warn** (proposed above) vs treat as a
  parse error for that cell. Keep-and-warn is friendlier mid-trip; error is
  stricter about schema hygiene.
- **Id from name slug.** Renaming a shop in the sheet changes its id, which
  only matters once ids appear in URLs (M2). Alternative: an explicit `Id`
  column Jerry maintains. Slug is proposed; revisit if renames get annoying.
- **Rows without coordinates: skip** (proposed) vs keep in the list without
  a pin. Skip is simpler and the sheet currently has none.
- **Keep the build-time snapshot** (step 6) in M1, or defer to M7?

## Diff size

About 12 new files, roughly 600 lines including fixtures and tests. Steps 2
and 4 are the only ones over 100 lines.

## Results

(filled in after acceptance)
