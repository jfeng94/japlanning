# M4b: Bookmarks

Status: **proposed** (2026-11-04). Waiting for go-ahead.

## Goal

Mark places you're interested in and see just those. Bookmarks are
personal: stored on the device, never in the sheet, not shared with the
group. One toggle on the card, a mark on bookmarked rows and pins, and a
"Bookmarked only" shared filter that works like ★ only.

## Done when

- [ ] A bookmark button on the card toggles the place; the state survives
      a reload and a cold open of the installed app.
- [ ] Bookmarked rows show a mark; bookmarked pins show a badge (both
      renderers).
- [ ] "Bookmarked only" in the filter sheet's Flags section, with a count,
      narrows the list and the map to bookmarks across every layer; it
      appears in the strip summary and in the URL as `b=1`.
- [ ] With no bookmarks, the filter chip is disabled and says so.
- [ ] `npm test` covers the bookmark store and the filter.

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
  the link), filled when bookmarked. Jerry may supply an icon; until then
  an inline SVG bookmark glyph in the accent colour.
- **List rows**: a small bookmark glyph before the name, after the ★.
- **Pins**: DOM renderer gets an `is-bookmarked` class with a corner badge
  via CSS; the SDF renderer gets a second text overlay like the ★ one,
  using a glyph from the hosted font range.
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

- **Icon**: Jerry's artwork or the inline glyph (proposed: glyph now,
  swap when there's artwork).
- **Toggle from the list row too**, or card only (proposed: card only;
  rows just show the mark, which keeps row taps meaning "open").
- **Bookmarks in the fit-to-results button**: it fits the filtered set,
  so with the filter on it frames the bookmarks; nothing extra needed.

## Diff size

About 12 files touched, roughly 350 lines, a third tests.

## Results

(filled in after acceptance)
