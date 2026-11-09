# Filter pages and the area map

Status: **draft, decisions recorded** (2026-11-09). Jerry's answers are
folded in below; the open points are listed at the end. Jerry framed two
sub-milestones: the filter pages in the strip, then the area map. The
second splits in two here (agreed), because the area shapes are a data
job of their own and are worth reviewing before any map mode is built
on them.

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
- **Quieting the basemap is easy.** Its layers split cleanly: 14 label
  layers (every one of type `symbol`), the road layers (ids starting
  `roads_`), and land, water, parks and boundaries. Hiding some of them is
  a visibility switch per layer, with no style reload.
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

### The pages and the footer

- **Two pages**, each with a footer button that shows as pressed while
  its page is open:
  - **Filters**: Show only and Category. Uses the existing icon.
  - **Area**: Here, Nearby and the area chips. Needs artwork; a text
    label until it arrives.
- **Footer**:

  | Mode | Left | Middle | Right |
  | --- | --- | --- | --- |
  | List | A–Z / Nearest | | Filters, Area, Search |
  | Card | Back | Prev, Next | Filters, Area, Search |
  | Page | | | Filters, Area, Search |

  Each filter button gets its own dot when its page has a selection.
- **The Area button** shows when the region has at least one area chip
  (decided). A region without areas, like Hakone today, has none, with no
  special case for it.
- Settings and Diagnostics stay sheets.

### Opening and leaving a page

- **Opening** a page puts the strip at Half and hides any open card,
  which comes back when the page closes.
- **The page's header** shows its name and the live result count, with
  **Clear** in the upper right (decided). Clear clears that page's
  selections. It replaces "Clear all filters"; the empty state's Clear
  filters stays.
- **The Area page stays at Half** and its content scrolls (decided).
  Full would hide the map, which is the point of the page.
- **Leaving** happens in three ways, with no Done:
  - tap the page's button again;
  - tap another footer button (the other page, or Search);
  - change region.
- **Where leaving goes** (decided):
  - If a card was open, back to that card, at the height it had.
  - Otherwise back to the list, at the height it had, with its scroll
    position kept.
  - Open question B: a card whose place no longer matches the new
    filters.
- **Back on Android** walks page, then card, then list: opening a page
  pushes a history entry above the card's. An iOS Home Screen app has no
  back gesture.
- **The map on the Filters page** behaves as usual: the results update
  live, and tapping a pin opens its card, which leaves the page.

### Here and Nearby (proposed, to confirm)

Nearby becomes a chip at the top of the Area page beside Here, so its
effect on the chips below shows without scrolling at Half. An area has
three looks, on its chip and, in Part 3, on the map:

| Look | Means | Tap |
| --- | --- | --- |
| **Filled** | In because you picked it, directly or through Here | Out. If it was Here's area, Here turns off. |
| **Tinted** (lightly filled) | In because Nearby added it, as a neighbour of something filled | Out. The other tinted areas become picks and Nearby turns off; the rest stays as it was. |
| **Outlined** | Out | Picked. With Nearby on, its neighbours come in tinted. |

- Turning Nearby off drops the tinted areas; picks stay.
- Nearby covers several picks at once: the tinted areas are the
  neighbours of everything filled, Here's area included.
- The URL keeps the picks (`a=`), `here=1` and `nb=1`. The tinted areas
  are derived, so a link reproduces them; after a tap on a tinted area,
  `a=` holds the frozen set.
- This replaces step 2's dotted outline and its quirk. Today, tapping a
  dotted chip promotes it to a pick, which pulls in its own neighbours
  and widens the ring instead of narrowing it.

Example: pick Shibuya and turn Nearby on. Harajuku, Omotesando, Aoyama,
Ebisu and Tomigaya come in tinted. Pick Ginza: Nihonbashi comes in tinted
too. Tap Ebisu: Ebisu goes out; Harajuku, Omotesando, Aoyama, Tomigaya and
Nihonbashi become picks; Nearby turns off.

In Part 1 the looks are neutral (dark fill, light fill, outline); Part 3
colours them.

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
  - shapes of different chips don't overlap;
  - chips whose shapes touch are listed as neighbours, and the reverse,
    so the hand-kept graph stays honest.
- **Adding places** gains a step: a new raw area needs its towns listed
  and the shapes regenerated.
- **Review:** a Diagnostics switch draws the shapes on the normal map,
  so they can be checked on the phone before Part 3.
- **Here by shape** (open question E): Here today picks the area whose
  centre, the average position of its places, is nearest, within 2 km.
  - That is a guess. Near a border the neighbour's centre can be closer,
    and a centre drifts whenever a place is added at an area's edge.
  - With shapes, Here becomes "the area whose shape you are standing
    in", which is exactly what the map draws around the blue dot.
  - Between shapes, it falls back to the nearest centre within 2 km.
  - It costs a point-in-polygon test on about 40 shapes per position
    update.

## Part 3: the area map

### Opening the Area page

- The map eases to fit every area shape above the strip, which is "the
  whole city" as far as our places go.
- Pan, zoom and rotate turn off.
- The locate and fit buttons hide (decided). The blue dot stays.
- **The basemap quiets down** (decided): every basemap label and every
  road hides. Land, water, parks and green space stay. Our area labels
  are the only text. Open question C: the rail lines.

On an iPhone at Half, Tokyo fits at about zoom 11.5. An area is then
roughly 15 to 40 px across: enough to see, small to tap, so the chips
stay the main control.

### What the map shows

- **Pins:** only bookmarks and lodging in the region, whatever the other
  filters say. They can't be tapped. There is no lodging layer yet, so
  for now that means bookmarks.
- **Area shapes** take the three looks from Part 1:
  - outlined;
  - filled, semi-transparent;
  - tinted, a lighter fill.

  Areas that are in (filled or tinted) are labelled with their names;
  MapLibre drops labels that would collide.
- **Tapping an area** on the map does what tapping its chip does
  (decided). With the pins inert and the map locked, a tap can't mean
  anything else.

### Colours

- **Tokyo is coloured by section** (decided). The 33 raw areas span ten
  wards, which is more than ROYGBIV plus magenta can cover. The five
  sections are the grouping the chip list already uses:
  - Central: red
  - Shibuya: orange
  - Shinjuku: yellow
  - Meguro · Setagaya: green
  - East: blue

  Indigo, violet and magenta are spare for new sections.
- **Kyoto** has no sections, so each of its seven chips takes one colour
  of ROYGBIV.
- **Within a section**, each chip is a variant of the section's hue
  (decided).
  - Variants differ in lightness and saturation as well as hue, because
    Shibuya's seven chips all touch.
  - Neighbours on the area graph get different variants.
  - Outlines use a darker shade than the fill, so yellow still shows on
    the light map.
  - The colours are tuned for both map flavours.
- **The chips match their areas:**
  - outlined in the area's colour when out;
  - filled with it when picked, with black or white text by contrast;
  - a light fill of it when tinted.
- **The Here chip takes its area's colour** (decided), and is neutral
  while Here is unresolved.
- Colour is a hint, never the only signal. Fill versus outline, and the
  labels, carry the meaning for colour-blind eyes.

### Leaving the Area page

- The camera returns to exactly where it was before the page opened
  (decided).
- Pan and zoom come back, with the pins, the buttons, and the basemap's
  labels and roads.

## Decisions

Decided (2026-11-09):

1. Colour by section, with variants in lightness and saturation.
2. Tapping an area on the map toggles it.
3. The Area page keeps the strip at Half; the page scrolls.
4. Leaving restores the camera, and returns to the open card if there
   was one, else to the list.
5. Clear sits in the upper right of the page header.
6. The Area button shows whenever the region has areas; no special case.
7. In area mode the basemap hides its labels and roads; our labels show.
8. Here takes its area's colour.
9. Three steps: filter pages, area shapes, area map.

Open:

- **A. Nearby, as above.** Three looks, and a tap on a tinted area
  freezes the rest and turns Nearby off. Also: while Nearby is on, does a
  new pick bring its neighbours (recommended), or only the picks made
  before Nearby was switched on?
- **B. A card whose place no longer matches** after the page closes:
  back to the list (recommended), or the card anyway? A card for a place
  that isn't pinned would point at nothing on the map.
- **C. Rail lines in area mode:** keep them, thin and unlabelled
  (recommended, since trains are how visitors get between areas), or
  hide them with the roads?
- **D. Kyoto shapes:** generated discs to start (recommended), or
  hand-drawn now?
- **E. Here by shape** once the shapes exist (recommended), or keep
  nearest-centre?
- **F. Artwork** for the Area button.

## Steps, each deployable

1. **Filter pages** (Part 1), including Nearby's three looks in neutral
   colours. Wanted whatever happens to the rest. UI plumbing of a few
   hundred lines; no unknowns.
2. **Area shapes** (Part 2). Small code; the effort is drafting and
   reviewing about 33 lists of towns.
3. **The area map** (Part 3). A few hundred lines across the map, the
   basemap style, the pins and the Area page.

## Files

- **Part 1:**
  - `src/ui/filter-sheet.ts` becomes `src/ui/filter-pages.ts`
  - `src/filter/state.ts`, `src/filter/apply.ts`, `src/filter/url.ts`
    (Nearby's freeze-on-tap action)
  - `src/ui/app.ts` (page mode, footer, the return to the card or the
    list, history)
  - `src/ui/panel.ts` (a height lock)
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
  - `src/map/style.ts` (the quiet basemap: which layers hide)
  - `src/map/area-layers.ts` (new: the shape layers and labels)
  - `src/config/area-colors.ts` (new)
  - `src/map/pins-dom.ts` and `src/map/pins-sdf.ts` (non-interactive
    pins)
  - `src/ui/filter-pages.ts`
  - `src/ui/app.ts`
  - `src/style.css`

## Done when

- [ ] Filters and Area open in the strip at Half, with the live count and
      Clear in the upper right; each closes by its own button, another
      footer button or a region change, and returns to the card or the
      list it came from.
- [ ] Nearby's tinted areas behave as in the table, and a link
      reproduces them.
- [ ] Every Tokyo and Kyoto area has a shape, reviewed on the phone.
- [ ] The Area page shows the whole city, locked, without basemap labels
      or roads, with only bookmarks and lodging pinned and inert, and the
      blue dot.
- [ ] Areas are outlined, filled or tinted in colours that match their
      chips, readable in light and dark, and toggle when tapped.
- [ ] Leaving the Area page puts the camera back where it was.

## Beyond Japan (a note, not this milestone)

Jerry hopes to use the app beyond Japan. Things that assume Japan today,
each of which would become region config:

- open now is evaluated in Asia/Tokyo time;
- the build's ward check reads Japanese addresses (区, 市, 町, 村);
- the area shapes come from OpenStreetMap admin levels 9 and 10, which
  are towns and chōme in Japan but mean different things elsewhere.

The data model (layers, regions, raw areas, merges, sections) and the
Area button rule above are already country-neutral.
