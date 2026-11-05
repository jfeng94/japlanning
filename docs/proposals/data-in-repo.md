# Data in the repo

Status: **proposed** (2026-11-05), waiting for a go-ahead.

## Why

The brief says each layer is a Google Sheet Jerry edits by hand. Hand
edits turned out to be the error-prone part: the ID, Branch and Key
columns and the name clean-up are a 39-row, four-column change with no
way to check it before the app sees it. Jerry's preferred workflow is to
hand information to Claude and have it canonicalised, which wants a
source of truth that a script can validate and a diff can review. Git is
that. Decided 2026-11-05 over a Sheets-API writer (service account, two
sources of truth) and a generated CSV imported by hand (still manual).

## What changes

1. **One CSV per layer in the repo**, `data/<layer-id>.csv`, with the
   columns the loader already reads. It is the source of truth; the
   Google Sheet becomes a read-only reference and can be deleted later.
2. **The app fetches its data from its own origin.** `LayerConfig.csvUrl`
   becomes `dataUrl: "/data/<id>.csv"`. The loader's three tiers stay as
   they are (network, then the device cache, then the bundled copy); the
   network tier now reads the deployed file, same origin, no CORS, and a
   data change reaches phones the next time the app is opened online,
   exactly as a sheet edit did.
3. **The snapshot step validates instead of fetching.** `npm run snapshot`
   parses each `data/*.csv`, fails the build on a missing required
   column, a bad ID (blank, non-integer, repeat) or a facet value outside
   the configured list, and copies the file into `public/data/`. A bad
   edit cannot deploy.
4. **The test fixture is the real file.** The parser test that reads a
   snapshot of the live sheet reads `data/tokyo-coffee.csv` instead, so
   every test run validates the real data too.
5. **Editing workflow.** Jerry says what to add or change; Claude edits
   the CSV, runs `npm test`, commits with a message naming the places,
   pushes; Actions deploys in about a minute. Diffs are one row per place,
   so review is by eye. `npm run ids` keeps printing the next free ID.
6. **Importer kept for later** (small): `npm run import -- <layer> <csv
   url or file>` normalises an external CSV into `data/<layer>.csv`:
   assigns the next free IDs to rows without one, keeps existing IDs,
   warns on everything the snapshot step would fail on. For the day a
   spreadsheet is the faster way to research twenty new places.

## Migration of the coffee layer (one time)

Run the importer against the published sheet, then apply the schema
edits in the resulting file, and commit the whole thing as one change
with the diff shown to Jerry first:

- `ID`: 1 to 39 in the sheet's current row order.
- `Key`: `★` on rows 1, 7, 20, 22, 28, 34, 38; the `★` prefix stripped
  from those names.
- `Branch` and `Name` per the table below; all other rows keep their
  name and get an empty Branch.

| ID | Name | Branch |
| --- | --- | --- |
| 1 | Glitch Coffee & Roasters | Jimbocho |
| 2 | Glitch Coffee | Ginza |
| 3 | Glitch Tokyo | Nihonbashi |
| 6 | Ogawa Coffee Laboratory | Takanawa (KURA:000) |
| 8 | Fuglen | Asakusa |
| 13 | Koffee Mameya | Omotesando |
| 14 | Sedai Coffee and Roasters | Shibuya |
| 15 | Obscura | Shibuya Front |
| 17 | Higuma Doughnuts × Coffee Wrights | Omotesando |
| 18 | About Life Coffee Brewers | Shibuya 1-chome |
| 20 | Fuglen | Tomigaya |
| 25 | Sedai Coffee | Hatagaya |
| 28 | Onibus Coffee | Nakameguro Ekimae |
| 29 | Onibus Coffee | Nakameguro 3-chome |
| 30 | Onibus Coffee | Yakumo |
| 31 | Onibus Coffee | Jiyugaoka |
| 32 | Sidewalk Stand | Nakameguro |
| 33 | little cloud coffee | Nakameguro |
| 34 | Obscura | Sangenjaya Home |
| 35 | Obscura | Sangenjaya Laboratory |
| 36 | Obscura | Mart |
| 38 | Ogawa Coffee Laboratory | Sakurashinmachi |
| 39 | Ogawa Coffee Laboratory | Shimokitazawa |

Place ids change once (`tokyo-coffee:<slug>` becomes
`tokyo-coffee:<ID>`), so bookmarks and share links from testing stop
matching. Accepted earlier; no migration for test data.

## CSV conventions

So diffs stay readable and the file round-trips through PapaParse:

- Header row exactly as the loader's column names; column order fixed
  (`ID, Name, Branch, Key, Latitude, Longitude, Neighborhood, …`).
- One row per line, LF line endings, trailing newline, UTF-8 without BOM.
- Quote a cell only when it holds a comma, a quote or a newline; the
  importer and any script that writes the file use PapaParse's `unparse`
  with those settings, so hand edits and script edits look the same.
- Rows kept in ID order.

## Files

- `data/tokyo-coffee.csv` (new, from the migration).
- `src/config/layers.ts`: `csvUrl` → `dataUrl`; `src/data/types.ts`
  likewise; `src/data/load.ts` reads `dataUrl`.
- `scripts/snapshot-data.ts`: validate and copy, no fetch.
- `scripts/check-ids.ts`: reads the repo files.
- `scripts/import-csv.ts` (new) and the `import` npm script.
- `src/data/parse.test.ts`: fixture path; delete
  `src/data/fixtures/tokyo-coffee.csv`.
- Docs: `CLAUDE.md` (Data source section, column table lives on), the
  design doc's Layers section, this file.

About 8 files, mostly deletions in the snapshot script; one new script of
roughly 80 lines. The data change itself is the one to review.

## Done when

- [ ] `data/tokyo-coffee.csv` holds the migrated rows; the diff against
      the sheet is only the ID, Branch, Key columns and the renamed names.
- [ ] `npm test` and `npm run snapshot` validate the file; a deliberate
      duplicate ID fails both.
- [ ] The deployed app shows the branches muted after the names, the
      stars on the key branches, and the same 39 pins.
- [ ] `npm run import` round-trips the file unchanged.
