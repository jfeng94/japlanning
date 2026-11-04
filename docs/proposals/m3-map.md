# M3: Map

Status: **implemented, awaiting phone acceptance** (approved and built
2026-11-04, commits 2618de7..). Every box below was checked in a desktop
browser at phone width except the ones that need a phone; see Results.

## Goal

A map under the list, driven by the same filter state: pins for the
current results coloured by layer, ★ pins distinct, tap a pin to select
its row and tap a row to centre its pin. The basemap is our own Protomaps
extract served from the site, so M7's offline work only has to change
where the bytes come from, not what they are.

## Done when

- [x] On the phone the header is one row and the map fills the rest,
      with the list in a bottom panel that rests as a thin strip and
      opens to half or full height. The map keeps roughly 85% of the
      screen at rest.
- [x] Selecting a place (pin or row) shows it in the same panel with a
      back arrow; back, the iOS back swipe, or a tap on empty map returns
      to the list with its scroll position kept. The URL carries the
      selection.
- [x] Pins reflect the filter state exactly: same count as the list,
      coloured by layer, ★ pins visibly different, names labelled when
      zoomed in.
- [x] Tap a pin or a row: the map centres on the pin, it restyles as
      selected, and the panel shows the place.
- [x] Switching region moves the map to that region's bounds.
- [x] The basemap shows roads, rail, stations, water and parks, with no
      shop or restaurant POIs and no buildings. Station names render in
      English with Japanese fallback.
- [x] Dark mode switches the basemap flavour.
- [x] `npm run basemap` builds `public/basemap/tokyo.pmtiles` locally;
      CI builds it on every deploy; the deployed file answers HTTP range
      requests.
- [x] `npm test` covers the style filter and the pin GeoJSON builder.

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

### Icons: assignment (sheet) and rendering (two renderers)

Jerry wants pins that are easy to restyle with custom icons, and wants to
try two rendering approaches. These are two separate concerns.

**Assignment.** A new core column, `Icon`, on every sheet. Its values are
a **global enum** shared by all layers, defined once in
`src/config/icons.ts`. Blank means "use the layer's default icon"
(`LayerConfig.icon`); an unlisted value warns in the parser and falls
back the same way. The parser gains `Place.icon?: string`; the column is
optional like every other core column, so nothing breaks until Jerry adds
it.

```ts
// src/config/icons.ts
export const ICONS = {
  coffee: { sdf: "coffee.webp", dom: "coffee.svg" },
  // tea, pastry, restaurant, lodging, sight ... as they're drawn
} as const;
export type IconId = keyof typeof ICONS;
```

Assets live in `src/map/icons/sdf/` (monochrome shapes) and
`src/map/icons/dom/` (full-colour artwork). The two sets will differ in
practice: a tintable silhouette and a detailed illustration are different
drawings. The first pair is in the repo: a 256×256 lossless WebP
silhouette for SDF and a traced 77 kB SVG for DOM.

**Rendering.** One interface, two implementations, chosen by config with
a URL override so both can be tried on the phone without a redeploy:

```ts
// src/config/map.ts
export const PIN_RENDERER: "sdf" | "dom" = "sdf";   // ?pins=dom overrides

// src/map/pins.ts
interface PinRenderer {
  update(pins: Pin[]): void;        // the filtered places, with icon, color, starred
  setSelected(id?: string): void;
  onSelect(cb: (id?: string) => void): void;
  destroy(): void;
}
```

`Pin` is built by a pure, tested `placesToPins(places, layers)` that
resolves each place's icon (row value, else layer default) and colour.
Both renderers consume the same array; `map.ts` only knows the interface.

*SDF renderer* (`src/map/pins-sdf.ts`): a MapLibre symbol layer.
MapLibre can draw an icon as a **signed distance field**: instead of
colours, the image stores how far each pixel is from the shape's edge,
and the GPU draws a crisp edge at any size and tints it with
`icon-color` per feature. That's what makes one monochrome shape serve
every layer in its own colour, with the selected pin bigger via
`icon-size`. The catch is that a plain bitmap is not an SDF; MapLibre
expects the field already computed. So `src/map/sdf.ts` rasterises the
silhouette to a canvas and runs a distance transform (the standard
Felzenszwalb algorithm, about 60 lines, unit tested on a square) before
`map.addImage(name, data, { sdf: true })`. Labels and collision work
because it's a symbol layer; ★ is a text overlay as before.

*DOM renderer* (`src/map/pins-dom.ts`): one `maplibregl.Marker` per
pin, each an HTML element positioned by the map. Styling is plain CSS
with the layer colour as a custom property, so hover, selected and
starred states are CSS classes, and the artwork can be anything,
multicolour included. The 77 kB traced SVG with 188 paths must not be
inlined 40 times; it's referenced as an `<img>` so the browser decodes it
once. The costs: no label collision (labels, if any, are CSS and may
overlap), and each pin is a DOM node, so hundreds are fine and thousands
are not.

*Shared*: selection and taps go through the UI store either way;
`setSelected` just restyles. Switching renderer at runtime isn't needed;
the choice is read once at startup.

### Interaction

Selection and "detail open" are the same state: a selected id means the
bottom panel shows that place instead of the list.

- Tap a pin (either renderer) or a row: dispatch `select`. The map eases
  to the pin at zoom ≥ 15, the pin restyles as selected, and the panel
  switches to the detail view at half height (or stays at its current
  height if already half or full).
- Back arrow in the panel, the iOS back swipe (selection pushes a history
  entry), or a tap on empty map: `deselect`. The panel shows the list
  again at the height it had, scroll position intact.
- The selected id is written to the URL as `s=<place id>` alongside the
  filter state, so a link opens straight to a place with the map centred
  and the panel at half. That's the "meet here" link for the group.
- Region change: `fitBounds` to the region's bbox. First load: fit to the
  results' bounds. A "fit to results" button in the map corner does the
  same on demand; the map does **not** jump on every filter change,
  because that fights with panning.
- Standard MapLibre controls: zoom buttons hidden on touch (pinch), scale
  bar on, attribution compact. OpenStreetMap attribution is required and
  comes from the archive's metadata.

### Layout

The M2 header is three rows (region segments, layer chips, search plus
Filters), about 155 pt on an iPhone, a fifth of the screen. That was fine
for a list-only screen and is too much over a map. M3 rebuilds it and
turns the list into a bottom panel.

**Header, one row (~50 pt):**

```
[ Tokyo ▾ ] [ Coffee ▾ ]            [ 🔍 ] [ Filters ]
```

- Region and layers become compact menu buttons. Region opens a small
  menu of the three regions. Layers opens the Filters sheet scrolled to
  a new Layers section at its top, since that's where the chips with
  counts belong now. The button label shows the selection ("Coffee",
  "2 layers", "No layers").
- Search is an icon; tapping it expands a search field across the row
  with a Cancel, and collapses it back when empty and dismissed. While a
  query is active the icon shows a dot so it's visible that a filter is
  on.
- Filters as before, marked active when anything is set.

**Map:** fills everything under the header.

**Bottom panel** (`src/ui/panel.ts`): a fixed element over the map with
three heights, cycled by tapping its handle, plus programmatic moves:

- **strip** (~56 pt): results count, the status line ("Updating…",
  "Offline · …"), and the handle. With a place selected: that place's
  name and a Directions button instead.
- **half** (~45%): the list, or the selected place's card. The map stays
  visible above.
- **full** (~85%): the same, more of it.

The panel has two contents, `list` and `detail`, switched by whether a
place is selected (see Interaction). The container, its heights and the
switching are built in M3; the detail **card** is M4's content and slots
into it. No drag gesture in M3 (iOS scroll-vs-drag is a rabbit hole); the
handle tap covers the use.

**Detail view (container in M3, card in M4):** one card, three heights.
At half: name with ★, layer and neighborhood, the row chips, hours text
(open status from M5), address with the approximate marker, and two big
actions, Directions and Copy. At full: notes, link, every facet as label
and values, last verified with the unverified badge, and any extra
sheet columns as plain label–value pairs, which is what keeps the card
generic across layers whose schemas don't exist yet. A Share button
(Web Share API with the `s=` link) sits beside Copy. Copy shows a brief
"Copied" confirmation since clipboard writes are silent.

**Wide screens (M9):** the panel becomes a side column with the same
list-or-detail switch inside it, and the header stays one row. Nothing
here needs redoing for that.

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
src/config/icons.ts               new: global icon enum -> asset files
src/config/map.ts                 new: pin renderer choice
src/map/icons/sdf/*, dom/*        icon assets (coffee pair already added)
src/map/pins.ts                   new: PinRenderer interface, placesToPins
src/map/pins.test.ts              new
src/map/pins-sdf.ts               new: symbol-layer renderer
src/map/pins-dom.ts               new: Marker renderer
src/map/sdf.ts                    new: distance transform for SDF images
src/map/sdf.test.ts               new
src/map/map.ts                    new: MapLibre instance, basemap, events
src/data/parse.ts, parse.test.ts  Icon column -> Place.icon, warning on unlisted
src/ui/app.ts                     mount map, selection sync, panel + URL s=
src/ui/header.ts                  new: one-row header, menus, inline search
src/ui/panel.ts                   new: strip/half/full container, list or detail
src/ui/detail.ts                  new in M3 as a placeholder (name + Directions); M4 fills it
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
1b. One-row header and the bottom panel (strip/half/full) around the
   existing list, with the map pane still empty. Deploy; judge the
   layout on the phone before any map is in it.
2. Style builder with tests; map mounted with the basemap in the pane.
   Deploy.
3. Icon column in the parser; `placesToPins`; the SDF renderer with the
   coffee silhouette, ★ glyph, labels, colours by layer. Deploy.
3b. The DOM renderer with the coffee artwork, `?pins=dom`. Deploy; try
   both on the phone.
4. Selection sync both ways, panel switching to the placeholder detail
   with back and history entry, `s=` in the URL, region fit,
   fit-to-results button, deselect on map tap. Deploy.
5. Dark flavour switch, attribution, controls, polish.

Steps 2's style builder and 3's GeoJSON builder are the pure pieces if
Jerry wants to write one.

## Out of scope

Offline basemap storage and self-hosted glyphs (M7), the detail card's
content (M4; M3 ships the container with a name-and-Directions
placeholder), the blue dot (M6), atlas colour tuning (M8), the
wide layout (M9), Kyoto and Hakone extracts (need pins first to choose a
bbox).

## Open questions

- **Max zoom 15** (proposed, 52 MB) vs 14 (16 MB, noticeably coarser at
  street level). 15 unless the M7 download feels slow on the phone.
- **Drop buildings** (proposed) per the "only" in the atlas requirement.
  They help orientation at high zoom; easy to re-enable in M8.
- **Street labels kept** (proposed). Dropping them would be a purer atlas
  but worse for finding a side street.
- **Pin labels from zoom 14** (proposed). Could be always-on or never.
- **Default renderer: SDF** (proposed) with `?pins=dom` to compare.
  Decide after trying both on the phone; the loser stays in the repo
  behind the config switch unless it's clearly dead weight.
- **Icon enum values**: `coffee` for now. Jerry names the rest as the
  other sheets take shape; each needs a silhouette and, optionally, a
  full-colour drawing.

## Diff size

About 19 new files, roughly 1,150 lines. `map.ts`, the two renderers,
the header and the panel are 100–200 lines each; the rest are small.

## Results

Built 2026-11-04 in eight commits (steps 1, 1b, 2, 3, 3b, 4 and polish).
99 tests. Production bundle: 1.17 MB app chunk (320 kB gzipped, almost
all MapLibre) plus a 519 kB worker chunk.

Verified in the browser pane at 375×812 against the production build:

- Header is 52 px; the map pane gets 760 px. Region menu (Diagnostics at
  its foot), layers button opening the sheet at its Layers section, inline
  search with cancel, panel heights strip/half/full.
- Basemap renders from our 51.7 MB extract over range requests (206s in
  dev, preview and on Pages). Water, roads, rail, bilingual place and
  street labels; POIs reduced to stations, ferry terminals and airports
  ("Tokyo International Airport", "Keikyu-Kamata", …). No buildings.
- SDF pins: one tinted silhouette per icon, ★ overlay on key branches,
  name labels from zoom 14. DOM pins via `?pins=dom`: white disc, layer
  ring, artwork, ★ badge, label.
- Row tap: map eases to the pin at zoom 15, panel shows the detail
  placeholder, URL gains `s=`, one history entry. Back arrow returns to
  the list with the URL cleaned. Switching place while open replaces the
  entry rather than stacking. A `?s=` link opens straight to the place and
  its back leaves the page, as it should.
- Fit button frames all results; region change fits the region bbox.
- Dark scheme: background and sprite switch; pins source and SDF image are
  re-added after the style reload.

For the phone pass:

- The one-row header and the panel heights with real thumbs.
- Pin tap targets with both renderers; which renderer looks right.
- iOS back swipe closing the detail.
- The SDF silhouette at its rendered size (32 CSS px); the cup reads as a
  blob at low zoom in screenshots and may want a bolder drawing or a
  larger icon-size.

Decisions made while building, beyond the proposal:

- MapLibre 6 is ESM-only with no default export and locates its worker
  relative to its own module URL; Vite bundles the worker via
  `?worker&url` and the app hands the URL to `setWorkerUrl`. MapLibre is
  also excluded from Vite's dev pre-bundling.
- MapLibre's stylesheet sets `position: relative` on the map container,
  which beat the pane's absolute positioning; the pane rule is now a
  two-class selector. Symptom was a 0-height pane and a 300 px canvas.
- The pmtiles CLI release publishes no checksum file, so the two archives
  we use are pinned by SHA-256 in `src/config/basemap.ts`; other platforms
  are refused until a hash is added. Windows' own `tar.exe` extracts the
  zip; Git Bash's GNU tar cannot.
- Stations are POIs with `kind: "station"` in Protomaps' schema, so the
  atlas filter keeps the layer and narrows its filter rather than dropping
  it.
- A silhouette is not an SDF: `src/map/sdf.ts` computes the field
  (Felzenszwalb EDT) from alpha × darkness so both transparent and white
  backgrounds work.
- `querySourceFeatures` returns a feature once per tile it touches, so
  counts from it are not place counts; the list's count is authoritative.
- Symbol layers take a moment to place after a glyph download; a layer
  reporting zero rendered features right after a style change is normal.
- The SDF renderer re-reads its label colours on every style load so a
  runtime theme switch restyles labels, not just the basemap.
