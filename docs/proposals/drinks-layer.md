# One drinks layer, region per row

Status: **approved** (2026-11-05), building.

## Why

Tea shops and bars use the coffee schema: a place with a format, food,
how long you linger, hours, a link, an address, notes. Three layers with
the same columns is three config entries and three files to keep in
step, and no way to filter across them. One **drinks** layer with a
`Kind` column makes a tea shop a row, not config. The same thought
applied to cities: one file for the whole trip, with a `Region` column,
rather than a file per city per type. Decided 2026-11-05 with Jerry.

## What changes

### The layer model

A layer stops being "one type in one region" and becomes "one type".
`LayerConfig.region` goes optional: a layer with it set keeps today's
behaviour (every row in that region, no column needed); a layer without
it reads a **`Region`** column per row, which must hold a region id
(`tokyo`, `kyoto`, `hakone`). A bad or blank Region warns and skips the
row, and the build fails on the warning like any other. Neighborhood is
validated against the row's region. "Which layers are in this region"
becomes "layers fixed to it, plus layers with no fixed region"; a region
with no rows just shows an empty list.

### The drinks layer

`id: "drinks"`, label Drinks, default icon coffee, `data/drinks.csv`.
Facets, in order:

- **Kind**: Coffee · Tea · Bar (first, so it is the first filter section).
- Format, Roasting, Food, Linger, Reservation as today.
- **Specialty**, extended for the new kinds: the coffee values, then
  Matcha · Sencha · Chinese tea · Cocktails · Sake · Whisky · Natural
  wine · Craft beer. Starting points; values are config and the build
  rejects a row whose value is not listed, so the list grows with the
  data on purpose.

Roasting stays coffee-only; a blank cell is "unknown" and the
include-unknown toggle (on by default) keeps tea rows visible until it is
turned off. Row chips stay Format · Specialty · Linger.

### Icons

The global enum gains **tea** and **bar**, from Jerry's artwork. The DOM
renderer uses the artwork as is. The SDF renderer takes its silhouette
from the artwork's alpha channel, so one file serves both when the
background is transparent. A row's `Icon` cell picks one; blank means the
layer default (coffee). The migration sets `Icon` by Kind on every row so
the artwork is the signal, and a future row can still override it (the
"special location" case).

### Ids

The layer id is in every place id, so `tokyo-coffee:17` becomes
`drinks:17`. Nothing real is bookmarked yet, so this costs nothing now;
the same change later would. Reason to do both halves at once.

## Migration (one time)

- `data/tokyo-coffee.csv` → `data/drinks.csv`.
- Add `Region` = `tokyo` and `Kind` = `Coffee` and `Icon` = `coffee` on
  all 39 rows. Column order: ID, Name, Branch, Key, Region, Latitude,
  Longitude, Neighborhood, Kind, Icon, then the existing columns.
- No other edits; IDs 1–39 unchanged.

## Files

- `src/data/types.ts`: `region?` on LayerConfig; `LAYER_IDS = ["drinks"]`.
- `src/data/parse.ts`: Region column, `neighborhoodsFor(region)` option.
- `src/data/load.ts`, `scripts/snapshot-data.ts`, `scripts/import-csv.ts`,
  `scripts/check-ids.ts`: the new parse option; the importer's leading
  columns gain Region.
- `src/filter/state.ts` (`layersInRegion`), `src/ui/data-status.ts`.
- `src/config/layers.ts`, `src/config/icons.ts`, `src/map/icons/{dom,sdf}/`.
- Tests that name the layer id; `src/filter/testing.ts`.
- Docs: `CLAUDE.md` (data source, column table gains Region, Kind, Icon),
  the design doc's Layers and Core columns sections.

## Done when

- [ ] `data/drinks.csv` validates; `npm run ids` reports next free ID 40.
- [ ] The deployed app shows 39 pins in Tokyo, Kyoto and Hakone empty,
      Kind as the first facet, and the coffee artwork on every pin.
- [ ] A test row with `Region: kyoto` shows up only under Kyoto; one with
      a bad region fails the build.
- [ ] Tea and bar icons render on both renderers.
