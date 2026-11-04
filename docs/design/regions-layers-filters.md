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

A **layer** is one location type in one region, backed by one published
sheet. Planned layers: Coffee, Tea, Pastry, Restaurants, Lodging, Points of
interest. Each layer is one entry in a config file in the repo:

```ts
interface LayerConfig {
  id: string;                  // "tokyo-coffee"
  region: RegionId;
  label: string;               // "Coffee"
  csvUrl: string;              // published-to-web CSV
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
Name (★ prefix convention)   Latitude   Longitude   Neighborhood
Hours   Hours (OSM)   Link   Address (JA)   Notes   Last verified
```

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
2. **Layers**: one or more, as chips. Pins are coloured by layer.
3. **Filters**:
   - **Shared filters** apply across all selected layers: text substring
     (name, neighborhood, notes), Neighborhood, ★ only, Open now (only
     affects layers with `hasHours`), and later distance sort.
   - **Layer facets** appear only when exactly one layer is selected, because
     "Roasting" means nothing to a restaurant. With two or more layers
     selected, only shared filters are shown; facet selections are kept but
     inactive, so toggling back to one layer restores them.

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
  openNow: boolean;
  facets: Record<LayerId, Record<string /* column */, {
    values: Set<string>;
    includeUnknown: boolean;
  }>>;
}
```

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
