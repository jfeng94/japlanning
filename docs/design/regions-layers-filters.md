# Regions, layers and filters

Status: **reviewed** (2026-11-04). Decisions here are inputs to M1 (data
layer) and M2 (list and filters). Open points at the bottom are closed.

The app covers a whole trip, not just Tokyo coffee. Several travellers
install it. One deployment serves everyone at https://japan.garbage.house.

## Regions

Three regions: **Tokyo, Kyoto, Hakone**. Region is the top-level switch in
the UI. Each region has:

- its own basemap extract (bbox and maxzoom chosen per region),
- its own set of layers,
- its own **neighborhood list**, shared by every layer in that region, so
  the Neighborhood filter means the same thing for coffee and restaurants.

Offline basemaps are downloaded per region on demand, each with its own
"offline ready / last synced" indicator.

Region is config, not architecture. If one app ever becomes a problem
(storage quota, size), splitting to tokyo.garbage.house etc. is a deploy
change, not a rewrite. Start unified.

```ts
interface RegionConfig {
  id: "tokyo" | "kyoto" | "hakone";
  label: string;
  neighborhoods: string[];     // ordered; the shared enum for this region
  basemap: { url: string; bbox: [number, number, number, number] };
}
```

## Layers

A **layer** is one location type in one region, backed by one CSV file in
the repo (`data/<id>.csv`; it began as a published Google Sheet, moved
into the repo 2026-11-05, see `docs/proposals/data-in-repo.md`). Planned
layers: Coffee, Tea, Pastry, Restaurants, Lodging, Points of
interest. Each layer is one entry in a config file in the repo:

```ts
interface LayerConfig {
  id: string;                  // "tokyo-coffee"
  region: RegionId;
  label: string;               // "Coffee"
  dataUrl: string;             // "/data/<id>.csv", served from the site
  color: string;               // pin colour, one per layer type
  icon: string;                // pin glyph
  hasHours: boolean;           // participates in "open now"
  facets: FacetConfig[];
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
ID   Name   Branch   Key   Latitude   Longitude   Neighborhood
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
which shop ("Onibus Coffee" / "Yakumo"), since neighborhoods are too coarse
to tell them apart (all four Onibus rows are Nakameguro). Rows and the card
show it muted after the name, search covers it, and name order sorts by
name then branch. Pin labels show the name only.

**Key** (2026-11-05): marks the key branch of a brand, shown as a ★ flag on
rows, pins and the card and behind the "★ Key branches only" filter. Any of
★, TRUE (a Sheets checkbox), yes or 1 means yes; blank, FALSE or no means
no; anything else warns and counts as no. The older convention of a ★
prefix on Name still works and is stripped for display, so a sheet can
move to the column at its own pace.

### Facet columns

The enum fields listed in the layer's config. They drive the generated
filter UI.

### Unknown columns

Not an error. They render as plain text in the detail card, so a column can
be added to a sheet before deciding whether it is a facet.

### Multi-value cells

Any facet cell may hold several values separated by `;` (e.g.
`Pour-over; Espresso`). Trim whitespace around each value. A row matches a
facet selection if **any** of its values is selected. In counts, a row is
counted once under each value it holds.

### Lodging

Holds no private information: name, coordinates, address, link, notes, and a
`Who` column (first names) so the group can see whose hotel a pin is. No
confirmation numbers, dates or prices. `hasHours: false`.

## Filter model

Filter state is one module shared by list and map. Three levels, each
narrowing the next:

1. **Region**: exactly one. Swaps the basemap, the neighborhood list and the
   available layers.
2. **Layers**: chips, any number. **None selected means every layer in
   the region**, the same convention as the Neighborhood filter (decided
   2026-11-04). Pins are coloured by layer.
3. **Filters**:
   - **Shared filters** apply across all selected layers: text substring
     (name, neighborhood, notes), Neighborhood, ★ only, Bookmarked only
     (this device's bookmarks, kept outside the filter state and passed
     in; added 2026-11-04), Open now (only affects layers with
     `hasHours`), and later distance sort.
   - **Layer facets** appear only when exactly one layer is in play (one
     selected, or none selected in a region that has only one), because
     "Roasting" means nothing to a restaurant. With two or more in play,
     only shared filters are shown; facet selections are kept but inactive,
     so narrowing back to one layer restores them.

### Semantics

- Within a facet, selected values are OR'd. Across facets, AND.
- Every facet value shows a live count of rows that would match if it were
  selected, given the other active filters.
- **Blank = unknown.** Every facet has an "include unknown" toggle, default
  **on**, so a blank cell never silently hides a row. A row with a blank
  facet cell is counted under "unknown", not under any value.
- The whole state serialises to the URL query string, so a filtered view
  survives reload and can be shared with the group.

```ts
interface FilterState {
  region: RegionId;
  layers: Set<LayerId>;
  text: string;
  neighborhoods: Set<string>;
  starredOnly: boolean;
  bookmarkedOnly: boolean;
  openNow: boolean;
  facets: Record<LayerId, Record<string /* column */, {
    values: Set<string>;
    includeUnknown: boolean;
  }>>;
}
```

## Open now (M5, 2026-11-04)

A shared filter evaluated in Asia/Tokyo wall-clock time from the
`Hours (OSM)` column, at "now" or at a picked moment (`openAt`,
`YYYY-MM-DDTHH:MM`). Rules, per place:

- Layer has `hasHours: false` (lodging and the like): untouched; rows
  show a "no hours" mark while the filter is on.
- Open: passes. Closed: hidden.
- Unknown (blank or unparsable hours): passes iff `includeUnknownHours`
  (default on, like the facets' include-unknown). Those rows sink to the
  end of the list, in their usual order (2026-11-05).
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
only in the filter chip and strip tag, which are labels).

## Sort (M6, 2026-11-04)

List order is a device preference, not filter state: `sort: "name" |
"distance"` in the Settings store, shown as a Name / Distance pair at the
top of the filter sheet and as "List order" in Settings. It is not in the
share URL (a link shouldn't reorder a friend's list), though `?sort=` works
as an override like the other settings.

- Distance order needs a fix. Without one the list is by name and the
  Distance chip is disabled ("Distance · locate first"); the preference is
  kept and takes effect on the next fix.
- Location is a Settings toggle (`location`, default on, revised
  2026-11-05): on shows the map's locate button and, when the browser
  already reports the permission granted, starts watching at launch; the
  app never prompts by itself, the first tap does. The button only
  centres and locks (a tap, or a pan, unlocks; the dot stays). Off hides
  the button, stops the watch and drops the fix.
- "Sort by distance when located" (`autoDistanceSort`, off by default)
  switches `sort` to distance on the first fix after launch. Off while
  planning from home, on during the trip.
- The strip shows a "by distance" tag alongside the filter tags so it is
  visible why the order changed.
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
- **"Open now" leaves `hasHours: false` layers untouched.** With several
  layers selected, rows from layers without hours stay visible and show a
  small "no hours" marker.
- **Layer and facet config lives in the repo**, typed and tested, not in a
  registry sheet. Schemas are not changed mid-trip; adding a layer is a config
  edit and a deploy.
