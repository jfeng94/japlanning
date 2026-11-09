# Filter pages and the area map

Status: **draft, decisions recorded** (2026-11-09, two rounds). Jerry's
answers are folded in below; the open points are listed at the end.
Jerry framed two sub-milestones: the filter pages in the strip, then the
area map. The second splits in two here (agreed), because the area
shapes are a data job of their own and are worth reviewing before any
map mode is built on them.

## Why

People who haven't been to Japan don't know Kiyosumi from Kuramae, or
what a ward is. The area chips are names without places. Drawing each
area on the map, in the colour of its chip, answers "where is that?" at
the moment of choosing.

The filter sheet also covers the map and the result count, which is the
only feedback the no-cascade rule leaves. Pages in the strip keep both
in view.

## Feasibility, in short

- **Drawing the areas is easy.** MapLibre draws any polygon from GeoJSON:
  filled and semi-transparent, hatched with a pattern, or as an outline.
  It restyles a shape on a tap. Forty shapes is nothing for it.
- **Driving the map is easy.** Fitting the camera, turning off pan, zoom
  and rotate, and putting them back are all standard MapLibre calls. A
  pinch on the locked map won't zoom the page instead, because
  `src/main.ts` already swallows iOS's gesture events.
- **Quieting the basemap is easy.** Its layers split cleanly: 14 label
  layers (every one of type `symbol`), the road layers (ids starting
  `roads_`), the rail lines (`roads_rail`), and land, water, parks and
  boundaries. Hiding some of them is a visibility switch per layer, with
  no style reload.
- **The work is the shapes, and they can be generated.** Our areas are
  visitor names, not official units: Omotesando and Shimokitazawa aren't
  towns at all. Each area's shape is assembled from official blocks.
  - **e-Stat** (the government's statistics portal) publishes the census
    small areas for every municipality: towns and chōme, and in Kyoto
    its tiny street-block towns. Higashiyama ward alone has 277 of them.
    A plain download gives a shapefile per ward, about 100 KB. The
    licence is the government standard terms, compatible with CC BY 4.0,
    and needs a source credit.
  - **OpenStreetMap** has the same town and chōme boundaries for Tokyo.
    They were checked at Kiyosumi, Kuramae, Sangenjaya, Nakameguro,
    Ginza, Tomigaya, Shimokitazawa and Shibuya. It stops at the ward in
    Kyoto, and at the city for Uji, so it only works for Tokyo.

## Part 1: filter pages in the strip

### The pages and the footer

- **Two pages**, each with a footer button that shows as pressed while
  its page is open:
  - **Filters**: Show only (Bookmarked, Open now, Nearby, Key branches)
    and Category. Uses the existing filters icon.
  - **Area**: Here, + Adjacent and the area chips. Uses the treasure-map
    scroll that Directions used until now (decided). Directions takes
    Jerry's new turn arrow.
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
  - If a card was open and its place still matches the filters, back to
    that card, at the height it had.
  - Otherwise back to the list, at the height it had, with its scroll
    position kept. A card for a place that is no longer pinned would
    point at nothing on the map.
- **Back on Android** walks page, then card, then list: opening a page
  pushes a history entry above the card's. An iOS Home Screen app has no
  back gesture.
- **The map on the Filters page** behaves as usual: the results update
  live, and tapping a pin opens its card, which leaves the page.

### Nearby: near me (proposed)

Jerry's original meaning: a quick, easy next stop from where you stand.
It is a different tool from widening the picked areas (below).

- **A flag in Show only**: only places within 1 km of you, as the crow
  flies. That is about a 15-minute walk. It sits beside Open now because
  the two together answer "where can I go next", and the Nearest order
  sorts what is left.
- **Hidden** while the Location setting is off, like Here.
- **Without a fix** it reads "Nearby · locating…" and narrows nothing.
  Turning it on with no fix starts locating.
- **On the map**, a 1 km circle around the blue dot shows the reach while
  it is on.
- **URL:** `near=1`.

### + Adjacent: widening the picked areas (proposed)

What step 2 calls Include nearby, renamed. The name is open (question A):
"+ Adjacent" is the word from Jerry's first spec and says exactly what it
adds. "Fuzzy" could be mistaken for typo-tolerant search, which the
search box might be expected to do.

It is a chip at the top of the Area page beside Here, so its effect on
the chips below shows without scrolling at Half. An area has three looks:

| Look | Chip | Map | Tap |
| --- | --- | --- | --- |
| **Picked**, directly or through Here | Filled | Filled | Out. If it was Here's area, Here turns off. |
| **Added**, a neighbour of something picked | Hatched, with ∗ before the name | Hatched, dashed outline | Out. The other added areas become picks, + Adjacent turns off, the rest stays. |
| **Out** | Outlined | Outlined | Picked. With + Adjacent on, its neighbours come in as added. |

- **Hatching** (diagonal lines) rather than dots: at city zoom, dots read
  as map texture. The chip uses the same hatching as its shape, so each
  chip is a legend for its area. The ∗ is a mark that works without
  colour, and in Part 1's neutral greys.
- **With + Adjacent on, a new pick brings its neighbours too** (proposed).
- **Turning + Adjacent off** drops the added areas; picks stay.
- **It covers everything picked at once**, Here's area included.
- **URL:** the picks stay in `a=`, with `here=1` and `adj=1`. Step 2's
  `nb=1` is read as `adj=1`. The added areas are derived, so a link
  reproduces them; after a tap on an added area, `a=` holds the frozen
  set.
- **It replaces step 2's dotted outline and its quirk.** Today, tapping a
  dotted chip promotes it to a pick, which pulls in its own neighbours
  and widens the ring instead of narrowing it.

Example: pick Shibuya and turn + Adjacent on. Harajuku, Omotesando,
Aoyama, Ebisu and Tomigaya come in hatched. Pick Ginza: Nihonbashi comes
in hatched too. Tap Ebisu: Ebisu goes out; Harajuku, Omotesando, Aoyama,
Tomigaya and Nihonbashi become picks; + Adjacent turns off.

### The algebra, after Part 1

```
shown = places in the region
  ∩ (no categories ? all : ∪ selected categories)
  ∩ (nothing picked and no Here ? all
       : area ∈ picked ∪ {Here's} ∪ (adjacent ? their neighbours : ∅))
  ∩ (nearby and a fix ? within 1 km of you : all)
  ∩ every other flag that is on
  ∩ text match
```

## Part 2: area shapes

- **Source: e-Stat for both cities** (proposed), so there is one source,
  one pipeline, and no dependence on the Overpass server, which timed out
  twice while this was being written. Kyoto gets real shapes in the first
  pass and the generated discs are no longer needed. OpenStreetMap stays
  the fallback for Tokyo.
- **Generated, then reviewed.** Each census block goes to the raw area
  whose centre is nearest, among the areas of the block's own ward,
  within about 1 km. A raw area's shape is the union of its blocks.
  - Where the draft is wrong, an override in config moves named blocks
    between areas, or moves an area's centre.
  - Hand-listing blocks would be impractical in Kyoto, at 277 for one
    ward.
- **Merged chips:** a chip's shape is the union of its members' shapes.
- **Build:** `npm run areas` downloads the wards' shapefiles (cached and
  gitignored), assigns, unions, simplifies, and writes
  `public/areas/<region>.geojson`. The output is committed, so the build
  never needs the network. Tens of KB per region, precached for offline.
- **Credits:** e-Stat's source line joins the OpenStreetMap credit.
- **Tests:**
  - every raw area has a shape;
  - every place lies in its area's shape, or within 100 m of it;
  - shapes of different chips don't overlap;
  - chips whose shapes touch are listed as neighbours, and the reverse,
    so the hand-kept graph stays honest.
- **Adding places** gains a step: a new raw area means regenerating the
  shapes and looking at them.
- **Review:** a Diagnostics switch draws the shapes on the normal map,
  so they can be checked on the phone before Part 3.
- **If a shape still looks wrong** after overrides, it can be drawn by
  hand: in Google My Maps, exported as KML, which the script reads in
  place of the generated shape.
- **Here by shape** (decided): Here becomes "the area whose shape you are
  standing in", which is exactly what the map draws around the blue dot.
  - Today it picks the area whose centre, the average position of its
    places, is nearest within 2 km. That is a guess near borders, and a
    centre drifts whenever a place is added at an area's edge.
  - Between shapes, it falls back to the nearest centre within 2 km.
  - It costs a point-in-polygon test on about 40 shapes per position
    update.

## Part 3: the area map

### Opening the Area page

- The map eases to fit every area shape above the strip, which is "the
  whole city" as far as our places go.
- Pan, zoom and rotate turn off.
- The locate and fit buttons hide (decided). The blue dot stays.
- **The basemap quiets down** (decided):
  - every basemap label and every road hides;
  - land, water, parks and green space stay;
  - the rail lines stay, thin and unlabelled, since trains are how
    people get between areas (decided);
  - our area labels are the only text.

On an iPhone at Half, Tokyo fits at about zoom 11.5. An area is then
roughly 15 to 40 px across: enough to see, small to tap, so the chips
stay the main control.

### What the map shows

- **Pins:** only bookmarks and lodging in the region, whatever the other
  filters say. They can't be tapped. There is no lodging layer yet, so
  for now that means bookmarks.
- **Area shapes** take the three looks from Part 1: outlined, filled
  (semi-transparent), or hatched with a dashed outline. Areas that are in
  are labelled with their names; MapLibre drops labels that would
  collide.
- **The hatching** is a pattern image per colour, drawn at load (a few
  dozen tiny images), so each area hatches in its own colour.
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
  - hatched with it, and marked ∗, when added.
- **The Here chip takes its area's colour** (decided), and is neutral
  while Here is unresolved.
- Colour is a hint, never the only signal. Fill, hatching and outline,
  the ∗ and the labels carry the meaning for colour-blind eyes.

### Leaving the Area page

- The camera returns to exactly where it was before the page opened
  (decided).
- Pan and zoom come back, with the pins, the buttons, and the basemap's
  labels and roads.

## Icons (2026-11-09)

- **Directions** now uses Jerry's turn arrow.
- **The Area button** gets the treasure-map scroll that Directions had.
  - That scroll is also `trip.webp`, set aside for the M10 trip planner,
    so M10 will need its own art or will share it.
- **The new turn arrow and Share's arrow are alike**: both red, both
  curved, on the same card (Directions in the header, Share in the
  body). See question F.

## Decisions

Decided (2026-11-09):

1. Colour by section, with variants in lightness and saturation.
2. Tapping an area on the map toggles it.
3. The Area page keeps the strip at Half; the page scrolls.
4. Leaving restores the camera. It returns to the open card if its place
   still matches, else to the list.
5. Clear sits in the upper right of the page header.
6. The Area button shows whenever the region has areas; no special case.
7. In area mode the basemap hides its labels and roads but keeps the
   rail lines; our labels show.
8. Here takes its area's colour.
9. Three steps: filter pages, area shapes, area map.
10. Here by shape, once the shapes exist.
11. Nearby (near me) and widening the picked areas are two separate
    tools.
12. The Area button uses the scroll; Directions uses the turn arrow.

Open:

- **A. The two tools, as above.**
  - Nearby: is 1 km right, and is Show only the right page for it?
  - The widening chip: is "+ Adjacent" the right name?
  - Hatching plus ∗ for added areas?
  - With it on, does a new pick bring its neighbours too? (recommended)
- **D. Shapes from e-Stat for both cities** (recommended), with
  OpenStreetMap as the fallback for Tokyo and hand-drawn KML for anything
  the overrides can't fix?
- **F. Share and Directions** both being red curved arrows: fine, or new
  art for one of them?

## Steps, each deployable

1. **Filter pages** (Part 1): the pages, Nearby, + Adjacent's looks in
   neutral greys, the Nearby circle on the map, the icons. Wanted
   whatever happens to the rest. UI plumbing of a few hundred lines; no
   unknowns.
2. **Area shapes** (Part 2). A small script; the effort is the review.
3. **The area map** (Part 3). A few hundred lines across the map, the
   basemap style, the pins and the Area page.

## Files

- **Part 1:**
  - `src/ui/filter-sheet.ts` becomes `src/ui/filter-pages.ts`
  - `src/filter/state.ts`, `src/filter/apply.ts`, `src/filter/url.ts`
    (Nearby; + Adjacent's rename and its freeze-on-tap action)
  - `src/ui/app.ts` (page mode, footer, the return to the card or the
    list, history)
  - `src/ui/panel.ts` (a height lock)
  - `src/map/map.ts` (the Nearby circle)
  - `src/style.css`
  - `src/ui/icons/area.webp` (the scroll)
- **Part 2:**
  - `scripts/build-areas.ts` (new)
  - `public/areas/*.geojson` (generated, committed)
  - `src/config/regions.ts` (overrides)
  - `src/data/areas.ts` (load the shapes, point-in-shape)
  - tests
  - `scripts/build-sw.ts` (precache the shapes)
  - `package.json` (dev-only: a shapefile reader and a polygon union)
  - `docs/design/adding-places.md`
- **Part 3:**
  - `src/map/map.ts` (area mode: fit, lock, buttons)
  - `src/map/style.ts` (the quiet basemap: which layers hide)
  - `src/map/area-layers.ts` (new: the shape layers, patterns and labels)
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
- [ ] Nearby narrows to 1 km around you with the circle on the map, and
      says so while locating.
- [ ] + Adjacent's added areas behave as in the table, and a link
      reproduces them.
- [ ] Every Tokyo and Kyoto area has a shape, reviewed on the phone.
- [ ] The Area page shows the whole city, locked, without basemap labels
      or roads but with the rail lines, only bookmarks and lodging pinned
      and inert, and the blue dot.
- [ ] Areas are outlined, filled or hatched in colours that match their
      chips, readable in light and dark, and toggle when tapped.
- [ ] Leaving the Area page puts the camera back where it was.

## Beyond Japan (a note, not this milestone)

Jerry hopes to use the app beyond Japan. Things that assume Japan today,
each of which would become region config:

- open now is evaluated in Asia/Tokyo time;
- the build's ward check reads Japanese addresses (区, 市, 町, 村);
- the area shapes come from Japan's census blocks (or OpenStreetMap
  admin levels 9 and 10, which are towns and chōme in Japan but mean
  different things elsewhere).

The data model (layers, regions, raw areas, merges, sections) and the
Area button rule above are already country-neutral.
