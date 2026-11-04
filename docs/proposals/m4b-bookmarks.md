# M4b: Bookmarks

Status: **implemented, awaiting phone acceptance** (approved and built
2026-11-04). Checked in a desktop browser at phone width; see Results.

## Goal

Mark places you're interested in and see just those. Bookmarks are
personal: stored on the device, never in the sheet, not shared with the
group. One toggle on the card, a mark on bookmarked rows and pins, and a
"Bookmarked only" shared filter that works like ★ only.

## Done when

- [x] A bookmark button on the card toggles the place; the state survives
      a reload and a cold open of the installed app.
- [x] Bookmarked rows show a mark; bookmarked pins show a badge (both
      renderers).
- [x] "Bookmarked only" in the filter sheet's Flags section, with a count,
      narrows the list and the map to bookmarks across every layer; it
      appears in the strip summary and in the URL as `b=1`.
- [x] With no bookmarks, the filter chip is disabled and says so.
- [x] `npm test` covers the bookmark store and the filter.

## Design

### Store (`src/data/bookmarks.ts`)

A set of place ids in IndexedDB under one key (`bookmarks:v1`), through
the same `idb-keyval` store as the CSV cache, so M7's persistence request
covers it. Loaded once at startup into an in-memory `Set`; every toggle
writes the whole set back (it's small). A tiny observable: `has(id)`,
`toggle(id)`, `all()`, `subscribe(fn)`. Tests run it over the memory
store from M1.

Ids are the place ids (`layer:slug`), so a bookmark follows a place
across sheet edits unless the name changes. A bookmarked id that no
longer exists in the data is kept silently (the row may come back) and
simply shows nothing. Not exporting or sharing bookmarks; a "send my
bookmarks" is wishlist material.

### Filter

`FilterState` gains `bookmarkedOnly: boolean`, a shared filter like
`starredOnly`: in `hasActiveFilters`, cleared by Clear, written to the
URL as `b=1`. Because the bookmark set lives outside the filter state,
`applyFilters` and the count functions take it through their options
(`{ bookmarks: Set<string> }`); with the flag on and no set given,
nothing matches. A shared URL with `b=1` shows the *recipient's*
bookmarks, which is the only thing it can mean.

### UI

- **Card**: a bookmark icon button in the action row (next to Share and
  the link). The icon is Jerry's seal (`src/ui/icons/bookmark.webp`): full
  colour when bookmarked, the same image under a CSS greyscale filter at
  reduced opacity when not, so one asset serves both states.
- **List rows**: the seal, small, before the name (after the ★) on
  bookmarked rows only.
- **Pins**: DOM renderer gets an `is-bookmarked` class that shows the
  seal as a corner badge; the SDF renderer draws the seal as a second
  SDF-free raster image (added with `map.addImage` without `sdf`) in a
  badge layer offset from the pin, since the seal is multicolour.
- **Filter sheet**: "Bookmarked only (n)" chip in Flags; disabled with
  "none yet" when the set is empty.
- **Strip summary**: a "Bookmarked" tag when the filter is on.

### Files

```
src/data/bookmarks.ts            new, + test
src/filter/state.ts, apply.ts, url.ts   bookmarkedOnly + options, tests
src/ui/detail.ts                 toggle button
src/ui/list.ts                   row mark
src/map/pins.ts, pins-dom.ts, pins-sdf.ts   bookmarked flag and badge
src/ui/filter-sheet.ts, filter-summary.ts   chip and tag
src/ui/app.ts                    load the store, pass the set, re-render on change
src/style.css
docs/design/regions-layers-filters.md       the new shared filter
```

No new dependencies.

## Order of work

1. Store with tests; filter state, apply, URL with tests.
2. Card toggle, row mark, pin badges. Deploy.
3. Filter chip, strip tag, empty-state wording. Deploy; phone check that
   bookmarks survive a cold open.

## Out of scope

Syncing or sharing bookmarks between devices or people; bookmark notes;
ordering the list by bookmark.

## Open questions

- **Toggle from the card only** (decided 2026-11-04); rows just show the
  mark, so a row tap always means "open".
- **Bookmarks in the fit-to-results button**: it fits the filtered set,
  so with the filter on it frames the bookmarks; nothing extra needed.

## Diff size

About 12 files touched, roughly 350 lines, a third tests.

## Results

Built 2026-11-04. 129 tests (7 new: the store, the filter and counts with
a bookmark set, the URL flag, the pin flag).

Verified in the browser pane at 375×812 against the production build:

- Card: the seal is greyscale at 55% when not bookmarked and full colour
  when it is; the label flips between "Bookmark this place" and "Remove
  bookmark".
- The bookmarked pin shows the seal as a corner badge (DOM renderer); the
  row shows it before the name.
- Filters: "Bookmarked only" with a count of 1; on, the strip reads
  "1 place" with a "Bookmarked" tag and the URL is `?b=1`.
- Reload: the bookmark is still set and the row still marked (IndexedDB).

For the phone pass:

- A cold open of the installed app keeps the bookmark.
- The SDF renderer's badge (Settings → SDF symbols) sits top-left of the pin.
- The greyscale seal reads as "not set" at a glance.

Decisions made while building:

- The filter sheet's chip counts bookmarks in the current region and is
  disabled with "none yet" when that is zero, unless the filter is
  already on (so it can always be turned off).
- The SDF renderer adds the seal as a plain raster image at pixelRatio 2
  in its own badge layer, offset up-left of the pin; multicolour art can't
  be an SDF.
- Saves are serialised and a failed save only logs; the in-memory set is
  still right for the session.
