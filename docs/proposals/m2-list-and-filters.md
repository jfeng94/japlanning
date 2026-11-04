# M2: List and filters

Status: **done** (accepted on the phone 2026-11-04). See Results.

## Goal

The app becomes usable as a list. Pick a region, pick layers, search, and
drill into facets with live counts; the list updates and the URL carries
the state. The filter module is pure and tested, because M3's map will
render from exactly the same state. The page layout puts list and map side
by side in the DOM from day one so M3 fills a slot and M9 is CSS.

Implements the filter model in `docs/design/regions-layers-filters.md`.

## Done when

- [x] Region switch, layer chips, search, neighborhood, ★ only, and facet
      filters work on the phone, with counts next to every facet value.
- [x] Every facet has an "include unknown" toggle, default on; turning it
      off drops rows whose cell is blank, and the counts say how many.
- [x] Selecting two layers hides facet sections; coming back to one layer
      restores its facet selections.
- [x] The URL reflects the filter state; reload and share restore it.
- [x] List rows show the ★ flag, name, neighborhood and the layer's
      configured row facets.
- [x] Kyoto shows an empty state, not a blank page.
- [x] Opening the installed app shows cached data at once, then updates
      from the network without a blank gap.
- [x] The M1 data status and M0 capability panel are still reachable, from
      an info button, not on the main screen.
- [x] `npm test` covers the filter module: apply, counts, URL round trip.

## Design

### Filter state (`src/filter/`)

The `FilterState` shape from the design doc, plus the pure functions that
use it. Nothing in this directory touches the DOM.

```ts
interface FilterState {
  region: RegionId;
  layers: Set<LayerId>;
  text: string;
  neighborhoods: Set<string>;
  starredOnly: boolean;
  openNow: boolean;                           // in the state now, in the UI at M5
  facets: Record<LayerId, Record<string, FacetSelection>>;
}
interface FacetSelection { values: Set<string>; includeUnknown: boolean }
```

- `applyFilters(places, state): Place[]`. Region and layer membership
  first, then shared filters, then facets, and facets only when exactly one
  layer is selected. Within a facet the selected values OR; across facets
  AND. A row with an empty facet array matches iff `includeUnknown`.
- `facetCounts(places, state, layer): Map<column, { values: Map<string, number>; unknown: number }>`.
  For each facet, counts are computed over the rows that pass every
  *other* filter, so a value's count is "how many rows you'd see if you
  picked this". Multi-value rows count once under each value they hold.
- Text search is a case-insensitive substring over name, neighborhood and
  notes after NFKC normalisation, so full-width and half-width characters
  compare equal.
- `defaultState(region)`: all of the region's layers selected, everything
  else empty, every `includeUnknown` true.
- `reduce(state, action)`: the handful of transitions the UI needs
  (setRegion, toggleLayer, setText, toggleNeighborhood, toggleStarred,
  toggleFacetValue, setIncludeUnknown, clearFilters). Setting the region
  resets to `defaultState` for it. Facet selections for a layer survive the
  layer being deselected, so toggling back restores them.

### URL codec (`src/filter/url.ts`)

`toSearchParams(state)` / `fromSearchParams(params, config)`. Only
non-default values are written, so the default URL is bare.

```
?r=tokyo&l=tokyo-coffee,tokyo-tea&q=glitch&n=Nakameguro+%2F+Meguro&star=1
 &f=tokyo-coffee/Format=Stand|Caf%C3%A9&f=tokyo-coffee/Specialty=Pour-over
 &u=tokyo-coffee/Roasting            (include-unknown OFF for that facet)
```

Unknown layer ids, columns or regions in a shared URL are dropped, not
errors. The app writes the URL with `history.replaceState` on every change
and reads it once at startup. The last region is also remembered in
`localStorage`, because the installed app always opens at `/`.

### Store (`src/filter/store.ts`)

Twenty lines: `get()`, `dispatch(action)`, `subscribe(listener)`. Vanilla
observer pattern; the list, the URL writer, and later the map each
subscribe. This is the one piece of "framework" in the app and it's small
enough to read in one sitting.

### Layout (`src/ui/app.ts`)

```
<header>   region segmented control · layer chips · search · Filters · ⓘ
<main>
  <section class="list">    results count, rows
  <section class="map">     empty in M2; M3 fills it
<aside class="sheet">       filter sheet, slides up over the list
```

Mobile first: `main` is a column, the map section has zero height until M3,
the filter sheet is a fixed panel at the bottom toggled by a class. No
`<dialog>`; its focus and scroll-lock behaviour on iOS is more trouble than
a fixed div. M9 turns `main` into two columns with one media query.

### Filter sheet (`src/ui/filter-sheet.ts`)

Top to bottom: neighborhood chips with counts; ★ only toggle; one section
per facet of the selected layer with a value chip per configured value
(then any unlisted values the data contains), count on each chip, and a
small "include unknown (n)" checkbox; a Clear button. Rebuilt on every
state change, which is fine at this size: 39 rows now, a few hundred later.

When two or more layers are selected, the facet sections are replaced by
one line: "Pick a single layer to filter by its details."

### List (`src/ui/list.ts`)

Sorted by name. One row per place: ★ flag, name, neighborhood, then chips
for the layer's `rowFacets` (new optional `LayerConfig` field; coffee gets
Format, Specialty, Linger). Tapping a row sets `selectedId` in a separate
UI store (not `FilterState`), which highlights it now and drives the map
and detail card later. No detail yet; that's M4.

### Staged loading (`src/data/load.ts`)

The M1 loader returns once, after the network attempt, which can be up to
10 s on a bad connection. M2 adds `loadLayerStaged(layer, deps, emit)`:
emit the cache or bundled result immediately if there is one, then emit
the network result when it arrives. The list renders from the first and
re-renders on the second. A small "updating…" / "offline, showing cached"
indicator in the header replaces the M1 status rows on the main screen.

### Diagnostics (`src/ui/diagnostics.ts`)

The M1 data status section and the M0 capability panel move behind the ⓘ
button in the header, into the same sheet mechanism as filters. Nothing is
lost; it's just off the main screen.

### Tests (vitest, pure modules only)

- `apply.test.ts`: region/layer membership; text normalisation; ★ only;
  neighborhood OR; facet OR-within, AND-across; include-unknown on and off;
  multi-value rows; facets ignored with two layers selected.
- `counts.test.ts`: counts exclude the facet's own selection; unknown
  count; multi-value rows counted once per value; counts respect text and
  neighborhood filters.
- `url.test.ts`: default state is an empty query; round trip of a full
  state; unknown ids dropped; Unicode values survive.
- `reduce.test.ts`: region change resets; facet selections survive layer
  deselection; clear keeps region and layers.

UI code is kept thin and verified by hand on the phone, as in M1.

## Files

```
src/filter/state.ts          FilterState, defaultState, reduce
src/filter/apply.ts          applyFilters, facetCounts, normalise
src/filter/url.ts            toSearchParams, fromSearchParams
src/filter/store.ts          observable store
src/filter/*.test.ts
src/ui/app.ts                layout shell, wiring
src/ui/region-switch.ts
src/ui/layer-chips.ts
src/ui/filter-sheet.ts
src/ui/list.ts
src/ui/diagnostics.ts        data status + capabilities, behind ⓘ
src/ui/sheet.ts              the shared slide-up panel
src/data/load.ts             loadLayerStaged
src/data/load.test.ts        staged tests
src/data/types.ts            LayerConfig.rowFacets
src/config/layers.ts         rowFacets for coffee
src/main.ts, src/style.css
```

No new dependencies.

## Order of work

Each step is one reviewable commit, tests included.

1. Filter state, reduce, apply, counts, and their tests. Pure; no UI.
2. URL codec and store, with tests.
3. App shell: header with region switch and layer chips, list panel, map
   placeholder, diagnostics behind ⓘ. Deploy; the phone shows a list.
4. Filter sheet: search, neighborhoods, ★, facets with counts and unknown
   toggles, clear. Deploy.
5. Staged loading and the header status indicator. Deploy.
6. Empty states, Kyoto/Hakone, phone polish.

Step 1 is the pure-logic piece if Jerry wants to write one himself; the
test list above is its spec.

## Out of scope

Map (M3), detail card and clipboard/directions (M4), open-now evaluation
(M5; the `openNow` flag exists but has no UI), distance sort (M6), the
wide two-column layout (M9).

## Open questions

- **Default sort by name A→Z** (proposed). Alternatives: ★ first, or grouped
  by neighborhood. Distance sort arrives in M6 either way.
- **Row facets for coffee: Format, Specialty, Linger** (proposed). Easy to
  change; it's config.
- **Facet sections hidden with several layers selected** (proposed, per the
  design doc) vs showing each selected layer's facets in its own group.
  Hidden is simpler and matches the drill-down idea; grouped is more
  powerful but a lot more UI.
- **Remember the last region in localStorage** (proposed yes) so the
  installed app reopens where you left it.

## Diff size

About 16 new files, roughly 900 lines, half of it tests. Steps 3 and 4
are the big ones; each is still under 300 lines of UI code.

## Results

Built 2026-11-04 in six commits. 82 tests (53 new: 29 state/apply, 14
URL/store, 6 staged loader, plus the M1 ones). Bundle 45 kB, 16 kB gzipped.

Verified in the browser pane at 375×812, light and dark:

- Search `glitch` narrows to 3 of 39 and writes `?q=glitch`; the Filters
  button marks itself active.
- Facet counts match the sheet profile (Format: Stand 7, Café 24, Tasting
  bar 1, Bean shop 3, Kissaten 0 disabled, unknown 4). Selecting Stand
  gives 11 (7 + 4 unknown); Format's own counts hold while Linger's shrink.
  Unchecking include-unknown gives 7 and writes `&u=tokyo-coffee/Format`.
  Clear returns to 39 with a bare URL.
- A pasted URL with a facet value containing `é`, `star=1` and a
  neighborhood with slashes restores to exactly one place.
- Kyoto shows the empty state; `?r=kyoto` is written and the region is
  remembered in localStorage; the search box clears on region change.
- With fetch disabled and Refresh pressed, the list stays populated at
  once and the header reads "Offline · showing data from just now";
  Diagnostics shows the cached badge and the reason.
- Row tap highlights the row; the Diagnostics sheet holds the M1 data rows
  and the M0 capability panel.

Verified on the phone by Jerry at acceptance (not re-checked here):

- The sheet's slide-up, backdrop and scroll-lock feel on iOS.
- Two-layer behaviour (facet sections hidden, selections kept) has unit
  tests but no second layer in config to try by hand.
- Cold open of the installed app showing cached data before the network
  answers (the staged path; the desktop check used Refresh).

Decisions made while building, beyond the proposal:

- The parser's `Place.region` is checked in `applyFilters` as well as
  layer membership, so a stray layer id can't leak another region's rows.
- Facet values with a zero count are rendered disabled unless selected;
  the include-unknown checkbox only appears for facets that have blanks
  (or when it's already off).
- Any filter change clears the row selection, so a highlighted row never
  refers to something that just scrolled out of the result set.
- `browserDeps()` moved to `src/data/browser.ts`; the data status module
  is now a pure renderer and the app owns loading.
- A bare URL uses the remembered region; a URL with any parameter is
  taken as-is with Tokyo as its default region, so shared links don't
  depend on the recipient's localStorage.
- Escape closes an open sheet (desktop nicety; M9 territory otherwise).
