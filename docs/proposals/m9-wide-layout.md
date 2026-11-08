# M9: Wide layout

Status: **proposed** (2026-11-08), waiting for a go-ahead. Written to be
picked up cold.

## Goal

iPad and desktop: the list beside the map instead of over it, at one
breakpoint around 768 px. The brief asked for list and map to be
siblings from M2 so this is CSS, and they are: `main.panes` holds
`section.map-pane` and the panel (`section.panel`, position fixed at the
bottom). The phone remains the acceptance device; this must not touch
the phone layout at all.

## The layout

Above the breakpoint (`min-width: 768px` and a pointer that is not
coarse, or simply width: decide in the pane, recommended width only so
an iPad in landscape and a desktop window behave the same):

- `.panes` becomes a row: the panel on the **left** at a fixed width of
  about 380 px, full height under the top bar; the map fills the rest.
- The panel stops being a bottom sheet: position static, no snap
  heights, no drag handle, no rounded top. Header at the top, content
  scrolling in the middle, footer at the bottom of the column. The
  three-height model keeps existing in code; in the wide layout the
  panel is simply always "full" and `setHeight` is a no-op.
- The map's bottom padding goes to zero and a **left padding** equal to
  nothing (the map does not sit under the panel, it sits beside it), so
  `fitPoints` and `focus` centre in the visible map. The locate and fit
  controls stay top-left of the map pane.
- Sheets (Filters, Settings, Diagnostics) open over the panel column
  rather than the whole window, capped at the panel's width.
- The top bar is unchanged.

Why left: the thumb argument does not apply with a pointer or a tablet
held in two hands, and reading order puts the list first.

## What has to move from JS to CSS

`panel.ts` sets heights in pixels. In the wide layout it must not: the
module reads a `matchMedia("(min-width: 768px)")` once and on change,
and in wide mode `apply()` clears the inline height, hides the handle,
and reports "full" to the app. The app's calls (`setHeight("half")` on a
card open, "full" on search) become harmless. The footer's Back and
Prev/Next keep working; the Search and Filters buttons too.

The card-open behaviours that depend on height (open at half so the map
shows behind) are moot when the map is beside the list; nothing to do.

## Trade-offs

- **Where the breakpoint falls on an iPad in portrait** (768 px wide,
  exactly): include it in wide, since the panel at 380 px leaves 388 px
  of map, which is enough and better than a sheet over a tall map.
- **Resizing a desktop window across the breakpoint** must switch
  cleanly: the panel's inline height is the only state, so clearing it
  on the way wide and restoring the current snap on the way narrow is
  the whole transition.
- **The offline basemap on the iPad** (open question in the brief): the
  same code runs; the automatic download will fetch the archives on an
  iPad too. Fine, and it answers the question with "yes, it just works".

## Files

- `src/style.css`: one `@media (min-width: 768px)` block for `.panes`,
  `.panel`, `.panel-drag`, `.panel-footer`, the sheets.
- `src/ui/panel.ts`: the media query, wide-mode `apply()`, handle hidden.
- `src/ui/app.ts`: `setBottomPadding` called with 0 in wide mode (the
  panel's height callback already carries the number; the panel passes
  0 when wide).
- `src/map/map.ts`: nothing, if padding arrives as 0.
- Docs: this file; the design doc's Devices section; CLAUDE.md milestone.

Roughly 150 lines, mostly CSS, one commit. Verified in the pane at
1024×768 and 1280×800 and on the phone preset to confirm no change there.

## Done when

- [ ] At 1024 px: list on the left, map on the right, both full height,
      filters and cards work, pins fit to the visible map.
- [ ] At 375 px: pixel-identical to today (bottom sheet, three heights).
- [ ] Resizing across 768 px switches without a reload or a stuck height.
- [ ] Sheets open over the panel column in the wide layout.
