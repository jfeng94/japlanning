# Strip footer, header and the search flow

Status: **built** (2026-11-05), waiting for the phone pass.

## Why

On a phone the thumb lives at the bottom of the screen. Today the strip's
header carries both the summary and the actions, and the card's own head
carries Back and Bookmark, so the actions move up and down with the panel
and sit at different heights in list and detail. Jerry's picture: the
panel is a scroll with two ends. The **footer** is the fixed end at the
bottom of the screen, where the frequent actions live so muscle memory
works; the **header** is the top end, which travels with the panel and
carries what the panel is showing. Collapse the panel and the two ends
meet with nothing between them.

Two search frictions ride along: leaving the keyboard to look at the map
takes two gestures, and opening a place from the search results hides the
map it was found on.

## The panel

Three parts, top to bottom: the handle and header (the drag surface, as
now), the content (list or card), the footer. The footer is the panel's
last child, always on screen, with the safe-area inset below it. At the
"strip" height the content is hidden and the header sits directly on the
footer; at half and full the content scrolls between them.

**Taps and drags on the header** (fixed 2026-11-09): a press becomes a
drag once it moves 6 px, and only then does the panel capture the
pointer. It used to capture on the press itself, and Chromium sends the
click of a captured pointer to the capturing element, so in desktop and
Android Chrome the header's buttons (Directions, Copy link, Bookmark, a
page's X) never got their clicks. WebKit targets taps by what is under
the finger, so the iPhone never showed it. Moves and releases are heard
on the window, so a press that leaves the header before it is a drag
still ends cleanly.

### Footer, always

- **Search**, pinned right. Opens the search field in the top bar (as
  now), closes an open card, raises the panel to full.
- **Filters**, left of Search. Opens the filter sheet. The active-filter
  dot and the search-text dot stay on these two buttons.

### Footer, while a card is open

- **Back to list**, pinned left. Same as the card's Back today (history
  back when the card was pushed), and the panel returns to the height the
  list had.
- **Previous / Next**, centred. Step through the current filtered list in
  list order; the map follows; the history entry is replaced, so Back
  still means "to the list". Disabled at the ends (no wrap: a wrap hides
  that you have seen everything).

### Header

- **List**: the results summary as now (count, layer icons, filter tags,
  status line), no buttons.
- **Card**: the place name left, ellipsised; on the right **Directions**,
  **Show on map** and **Bookmark** as icon buttons, so every action on a
  place is in one row. The card body loses its head row (Back, title,
  Bookmark); the title moves into the header, and the meta line (layer,
  neighborhood, distance) becomes the body's first line.

  *Changed 2026-11-11* (Jerry): the meta line moved into the header as
  a small line under the name, "Coffee · Shinjuku · 160 m away". It
  drops the layer, since the kind implies it ("Coffee" is a drink,
  "Pastry" a sweet); a place without kinds (Activities) still names its
  layer.

The Share and Link buttons stay in the card body, as they are about the
place rather than navigation.

**The chevron** (Jerry, 2026-11-10). The filter pages' X in the upper
right worked well, so the list and card headers got the same spot: a
chevron, V at half or full (collapse to the strip), turned up as ^ while
collapsed (open to half). It is one button per header, made by the
panel (`Panel.toggleButton`), so its face and label follow the height
however it changed, a drag included. Half to full stays a drag or a tap
on the handle. To make room in the card header, and to keep Bookmark
and Directions from being tapped for each other:

- **Bookmark** moved to the left of the name;
- **Show on map** moved into the body's action row, after the website
  button (copy link, website, show on map);
- **Directions** stays on the right, left of the chevron.

## Search flow

1. **Keyboard closes, panel drops to half.** While the search field is
   open and has text, the field losing focus (Done on the keyboard, a tap
   on the map, a tap on a row) sets the panel to half, so the map shows
   with the results still filtered. Detected by the input's `blur` event;
   iOS fires it for Done and for taps outside. The field itself stays
   open with its text, so the filter holds; Cancel clears it as now.
2. **A row opens its card at half**, the same as a tap on a pin, so the
   place is visible on the map behind the card. Back restores the list at
   the height it had before (full if it was full), with its scroll
   position, as today.

   *Changed 2026-11-10* (Jerry: the jump is distracting while browsing
   the area): a pin tapped on the map only selects. The card opens at
   the panel's height, collapsed included, and the map doesn't move. A
   second tap on the selected pin, or Show on map, **presents** the
   place: the card at half and the map eased to it at zoom 15. A row,
   Prev/Next and a link still present, since their pin may be anywhere.
   Back from a card that never left the strip leaves the panel on the
   strip.

   *Changed 2026-11-11* (Jerry): Prev/Next leave a collapsed panel
   collapsed. The map still eases to the next place or station, since it
   may be off-screen; from full they still drop the card to half.

## Files

- `src/ui/panel.ts`: a `footer` slot; the strip height counts header plus
  footer; the content hides at "strip".
- `src/ui/app.ts`: footer and header composition per mode; Prev/Next over
  the current `shown` list with `replaceState`; the Search/Filters
  buttons move from the list strip to the footer; row selection sets
  half; blur handling for the search field; remembered list height.
- `src/ui/header.ts`: expose a blur callback for the search field.
- `src/ui/detail.ts`: no head row; title and meta rendered by the app's
  header; Bookmark handler moves with it.
- `src/style.css`: footer layout, header variants, safe-area.
- Docs: this file; the wishlist entry "Page through the card" in
  CLAUDE.md is done by this and comes out.

About 6 files, roughly 250 lines changed, no new tests beyond the panel
height arithmetic if it gets a pure helper.

## Open points

- Prev/Next at the ends: disabled (proposed) or hidden.
- Whether Search should also leave the panel at full when the user taps
  Search while a card is open at half (proposed: yes, as now).

## Done when

- [ ] Footer visible at every panel height with Search and Filters right;
      Back and Prev/Next appear only with a card open.
- [ ] Header shows the summary in list mode and name + Directions, Show on
      map, Bookmark in card mode; the card body starts with the meta line.
- [ ] Prev/Next walk the filtered list in order, map following, Back
      still returns to the list.
- [ ] Keyboard Done with search text drops the panel to half; a row tap
      from search opens the card at half with the map visible.

## Results (2026-11-05)

Built as proposed; Prev/Next disable at the ends. Verified in the pane
at 375×812: the footer shows Filters and Search in list mode with Back
and Prev/Next hidden; a row tap opens the card at half with the header
holding the name, Directions, Show on map and Bookmark, and the body
starting with the meta line; Prev/Next walk the filtered list, replacing
the history entry; Back returns to the list at its previous height;
the collapsed panel is the header on the footer, 104 px. A blur on the
search field with text drops the panel to half. Opening a card now sets
the height before easing the map, since a padding change cancels an
ease in flight.

For the phone pass: the keyboard's Done key dropping the panel to half
(the blur event on iOS), the footer against the home indicator (safe
area), and the three header actions on a narrow screen with a long name.
