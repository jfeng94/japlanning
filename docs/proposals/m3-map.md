# M3: Map

Status: **proposed** (2026-11-04). Waiting for go-ahead.

## Goal

A map under the list, driven by the same filter state: pins for the
current results coloured by layer, ★ pins distinct, tap a pin to select
its row and tap a row to centre its pin. The basemap is our own Protomaps
extract served from the site, so M7's offline work only has to change
where the bytes come from, not what they are.

## Done when

- [ ] On the phone, the map fills the screen under the header with the
      list as a panel at the bottom that can be peeked or expanded.
- [ ] Pins reflect the filter state exactly: same count as the list,
      coloured by layer, ★ pins visibly different, names labelled when
      zoomed in.
- [ ] Tap a pin: its row highlights and scrolls into view. Tap a row: the
      map centres on its pin and it highlights.
- [ ] Switching region moves the map to that region's bounds.
- [ ] The basemap shows roads, rail, stations, water and parks, with no
      shop or restaurant POIs and no buildings. Station names render in
      English with Japanese fallback.
- [ ] Dark mode switches the basemap flavour.
- [ ] `npm run basemap` builds `public/basemap/tokyo.pmtiles` locally;
      CI builds it on every deploy; the deployed file answers HTTP range
      requests.
- [ ] `npm test` covers the style filter and the pin GeoJSON builder.

## Size experiment (done 2026-11-04, as the brief asked)

Extracted from Protomaps planet build `20261103` (139 GB, tile schema
4.15.2) with `pmtiles extract --bbox=139.60,35.58,139.85,35.75`:

| maxzoom | tiles | file | time | transfer |
| --- | --- | --- | --- | --- |
| 15 | 688 | **52 MB** | 7 s | 54 MB |
| 14 | 208 | 16 MB | 5 s | 17 MB |

The extract only fetches the tiles it needs, so it's cheap enough to run
on every deploy. 52 MB is comfortably under GitHub Pages' 100 MB per-file
limit. Max zoom 15 is proposed: MapLibre overzooms the z15 tiles to z17
and street-level detail holds up; max zoom 16 would be roughly four times
the size and over the limit. Current pins span 139.646–139.818 E,
35.609–35.715 N, inside the bbox with margin.

Also verified: GitHub Pages answers HTTP range requests (206), which is
what the pmtiles protocol uses online; Protomaps' hosted fonts and
sprites respond; the font range containing ★ exists.

## Design

### Basemap pipeline (`scripts/build-basemap.ts`)

Reads every region with a `bbox` from `src/config/regions.ts`, runs
`pmtiles extract` against a **pinned** planet build, writes
`public/basemap/<region>.pmtiles`. The build date and max zoom live in
`src/config/basemap.ts`; bumping the date is a deliberate commit.

The pmtiles CLI is a Go binary from `protomaps/go-pmtiles` releases. The
script downloads the right one for the platform into `.cache/pmtiles/`
on first run and verifies it against the release's checksum file, so
Jerry's machine and CI use the same tool with no manual install.
`public/basemap/` and `.cache/` are gitignored.

CI runs `npm run basemap` before the build, like the data snapshot.

### Serving (`pmtiles://`)

MapLibre doesn't know PMTiles natively. The `pmtiles` package registers a
`pmtiles://` protocol with MapLibre that turns tile requests into HTTP
range requests against the one archive. Online, that's what M3 uses,
with the archive served by Pages. In M7 the same protocol reads from a
Blob stored in IndexedDB; the style doesn't change.

### Style (`src/map/style.ts`)

`@protomaps/basemaps` provides the layer definitions for its light and
dark flavours (71 layers). We take them and apply the atlas rules:

- Drop `buildings` and `address_label`.
- Replace the `pois` filter so only `station`, `ferry_terminal` and
  `aerodrome` kinds remain (stations are POIs with `kind: "station"` in
  this schema; everything else in that layer is shops, cafés, museums).
- Keep roads, rail, water, landuse (parks), place labels (neighbourhood,
  locality) and street labels.

Labels use `lang: "en"` with the local name as fallback, so stations read
"Shibuya" rather than only "渋谷". Japanese text that has no English
renders through MapLibre's `localIdeographFontFamily`, i.e. the device's
own CJK font, so no CJK glyph files are shipped. Glyphs and sprites come
from Protomaps' hosted assets in M3; M7 self-hosts them.

Dark mode: `namedFlavor("dark")` when `prefers-color-scheme: dark`, with a
listener so switching at runtime restyles the map. Pure function, unit
tested: no layer reads from `buildings`, the pois filter admits only the
listed kinds, flavour switch changes the background colour.

### Pins (`src/map/pins.ts`, `src/map/map.ts`)

A GeoJSON source rebuilt from `applyFilters` on every state change. Each
feature carries `id`, `name`, `color` (its layer's), `starred`, and
`selected`. Three layers on top of the basemap:

- `pins`: circle, radius 7, `circle-color` from the feature, white stroke.
- `pins_star`: symbol with text `★` in the pin colour, only where
  `starred`; the glyph is in Protomaps' Noto Sans range 9728–9983.
- `pins_label`: symbol with the name beside the pin from zoom 14, hidden
  when it would collide (MapLibre default).

The selected pin gets a larger radius and an accent stroke via a
data-driven expression on `selected`; no separate layer needed.

Pure, tested: `placesToGeoJson(places, layers, selectedId)`.

### Interaction

- Tap a pin: dispatch `select` to the UI store. The list highlights the
  row and scrolls it into view; if the list panel is peeked, it stays
  peeked so the map is still visible.
- Tap a row: dispatch `select`; the map eases to the pin at zoom ≥ 15.
- Tap empty map: deselect.
- Region change: `fitBounds` to the region's bbox. First load: fit to the
  results' bounds. A "fit to results" button in the map corner does the
  same on demand; the map does **not** jump on every filter change,
  because that fights with panning.
- Standard MapLibre controls: zoom buttons hidden on touch (pinch), scale
  bar on, attribution compact. OpenStreetMap attribution is required and
  comes from the archive's metadata.

### Layout

The M2 DOM already has the list and map as siblings. On phones the map
pane becomes the full area under the header, and the list pane becomes a
bottom panel with two states:

- **peek**: results count and the first rows, ~40% of the height.
- **expanded**: the full list, ~85%.

A handle bar toggles between them; a tap on the map while expanded goes
back to peek. No drag gesture in M3 (iOS scroll-vs-drag conflicts are a
rabbit hole); the two-state toggle covers the use. M9 puts the two panes
side by side on wide screens with a media query, as planned.

### Config

`src/config/basemap.ts`: `{ build: "20261103", maxzoom: 15 }`.
`RegionConfig.bbox` already exists for Tokyo. Kyoto and Hakone have none
yet and are skipped by the script; the map shows the online style with no
tiles for them until they get a bbox, which is a one-line change plus a
deploy.

## Files

```
scripts/build-basemap.ts          new: download CLI, extract per region
src/config/basemap.ts             new: pinned build, maxzoom
src/map/style.ts                  new: atlas style from @protomaps/basemaps
src/map/style.test.ts             new
src/map/pins.ts                   new: places -> GeoJSON
src/map/pins.test.ts              new
src/map/map.ts                    new: MapLibre instance, layers, events
src/ui/app.ts                     mount map, selection sync, panel states
src/ui/list-panel.ts              new: peek/expanded panel around the list
src/style.css                     map pane, panel, pin controls
.github/workflows/deploy.yml      npm run basemap
.gitignore                        public/basemap/, .cache/
package.json                      deps + basemap script
index.html                        maplibre css link
```

Dependencies: `maplibre-gl` 6.16, `pmtiles` 4.5, `@protomaps/basemaps`
5.7. MapLibre is the one heavy dependency in the app, around 800 kB
minified and 230 kB gzipped. M7's service worker caches it once.

## Order of work

1. Basemap script, config, CI step. Deploy; confirm the file is served
   with range requests. No visible change yet.
2. Style builder with tests; map mounted with the basemap only; the
   phone layout with the peek/expanded list panel. Deploy.
3. Pins from filter state, ★ glyph, labels, colours by layer. Deploy.
4. Selection sync both ways, region fit, fit-to-results button, deselect
   on map tap. Deploy.
5. Dark flavour switch, attribution, controls, polish.

Steps 2's style builder and 3's GeoJSON builder are the pure pieces if
Jerry wants to write one.

## Out of scope

Offline basemap storage and self-hosted glyphs (M7), the detail card
(M4; a tap only selects), the blue dot (M6), atlas colour tuning (M8), the
wide layout (M9), Kyoto and Hakone extracts (need pins first to choose a
bbox).

## Open questions

- **Max zoom 15** (proposed, 52 MB) vs 14 (16 MB, noticeably coarser at
  street level). 15 unless the M7 download feels slow on the phone.
- **Drop buildings** (proposed) per the "only" in the atlas requirement.
  They help orientation at high zoom; easy to re-enable in M8.
- **Street labels kept** (proposed). Dropping them would be a purer atlas
  but worse for finding a side street.
- **Peek/expanded panel** (proposed) vs a List/Map toggle in the header.
  The toggle is simpler but hides the map while reading the list.
- **Pin labels from zoom 14** (proposed). Could be always-on or never.

## Diff size

About 11 new files, roughly 700 lines. `map.ts` is the largest at
~200 lines; the rest are small.

## Results

(filled in after acceptance)
