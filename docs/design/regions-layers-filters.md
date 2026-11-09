# Regions, layers and filters

Status: **reviewed** (2026-11-04). Decisions here are inputs to M1 (data
layer) and M2 (list and filters). Open points at the bottom are closed.
The filter model was rewritten 2026-11-09 (`docs/proposals/filters-and-areas.md`):
categories, areas and flags, no facet filters, no cascade.

The app covers a whole trip, not just Tokyo coffee. Several travellers
install it. One deployment serves everyone at https://japan.garbage.house.

## Regions

Three regions: **Tokyo, Kyoto, Hakone**. Region is the top-level switch in
the UI. Each region has:

- its own basemap extract (bbox and maxzoom chosen per region),
- its own set of layers,
- its own **areas**, shared by every layer in that region, in three
  layers (2026-11-09, `docs/proposals/filters-and-areas.md`): raw areas
  are facts (the data's Area column, each with the ward its addresses
  name and its neighbours); merges fold raw areas into the filter chips
  and can change without touching the data; ward sections put the chips
  under headings in the filter sheet.

Offline basemaps are downloaded per region on demand from Settings →
Offline, each with its own status (not on this device, downloading,
ready with the build date, update available); see
`docs/proposals/m7-offline.md`.

**Anything stored on the device is either validated on read or kept
under a versioned key** (2026-11-07): settings and the remembered region
are checked against their allowed values when read; bookmarks live under
`bookmarks:v1`; basemap Blobs carry a sidecar (build, maxzoom, bbox) that
is compared with the config on every look; the service worker's cache is
named by a content hash and older caches are deleted on activation.
Never a bare key with an unchecked shape. Kyoto's areas and bbox were
set 2026-11-05 with its first pins; Uji counts as Kyoto.

Region is config, not architecture. If one app ever becomes a problem
(storage quota, size), splitting to tokyo.garbage.house etc. is a deploy
change, not a rewrite. Start unified.

```ts
interface RegionConfig {
  id: "tokyo" | "kyoto" | "hakone";
  label: string;
  areas: AreaConfig[];         // raw areas: { label, ward, adjacent }
  areaGroups?: AreaGroup[];    // merges: { label, areas } -> one chip
  areaSections?: AreaSection[];// headings: { label, wards }; none = one flat list
  bbox?: [number, number, number, number];
}
```

## Layers

A **layer** is one location type, backed by one CSV file in the repo
(`data/<id>.csv`; it began as a published Google Sheet per region, moved
into the repo 2026-11-05, see `docs/proposals/data-in-repo.md`). A layer
may be fixed to one region, or span all of them with a `Region` column
per row (`docs/proposals/drinks-layer.md`, 2026-11-05). Planned layers: Coffee, Tea, Pastry, Restaurants, Lodging, Points of
interest. Each layer is one entry in a config file in the repo:

```ts
interface LayerConfig {
  id: string;                  // "drinks"
  region?: RegionId;           // fixed region; absent = rows carry a Region column
  label: string;               // "Drinks"
  dataUrl: string;             // "/data/<id>.csv", served from the site
  color: string;               // pin colour, one per layer type
  icon: string;                // pin glyph
  hasHours: boolean;           // participates in "open now"
  kinds?: string[];            // the Kind column's values: the layer's category chips
  facets: FacetConfig[];       // shown on rows and the card, matched by search; not filters
  rowFacets?: string[];        // facet columns shown as chips on a row
}

interface FacetConfig {
  column: string;              // exact header text, e.g. "Specialty"
  label?: string;              // display name, defaults to column
  values: string[];            // ordered; values not listed still render, after these
}
```

Adding a layer or a facet is a config edit and a push; Actions deploys it.
The schema for Tea, Pastry, Restaurants and POIs is not researched yet; the
loader and filter UI must not assume anything beyond the core columns.

### Core columns

Shared by every layer, looked up by header name, all optional except Name,
Latitude, Longitude:

```
ID   Name   Branch   Key   Region   Latitude   Longitude   Area   Kind   Icon
Hours   Hours (OSM)   Link   Address (JA)   Notes   Last verified
```

**ID** (2026-11-05): a positive integer, assigned by hand, unique within the
sheet. The place id is `<layer>:<ID>`, so renames and reorders never break
bookmarks or share links. A sheet without the column still works with ids
derived from the name (`<layer>:<slug>`, `-2` on repeats), and so does a row
whose ID is blank, non-integer or a repeat: it falls back to the name id with
a warning on the ID column, which Diagnostics shows. The snapshot step in CI
fails on any such warning, so a bad edit can't ship; `npm run ids` runs the
same check against the live sheets and prints the next free ID.

**Branch**: for multi-branch brands, Name is the brand and Branch says
which shop ("Onibus Coffee" / "Yakumo"), since an area is too coarse to
tell them apart (two Onibus rows are in Nakameguro). Rows and the card
show it muted after the name, search covers it, and name order sorts by
name then branch. Pin labels show the name only.

**Key** (2026-11-05): marks the key branch of a brand, shown as a ★ flag on
rows, pins and the card and behind the Key branches flag. Any of
★, TRUE (a Sheets checkbox), yes or 1 means yes; blank, FALSE or no means
no; anything else warns and counts as no. The older convention of a ★
prefix on Name still works and is stripped for display, so a sheet can
move to the column at its own pace.

**Kind** (2026-11-09): for a layer with `kinds`, which of them the row is
(several allowed: `Coffee; Bar`). Required there: a blank or unknown value
warns, so the build fails, and an unknown value is dropped rather than
becoming a category. The kinds are the layer's category chips in the
filter sheet and show in the card's meta line ("Drinks · Coffee ·
Shibuya · 160 m away"). A layer without `kinds` leaves any Kind column in
the card's "Also in the sheet".

### Facet columns

The enum fields listed in the layer's config. Since 2026-11-09 they are
not filters: they show as chips on the row (`rowFacets`) and in the card's
Details, and search matches their values, so "pour-over" or "kissaten"
finds them in one step.

### Unknown columns

Not an error. They render as plain text in the detail card, so a column can
be added to a sheet before deciding whether it is a facet.

### Multi-value cells

Any enum cell (a facet, Kind) may hold several values separated by `;`
(e.g. `Pour-over; Espresso`). Trim whitespace around each value. A place
of two kinds matches either kind's chip.

### Lodging

Holds no private information: name, coordinates, address, link, notes, and a
`Who` column (first names) so the group can see whose hotel a pin is. No
confirmation numbers, dates or prices. `hasHours: false`.

## Filter model

Rewritten 2026-11-09 (`docs/proposals/filters-and-areas.md`). The filter
state is one module (`src/filter/state.ts`) shared by the list, the map
and the URL.

The **region** is the top-level switch: exactly one; it swaps the
basemap, the areas and the layers, and resets the filters. Within it the
sheet has three groups, top to bottom:

1. **Show only** (flags): Bookmarked (this device's bookmarks, kept
   outside the filter state and passed in), Open now or Open at a day and
   time, Key branches. Each one on narrows the results.
2. **Area** (where): Here, the area chips under ward headings, and an
   Include nearby areas switch.
3. **Category** (what): each layer is a header chip followed by its kinds
   (Drinks: Coffee · Tea · Bar). A layer without kinds is one chip.

Anything more specific (pour-over, kissaten, a branch, a street) is the
search box's job. Pins are coloured by layer.

### Semantics

- Selected chips within a group are a **union**; the groups AND together.
  None selected in a group means everything: no category is every layer
  and kind, no area is everywhere.
- A header (a layer, a ward heading) selects every chip under it, or
  clears them when they are all on. It is not a selection of its own.
- **Filters do not cascade.** Nothing in the sheet appears, disappears,
  greys out or recounts because of another selection. The feedback is the
  result count in the strip; an empty result says "Nothing matches these
  filters" with Clear filters. Here depends on the position, not on other
  chips, so it is the one chip whose label changes by itself.
- **Include nearby** adds the chips next to everything chosen (the
  selection and Here's chip): one hop on the area graph, with each merge
  contracted to a single node. Chips pulled in by Here or Include nearby
  get a dotted outline without becoming selected, so the count is
  explainable.
- **Here** is the chip of the raw area whose centre (the centroid of its
  places) is nearest to the position, within 2 km and inside the region's
  bbox. Unresolved (no fix yet, or away from every area) it narrows
  nothing. It follows the position, re-evaluated with the 3 s position
  throttle.
- **Search** matches the name, branch, raw area, area chip, kinds, notes,
  every facet value and the Japanese address, ignoring case and width.
- The whole state serialises to the URL query string (`c`, `a`, `here`,
  `nb`, `q`, `star`, `b`, `open`, `at`; `src/filter/url.ts`), so a
  filtered view survives reload and can be shared. Here travels as "here",
  not as where the sender stood.

```ts
interface FilterState {
  region: RegionId;
  categories: Set<string>;   // "drinks/Coffee", or a layer id for a layer without kinds
  areas: Set<string>;        // area chips
  here: boolean;
  nearby: boolean;
  text: string;
  starredOnly: boolean;
  bookmarkedOnly: boolean;
  openNow: boolean;
  openAt?: string;           // "YYYY-MM-DDTHH:MM", Tokyo wall clock
}
```

```
shown = places in the region
  ∩ (no categories ? all : ∪ selected categories)
  ∩ (no areas and no Here ? all : area ∈ chosen ∪ (nearby ? their neighbours : ∅))
  ∩ every flag that is on
  ∩ text match
```

## Open now (M5, 2026-11-04)

A shared filter evaluated in Asia/Tokyo wall-clock time from the
`Hours (OSM)` column, at "now" or at a picked moment (`openAt`,
`YYYY-MM-DDTHH:MM`). Rules, per place:

- Layer has `hasHours: false` (lodging and the like): untouched; rows
  show a "no hours" mark while the filter is on.
- Open: passes. Closed: hidden.
- Unknown (blank or unparsable hours): passes, and sinks to the end of
  the list in its usual order with the "?" mark (2026-11-05). The
  "Include unknown hours" toggle went with the facet toggles (2026-11-09).
- Before the parser has loaded, everything passes so the list never
  blanks.

The evaluation lives outside the filter state (like bookmarks) and is
passed in. It runs whether or not the filter is on, refreshes once a
minute and when the app returns to the foreground. The card's
Open/Closed line reads the same moment, so the filter and the card never
disagree.

### Marks (2026-11-05)

Each row and pin shows at most one marker, decided in one place
(`src/data/marks.ts`) so list and map agree. Precedence: "?" (hours
unknown) > "zz" (closed at the chosen moment) > the bookmark seal > ★
(key branch). "zz" shows whenever hours have been evaluated, filter on or
off, so a shut shop can be skipped without opening its card; with the
filter on, closed places are hidden anyway. "?" shows only while the
user is asking about opening times (the filter on, or an "open at" time
set): it answers "is this open?" with "we don't know", and is noise
otherwise. On rows the marker sits before the name; on pins
it is the upper-right badge. All four are artwork (the ★ glyph stays
only where it is a label).

## Sort (M6, 2026-11-04; the footer toggle 2026-11-09)

List order is a device preference, not filter state: `sort: "name" |
"distance"` in the Settings store, switched by the toggle at the bottom
left of the strip's footer in list mode, labelled with the current order:
**A–Z** or **Nearest**. It is not in the share URL (a link shouldn't
reorder a friend's list), though `?sort=` works as an override like the
other settings.

- Nearest needs a fix. Choosing it with none starts locating, and the
  toggle reads "Nearest…" (the list stays A–Z) until the fix lands. With
  Location off a tap says so instead of switching. The preference is kept
  and takes effect on the next fix.
- Prev and Next on the card follow the list's order.
- Location is a Settings toggle (`location`, default on, revised
  2026-11-05): on shows the map's locate button and, when the browser
  already reports the permission granted, starts watching at launch; the
  app never prompts by itself, the first tap does. The button only
  centres and locks (a tap, or a pan, unlocks; the dot stays). Off hides
  the button, stops the watch and drops the fix.
- "Sort by distance when located" (`autoDistanceSort`, off by default)
  switches `sort` to distance on the first fix after launch. Off while
  planning from home, on during the trip.
- Rows and the card show the distance from the last fix whenever one
  exists, whatever the order. Re-renders from new fixes are throttled to
  one every 3 s so the list doesn't re-sort under a thumb.

## Devices and layout

- **Primary target: iPhone, installed to the Home Screen from Chrome.** Every
  iOS browser is WebKit; Chrome can install Home Screen web apps since iOS
  16.4, and the installed app runs in Apple's standalone container with full
  capabilities regardless of installing browser. The installed app is the
  acceptance target; offline in a plain Chrome tab is nice-to-have.
- **Storage is partitioned** between the installed app and browser tabs. The
  pre-trip "open once on Wi-Fi" step happens inside the installed app.
- **Android**: best effort via a correct manifest with maskable icons.
- **iPad and desktop**: list and map are siblings in the DOM from M2 onward.
  On narrow screens the list lives in a bottom sheet over the map; at a
  breakpoint around 768px they sit side by side. This is M9, but the DOM
  structure is decided now so M9 is CSS, not a rewrite.

## Decisions (2026-11-04)

- **Facet value order comes from config**, not from first appearance in the
  sheet, so the UI is stable as rows are added. Values present in the sheet
  but missing from config still render, after the configured ones.
- **Facets are not filters** (2026-11-09, superseding the per-facet
  sections, live counts, include-unknown toggles and `scopeBy` of
  2026-11-04 and 2026-11-05): a sheet that grows with every layer and
  recounts as you tap was hard to predict. Kind became the categories;
  the rest is search.
- **"Open now" leaves `hasHours: false` layers untouched.** With several
  layers in play, rows from layers without hours stay visible and show a
  small "no hours" marker.
- **Layer and facet config lives in the repo**, typed and tested, not in a
  registry sheet. Schemas are not changed mid-trip; adding a layer is a config
  edit and a deploy.
