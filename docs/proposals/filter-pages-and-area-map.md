# Filter pages and the area map

Status: **draft** (2026-11-09), for review. Jerry framed two
sub-milestones: the filter pages in the strip, then the area map. The
second splits in two here, because the area shapes are a data job of
their own and are worth reviewing before any map mode is built on them.

## Why

People who haven't been to Japan don't know Kiyosumi from Kuramae, or
what a ward is. The area chips are names without places. Drawing each
area on the map, in the colour of its chip, answers "where is that?" at
the moment of choosing.

The filter sheet also covers the map and the result count, which is the
only feedback the no-cascade rule leaves. Pages in the strip keep both
in view.

## Feasibility, in short

- **Drawing the areas is easy.** MapLibre draws any polygon from GeoJSON,
  filled and semi-transparent or as an outline, and restyles it on a tap
  (feature-state). Forty shapes is nothing for it.
- **Driving the map is easy.** Fitting the camera, turning off pan, zoom
  and rotate, and putting them back are all standard MapLibre calls. A
  pinch on the locked map won't zoom the page instead, because
  `src/main.ts` already swallows iOS's gesture events.
- **The work is the shapes.** Our areas are visitor names, not official
  units: Omotesando and Shimokitazawa aren't towns at all. The shapes
  have to be assembled from something.
  - **Tokyo:** OpenStreetMap has town (町, admin level 9) and chōme
    (丁目, level 10) boundaries. They were checked at Kiyosumi (清澄),
    Kuramae (蔵前), Sangenjaya (太子堂), Nakameguro (上目黒), Ginza (銀座),
    Tomigaya (富ヶ谷), Shimokitazawa (北沢) and Shibuya (宇田川町). Every
    one was there, so each area can be the union of a few towns or
    chōme.
  - **Kyoto:** OpenStreetMap stops at the ward (東山区, 中京区), and Uji at
    the city. Kyoto's seven areas need generated or hand-drawn shapes.
    If those look wrong, the government's census small-area boundaries
    (e-Stat, CC BY-compatible) do cover Kyoto's towns.

## Part 1: filter pages in the strip

- **Two pages**, each with a footer button that shows as pressed while
  its page is open:
  - **Filters**: Show only and Category. Uses the existing icon.
  - **Area**: Here, the area chips and Include nearby. Needs artwork;
    a text label until it arrives.
- **Opening a page** closes any open card and puts the strip at Half.
  The page's header shows its name, the live result count and **Clear**
  (that page's selections). Clear replaces "Clear all filters"; the
  empty state's Clear filters stays.
- **Leaving a page** happens in three ways:
  - tap its button again;
  - tap another footer button (the other page, or Search);
  - change region.

  There is no Done. The strip goes back to the list at the height it had
  before, as Back from a card does.
- **Footer**:

  | Mode | Left | Middle | Right |
  | --- | --- | --- | --- |
  | List | A–Z / Nearest | | Filters, Area, Search |
  | Card | Back | Prev, Next | Filters, Area, Search |
  | Page | | | Filters, Area, Search |

  Each filter button gets its own dot when its page has a selection.
- **No areas, no button.** Hakone has no areas, so it has no Area
  button. That is region config, not a cascade.
- **Back on Android** closes a page, through a history entry like the
  card's. An iOS Home Screen app has no back gesture.
- **The map on the Filters page** behaves as usual: the results update
  live, and tapping a pin opens its card, which leaves the page.
- Settings and Diagnostics stay sheets.

## Part 2: area shapes

- **Tokyo:** each raw area lists the towns or chōme it covers, named as
  in OpenStreetMap and looked up within the area's ward (本町 exists in
  several wards). A whole town is "富ヶ谷"; part of one is "神宮前四丁目".
- **Drafting the lists:** a script assigns every chōme in our wards to
  the nearest area centre in the same ward, within about 1 km. The draft
  is then corrected by hand and reviewed on the map, as a findings step
  like the area assignments.
- **Kyoto, to start:** generated shapes. Each is a disc around the
  area's places, wide enough to cover them with a margin, clipped to the
  area's ward and to its neighbours' discs. Revisit if they look wrong.
- **Merged chips:** a chip's shape is the union of its members' shapes.
- **Build:** `npm run areas` fetches from Overpass, unions, simplifies,
  and writes `public/areas/<region>.geojson`. The output is committed, so
  the build never depends on Overpass, which timed out twice while this
  was being written. Tens of KB per region, precached for offline.
  OpenStreetMap data is ODbL; the app already credits it.
- **Tests:**
  - every raw area has a shape;
  - every place lies in its area's shape, or within 100 m of it;
  - shapes of different chips don't overlap.
- **Adding places** gains a step: a new raw area needs its towns listed
  and the shapes regenerated.
- **Review:** a Diagnostics switch draws the shapes on the normal map,
  so they can be checked on the phone before Part 3.

## Part 3: the area map

### Opening the Area page

- The map eases to fit every area shape above the strip, which is "the
  whole city" as far as our places go.
- Pan, zoom and rotate turn off.
- The locate and fit buttons hide. The blue dot stays.
- The strip stays at Half. Dragging it is off, since Full would hide
  the map.

On an iPhone at Half, Tokyo fits at about zoom 11.5. An area is then
roughly 15 to 40 px across: enough to see, small to tap, so the chips
stay the main control.

### What the map shows

- **Pins:** only bookmarks and lodging in the region, whatever the other
  filters say. They can't be tapped. There is no lodging layer yet, so
  for now that means bookmarks.
- **Area shapes:**

  | Chip | On the map |
  | --- | --- |
  | Unselected | Outline in its colour |
  | Selected | Filled, semi-transparent, and labelled with its name |
  | Pulled in by Here or Include nearby | Lightly filled, matching the chip's dotted outline |

- **Tapping an area** on the map toggles it. With the pins inert and the
  map locked, a tap can't mean anything else.

### Colours

- **Tokyo is coloured by section** (the headings), not by ward. The 33
  raw areas span ten wards, which is more than ROYGBIV plus magenta can
  cover. The five sections are the grouping the chip list already uses:
  - Central: red
  - Shibuya: orange
  - Shinjuku: yellow
  - Meguro · Setagaya: green
  - East: blue

  Indigo, violet and magenta are spare for new sections.
- **Kyoto** has no sections, so each of its seven chips takes one colour
  of ROYGBIV.
- **Within a section**, each chip is a variant of the section's hue.
  - Variants differ in lightness as well as hue, because seven nearby
    hues are hard to tell apart and Shibuya's seven chips all touch.
  - Neighbours on the area graph get different variants.
  - Outlines use a darker shade than the fill, so yellow still shows on
    the light map.
  - The colours are tuned for both map flavours.
- **The chips match:**
  - unselected: an outline in the area's colour;
  - selected: filled with it, with black or white text by contrast;
  - pulled in: a dotted outline in that colour.

  Colour is a hint, never the only signal. Fill versus outline, and the
  labels, carry the meaning for colour-blind eyes.

### Leaving the Area page

- Pan and zoom come back, with the pins and the buttons.
- If the selection changed, the map fits the results. Otherwise it
  returns to the camera from before.

### Follow-ons the shapes make possible

- **Here by shape:** the area whose shape contains you, falling back to
  the nearest centre within 2 km in the gaps. Here then matches the map
  exactly.
- **A check on the neighbour lists:** a test flags chips whose shapes
  touch but that aren't listed as neighbours, and the reverse, so the
  hand-kept graph stays honest.
- **Optional:** faint dots for the places matching the Filters page,
  showing where things cluster without bringing the pins back.

## Decisions needed

1. Colour by **section** (recommended; five in Tokyo) or by **ward**
   (ten, more than the eight colours)?
2. **Tap an area on the map** to toggle it (recommended), or the chips
   only?
3. **Lock the strip at Half** on the Area page (recommended), or allow
   Full for more chips at the cost of the map?
4. **Leaving the Area page:** fit the results when the selection
   changed (recommended), or always restore the camera?
5. **Kyoto:** generated discs to start (recommended), or hand-drawn
   shapes now?
6. **Here by shape** once the shapes exist (recommended), or keep
   nearest-centre?
7. Is "Area" the button's name, and is artwork coming for it?

## Steps, each deployable

1. **Filter pages** (Part 1). Wanted whatever happens to the rest. UI
   plumbing of a few hundred lines; no unknowns.
2. **Area shapes** (Part 2). Small code; the effort is drafting and
   reviewing about 33 lists of towns.
3. **The area map** (Part 3). A few hundred lines across the map, the
   pins and the Area page.

## Files

- **Part 1:**
  - `src/ui/filter-sheet.ts` becomes `src/ui/filter-pages.ts`
  - `src/ui/app.ts` (page mode, footer, exit rules, history)
  - `src/ui/panel.ts` (a height lock, used in Part 3)
  - `src/style.css`
  - `src/ui/icons/area.webp`
- **Part 2:**
  - `scripts/build-areas.ts` (new)
  - `public/areas/*.geojson` (generated, committed)
  - `src/config/regions.ts` (town lists)
  - `src/data/areas.ts` (load the shapes, point-in-shape)
  - tests
  - `scripts/build-sw.ts` (precache the shapes)
  - `package.json` (a dev-only polygon union library)
  - `docs/design/adding-places.md`
- **Part 3:**
  - `src/map/map.ts` (area mode: fit, lock, buttons)
  - `src/map/area-layers.ts` (new: the shape layers)
  - `src/config/area-colors.ts` (new)
  - `src/map/pins-dom.ts` and `src/map/pins-sdf.ts` (non-interactive
    pins)
  - `src/ui/filter-pages.ts`
  - `src/ui/app.ts`
  - `src/style.css`

## Done when

- [ ] Filters and Area open in the strip at Half, with the live count;
      each closes by its own button, another footer button or a region
      change; there is no Done.
- [ ] Every Tokyo and Kyoto area has a shape, reviewed on the phone.
- [ ] The Area page shows the whole city, locked, with only bookmarks
      and lodging pinned and inert, and the blue dot.
- [ ] Unselected areas are outlined and selected ones filled, in colours
      that match their chips, readable in light and dark.
- [ ] Here and Include nearby show on the map as they do on the chips.
- [ ] Leaving the Area page hands the map back as decided in 4.
