# Regions, layers and filters

Status: **reviewed** (2026-11-04). Decisions here are inputs to M1 (data
layer) and M2 (list and filters). Open points at the bottom are closed.
The filter model was rewritten 2026-11-09 (`docs/proposals/filters-and-areas.md`):
categories, areas and flags, no facet filters, no cascade.

The app covers a whole trip, not just Tokyo coffee. Several travellers
install it. One deployment serves everyone at https://japan.garbage.house.

## Regions

Five regions: **Tokyo, Kyoto, Osaka, Nara, Hakone**, in that order in the
menu (Osaka and Nara joined 2026-11-09 with Jerry's trip list, as day
trips; Uji counts as Kyoto and Sakai as Osaka; Hakone got its map and
areas with its first pins). Region is the top-level switch in the UI. Each
region has:

- its own basemap extract (bbox and maxzoom chosen per region),
- its own set of layers,
- its own **areas**, shared by every layer in that region, in three
  layers (2026-11-09, `docs/proposals/filters-and-areas.md`): raw areas
  are facts (the data's Area column, each with the ward its addresses
  name and its neighbours); merges fold raw areas into the filter chips
  and can change without touching the data; ward sections put the chips
  under headings on the Area page. Each section has a hue, and each of
  its chips a shade of it, shared by the chip and its shape on the map
  (`src/config/area-colors.ts`); a region without sections gives each
  chip a rainbow hue of its own.

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
  id: "tokyo" | "kyoto" | "osaka" | "nara" | "hakone";
  label: string;
  areas: AreaConfig[];         // raw areas: { label, ward, adjacent }
  areaGroups?: AreaGroup[];    // merges: { label, areas } -> one chip
  areaSections?: AreaSection[];// headings: { label, wards, hue? }; none = one flat list
  bbox?: [number, number, number, number];
}
```

## Layers

A **layer** is one location type, backed by one CSV file in the repo
(`data/<id>.csv`; it began as a published Google Sheet per region, moved
into the repo 2026-11-05, see `docs/proposals/data-in-repo.md`). A layer
may be fixed to one region, or span all of them with a `Region` column
per row (`docs/proposals/drinks-layer.md`, 2026-11-05). Every layer so
far spans all regions. Each layer is one entry in a config file in the
repo (`src/config/layers.ts`):

| Layer | Kinds (the category chips) | Facets | Default pin |
| --- | --- | --- | --- |
| Drinks | Coffee · Tea · Bar | Format, Roasting, Food, Linger, Specialty, Reservation | coffee |
| Sweets | Pastry · Wagashi · Ice | Type, Reservation | pastry |
| Food | Ramen · Yakitori · Yakiniku · Katsu · Kushikatsu · Tempura · Gyoza · Okonomiyaki · Hot pot · Unagi · Tofu · Rice · Onigiri · Donburi · Sushi · Pickles · Fruit, from Type | Type, Reservation | fork |
| Music | Café · Shop · Concert | Type, Reservation | musicbox |
| Shops | Kitchen · Baking · Games | Type | question |
| Activities | none: one chip | Type, Reservation | bingbong |

Sweets, Food, Music, Shops and Activities joined 2026-11-09 from Jerry's
trip list, as a first cut he may reshape: the list's categories became
layers (Coffee and Cocktails went into Drinks as Coffee and Bar; Kitchen
shopping, Baking shopping and Board games became Shops), and its "What"
column became **Type**, what the place is ("Kakigori", "Ramen; Tsukemen",
"Knives"), multi-valued and from a fixed list per layer like any facet.
Lodging is still to come, with `onAreaMap` (below).

**Food's kinds** (2026-11-10, `docs/proposals/food-kinds.md`) come from
its Type rather than a Kind column: the config groups the Type values
under each kind (Ramen is Ramen, Tsukemen or Tantanmen), and that
grouping is also the Type column's list of values, so a new type goes
into a group or fails the build. A place of two types in different
kinds has both (Koharuken: Katsu and Donburi). Anything finer than a
kind (tsukemen only) is the search box's job.

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
  kindsFrom?: { column: string; groups: Record<string, string[]> };
                               // derive kinds from a facet column instead (Food, from Type)
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
The loader and filter UI assume nothing beyond the core columns.

**Pins** (2026-11-09): each row's Icon picks its artwork from the global
enum (`src/config/icons.ts`). Places with no fitting artwork yet use
`question` (a ? on a brown disc), so `,question,` in the data finds every
pin still waiting for art.

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
(several allowed: `Coffee; Bar`). A layer with `kindsFrom` (Food) has no
Kind column: its rows' kinds follow from the facet named there, and a
row whose values make no kind warns. Required there: a blank or unknown value
warns, so the build fails, and an unknown value is dropped rather than
becoming a category. The kinds are the layer's category chips in the
Filters page and show in the small line under the card's name in the
header ("Coffee · Shibuya · 160 m away"; the kind implies the layer, so
the layer is named only for a place without kinds, 2026-11-11). A layer
without `kinds` leaves any Kind column in the card's "Also in the
sheet".

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
confirmation numbers, dates or prices. `hasHours: false`. `onAreaMap:
true`, so its pins stay on the Area page's map beside the bookmarks,
whatever the filters say.

## Filter model

Rewritten 2026-11-09 (`docs/proposals/filters-and-areas.md`, then
`filter-pages-and-area-map.md`). The filter state is one module
(`src/filter/state.ts`) shared by the list, the map and the URL.

The **region** is the top-level switch: exactly one; it swaps the
basemap, the areas and the layers, and resets the filters. Within it,
two pages open in the strip at Half from their footer buttons. A page's
header has the live count and an X that closes it; Clear (that page's
selections) sits at the top of the page, greyed when there's nothing to
clear:

- **Filters**:
  0. **Hide all** (2026-11-11), a toggle at the top left, beside Clear:
     no places on the map or in the list, so the subway lines can be
     read. It is the categories' "none" (nothing picked is all):
     turning it on clears the categories, and picking a category, or a
     layer heading, turns it off, so Hide all then Coffee shows just
     coffee. Flags and areas leave it alone. Clear turns it off. The
     list says "All places are hidden" with Show all, and the list's
     tags read "All hidden".
  1. **Show only** (flags): Bookmarked (this device's bookmarks, kept
     outside the filter state and passed in), Open now or Open at a day
     and time, Nearby, Key branches. Each one on narrows the results.
  2. **Category** (what): laid out like the Area page (2026-11-10):
     each layer is a heading with its icon, which picks or clears all
     of its kinds, and its kinds are chips under it (Drinks: Coffee ·
     Tea · Bar). A layer without kinds has one chip, its own name.
     Only chips with a place in the city show, and a layer with none
     is left out (2026-11-10: Tokyo has no tofu places, Hakone no
     drinks); a selected chip stays, so a shared link's selection can
     be turned off. This follows the region, not another selection, so
     it is no cascade.
- **Area** (where): Here and + Adjacent, then the area chips under ward
  headings. The page holds the strip at Half, since it is about the map.
  Its button shows only in a region with areas. **The map follows the
  page** (2026-11-09):
  - it fits every area shape above the strip; pan and zoom stay on
    (2026-11-10: the whole city is hard to read on a phone), and the fit
    button frames the city again; the locate button hides, the blue dot
    stays;
  - the basemap hides its labels and roads, keeping land, water, parks
    and the rail lines (which the basemap only carries from zoom 11, so
    they appear on a phone once you zoom in);
  - each area is drawn in its chip's colour and look (filled, hatched or
    outlined) with its name, picked names winning where labels collide,
    and a tap on it does what its chip does;
  - the only pins are bookmarks and `onAreaMap` layers (lodging), with the
    bookmark badge, and they ignore taps;
  - leaving puts the camera back where it was if the areas in play are
    the same as when the page opened; if they changed, it frames the
    areas now in play (picked and added), snugly, or the results when
    none are (2026-11-10: going back to a view with none of the new
    results in it was disorienting).

  On the normal map (2026-11-10) only the areas in play show: picked
  ones lightly filled and outlined, added ones faintly hatched with a
  dashed edge, no names, no other areas. Nothing picked, nothing drawn.

A page closes by its X, its own button, another footer button (the
other page, Search) or a region change. It returns to the card it hid if that place
still matches, else to the list, at the height it had. A page shares the
card's one history entry, so Back goes to the list, as it does from a
card.

Anything more specific (pour-over, kissaten, a branch, a street) is the
search box's job. Pins are coloured by layer.

### Semantics

- Selected chips within a group are a **union**; the groups AND together.
  None selected in a group means everything: no category is every layer
  and kind, no area is everywhere.
- A header (a layer, a ward heading) selects every chip under it, or
  clears them when they are all on. It is not a selection of its own.
- **Filters do not cascade.** Nothing on a page appears, disappears,
  greys out or recounts because of another selection. The feedback is the
  result count in the page's header; an empty result says "Nothing
  matches these filters" with Clear filters. Here and Nearby depend on
  the position, not on other chips, so theirs are the only labels that
  change by themselves.
- **Nearby** keeps the places within a radius of the position: 1 km at
  first, set on a slider (500 m, 1 km, 1.5 km, 2 km, 3 km) that appears
  under the chip, with the walk it means. The last radius is remembered
  on the device. A dashed circle on the map shows the reach. Without a
  fix it narrows nothing.
- **+ Adjacent** adds the chips next to everything picked (by hand, and
  Here's): one hop on the area graph, with each merge contracted to a
  single node. An area has three looks:
  - **picked**: filled; a tap takes it out, and Here off if it was
    Here's;
  - **added** by + Adjacent: hatched, marked ∗; a tap takes it out and
    freezes the other added areas as picks, with + Adjacent off;
  - **out**: outlined; a tap picks it, and with + Adjacent on its
    neighbours come in as added.
- **Here** is the chip whose shape the position falls in (the area
  shapes in public/areas, generated from census blocks by
  `npm run areas`). Between shapes it is the chip of the raw area whose
  centre (the centroid of its places) is nearest, within 2 km and inside
  the region's bbox. Unresolved (no fix yet, or away from every area) it
  narrows nothing. It follows the position, re-evaluated with the 3 s
  position throttle.
- **Search** matches the name, branch, raw area, area chip, kinds, notes,
  every facet value and the Japanese address, ignoring case and width.
- The whole state serialises to the URL query string (`c`, `hide`, `a`,
  `here`, `adj`, `q`, `star`, `b`, `open`, `near`, `at`;
  `src/filter/url.ts`), so a
  filtered view survives reload and can be shared. Here and Nearby travel
  as themselves, not as where the sender stood.

```ts
interface FilterState {
  region: RegionId;
  categories: Set<string>;   // "drinks/Coffee", or a layer id for a layer without kinds
  hideAll: boolean;          // Hide all: no places; categories stay empty while on
  areas: Set<string>;        // area chips
  here: boolean;
  adjacent: boolean;         // + Adjacent
  nearby?: number;           // Nearby's radius in metres; absent = off
  text: string;
  starredOnly: boolean;
  bookmarkedOnly: boolean;
  openNow: boolean;
  openAt?: string;           // "YYYY-MM-DDTHH:MM", Tokyo wall clock
}
```

```
shown = places in the region, none under Hide all
  ∩ (no categories ? all : ∪ selected categories)
  ∩ (nothing picked and no Here ? all : area ∈ picked ∪ {Here's} ∪ (adjacent ? their neighbours : ∅))
  ∩ (nearby and a fix ? within the radius of you : all)
  ∩ every other flag that is on
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
