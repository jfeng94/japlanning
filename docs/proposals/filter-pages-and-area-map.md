# Filter pages and the area map

Status: **Parts 1, 2 and 3 built** (2026-11-09). The shapes are still a
draft waiting for Jerry's review on the phone, which the Area page itself
now serves. Decided in three rounds; Jerry's answers are folded in below.
Changes made while building are under "As built" at the end of each part.
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
  an **X** in the upper right that closes the page (decided; Clear sat
  there first and read oddly in a header).
- **Clear** sits at the top of the page's body and clears that page's
  selections. It is always in its place, greyed when there is nothing to
  clear, so a first selection doesn't push the chips down under the
  finger. It replaces "Clear all filters"; the empty state's Clear
  filters stays.
- **The Area page stays at Half** and its content scrolls (decided).
  Full would hide the map, which is the point of the page.
- **Leaving** happens in four ways, with no Done:
  - tap the X in the page's header;
  - tap the page's button again;
  - tap another footer button (the other page, or Search);
  - change region.
- **Where leaving goes** (decided):
  - If a card was open and its place still matches the filters, back to
    that card, at the height it had.
  - Otherwise back to the list, at the height it had, with its scroll
    position kept. A card for a place that is no longer pinned would
    point at nothing on the map.
- **Back on Android** goes to the list, as it does from a card: a page
  shares the card's one history entry (changed while building; see "As
  built" below). An iOS Home Screen app has no back gesture.
- **The map on the Filters page** behaves as usual: the results update
  live, and tapping a pin opens its card, which leaves the page.

### Nearby: near me (decided)

Jerry's original meaning: a quick, easy next stop from where you stand.
It is a different tool from widening the picked areas (below).

- **A distance filter in Show only**: only places within a radius of
  you, as the crow flies. It sits beside Open now because the two
  together answer "where can I go next", and the Nearest order sorts what
  is left.
- **The radius starts at 1 km** and is set with a slider that appears
  under the chip while Nearby is on, the way Open at's pickers appear
  under Open now. The chip reads "Nearby · 1 km".
  - Proposed stops: 500 m, 1 km, 1.5 km, 2 km, 3 km.
  - The label beside the slider gives the walk: 80 m a minute (the
    Japanese estate-agent standard) on a route about 1.3 times the
    straight line.
  - The last radius is remembered on the device; Nearby itself is filter
    state.
- **Hidden** while the Location setting is off, like Here.
- **Without a fix** it reads "Nearby · locating…" and narrows nothing.
  Turning it on with no fix starts locating.
- **On the map**, a circle of the radius around the blue dot shows the
  reach while it is on, and follows the slider as it moves.
- **URL:** `near=1000` (metres).

**Why those stops.** The 61 Tokyo places span about 16 km east to west
and 12 km north to south. Half of them have another place within 410 m,
and the loneliest is 2.3 km from its nearest. Places within each radius
of six landmarks today:

| From | 250 m | 500 m | 1 km | 1.5 km | 2 km | 3 km |
| --- | --- | --- | --- | --- | --- | --- |
| Shibuya station | 1 | 3 | 6 | 17 | 22 | 28 |
| Nakameguro station | 1 | 3 | 6 | 8 | 10 | 23 |
| Shimokitazawa station | 0 | 3 | 3 | 4 | 8 | 18 |
| Ginza 4-chome | 0 | 3 | 5 | 5 | 6 | 9 |
| Asakusa (Sensō-ji) | 1 | 2 | 2 | 5 | 7 | 8 |
| Kiyosumi-shirakawa station | 0 | 0 | 1 | 1 | 2 | 10 |
| **Walk** | 4 min | 8 min | 16 min | 24 min | 33 min | 49 min |

- **250 m** finds a place at best, so the slider starts at 500 m. It can
  come back when the food layer makes the map denser.
- **1 km** suits the dense areas but leaves Kiyosumi with one place,
  which is the case for a slider rather than a fixed radius.
- **3 km** is a 50-minute walk, past the point where a train or the Area
  page is the better tool, so it is the top stop.

### + Adjacent: widening the picked areas (decided)

What step 2 calls Include nearby, renamed "+ Adjacent", the word from
Jerry's first spec. "Fuzzy" was considered, but could be mistaken for
typo-tolerant search, which the search box might be expected to do.

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
- **With + Adjacent on, a new pick brings its neighbours too** (decided).
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

### As built (Part 1)

- **Back goes to the list, not page then card.** The proposal had a page
  push its own history entry above the card's. The app already keeps one
  entry for whatever covers the list (switching cards replaces it), so
  Back always means "to the list"; pages follow that rule instead.
  - It is simpler and avoids a race: Search has to close a page and focus
    its field in the same tap, or iOS won't raise the keyboard.
  - It only affects Android and desktop browsers; the iPhone's Home
    Screen app has no Back.
- **The slider** previews as you drag: its label and the map's circle
  follow the thumb. The filter applies when you let go, so the list
  doesn't redraw under your finger.
- **A pin tapped under the Filters page** opens its card, and the page
  gives way. Tapping the map elsewhere does nothing while a page is open,
  so the card a page hides is never closed by a stray tap.
- **Turning Location off** in Settings turns Nearby off with Here.

### The algebra, after Part 1

```
shown = places in the region
  ∩ (no categories ? all : ∪ selected categories)
  ∩ (nothing picked and no Here ? all
       : area ∈ picked ∪ {Here's} ∪ (adjacent ? their neighbours : ∅))
  ∩ (nearby and a fix ? within the radius of you : all)
  ∩ every other flag that is on
  ∩ text match
```

## Part 2: area shapes

- **Source: e-Stat for both cities** (decided), so there is one source,
  one pipeline, and no dependence on the Overpass server, which timed out
  twice while this was being written. Kyoto gets real shapes in the first
  pass and the generated discs are no longer needed. OpenStreetMap stays
  the fallback for Tokyo.
- **Generated, then reviewed.** Each census block goes to the raw area
  whose centre is nearest, among the areas of the block's own ward,
  within 700 m (1 km at first; see "As built"). A raw area's shape is the
  union of its blocks.
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
- **Review:** a switch in Settings draws the shapes on the normal map,
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

### As built (Part 2)

- **A 700 m reach, not 1 km.** At 1 km a ward with one area gave it a
  disc about 2 km across: Jimbocho took in Otemachi and Kitanomaru Park,
  Ginza reached Yaesu, Kuramae the edge of Akihabara. At 700 m each area
  keeps to its neighbourhood, with unclaimed city between them. That is
  honest: the shapes show where our places are, not a complete map of
  Tokyo. Tokyo's shapes come to 27 KB, Kyoto's to 14 KB.
- **Rules beyond the proposal:**
  - a block that holds one of an area's places always goes to that
    area, so every place sits inside its own shape;
  - water blocks (水面, in Koto ward's bay) are skipped;
  - coordinates snap to a 10 cm grid before the union, which otherwise
    trips on floating-point near-misses between neighbouring blocks;
  - outlines are simplified to 8 m, and slivers under 1,500 m² dropped.
- **The review switch is in Settings** ("Area shapes on the map"),
  rather than Diagnostics, because a setting is saved on the device and
  survives relaunches during the review. (Removed after Part 3, whose
  Area page shows the shapes.) It gives each shape a colour so
  that neighbours tell apart; Part 3 brings the section colours.
- **Here goes by the shapes.** Between shapes it falls back to the
  nearest centre within 2 km: Daikanyama, between the Shibuya and
  Nakameguro shapes, reads as Nakameguro.
- **The neighbour check** is a test. Three pairs of chips touch without
  being listed as neighbours, waiting for a decision: Aoyama – Harajuku,
  Hatagaya – Tomigaya, Shibuya – Yoyogi. Fourteen listed Tokyo pairs are
  now apart, from 119 m (Kuramae – Nihonbashi) to 1.4 km (Ichigaya –
  Shinjuku). The test doesn't hold the graph to those, since + Adjacent
  can rightly reach across a gap. (2026-11-09, after the places import:
  only Aoyama – Harajuku still waits. The other two pairs no longer
  touch in the shapes rebuilt around the new places, and every other
  touching pair, old areas and new, is now listed as neighbours.)
- **Credit:** Settings ends with the map and area-shape credits; e-Stat's
  terms ask for the source and a note that it was processed.

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

### As built (Part 3)

- **Every area is labelled, not only those in.** The page exists to
  answer "where is that?" before anything is picked, which a name on the
  map does and a matching shade of orange doesn't. Where labels collide,
  picked names win, then added, then the rest (smaller); a typical phone
  shows about two thirds of Tokyo's names with nothing picked.
- **No rail lines on a phone.** An iPhone fits Tokyo at about zoom 10.4
  (the "11.5" above counted 256-pixel tiles; MapLibre's are 512), and the
  basemap only carries rail from zoom 11. MapLibre won't fetch a source's
  tiles a zoom early (vector tiles must be 512 px), so the restyled rail
  (solid, grey, a little heavier) shows on an iPad or a desktop only.
  Drawing rail on the phone would mean shipping the lines as data, like
  the area shapes.
- **Colours** (`src/config/area-colors.ts`) are worked out in OKLCH, a
  colour space where equal steps look equal, and leave as hex for
  MapLibre:
  - seven shades per hue, assigned busiest chip first, each taking the
    unused shade most different from its neighbours' so far (Shibuya's
    seven chips use all seven);
  - a shade whose chip text would miss 4.5:1 contrast (mid lightness, too
    light for white text, too dark for black) moves until it passes;
  - outlines and labels are at most 0.52 lightness on the light map and
    at least 0.74 on the dark one, so a pale yellow or a deep red still
    stands off the land at 3:1 or better;
  - the hatching on chips is lighter than on the map, so deep shades
    don't swallow the chip's text.
- **Section hues are config:** `areaSections[].hue`. A section without
  one takes the next hue no section names, in rainbow order.
- **Taps:** a tap within 12 px of an area counts as on it, since areas
  are 15 to 40 px across at this zoom. The pins don't take taps, so a tap
  on one reaches the area under it.
- **The pins wear the bookmark badge** there, even on a closed shop: the
  page asks where, not when. `LayerConfig.onAreaMap` keeps a layer's pins
  (lodging, once it exists) on this map.
- **Nearby's circle** hides on the Area page; it belongs to the Filters
  page.
- **The locked map takes no gestures.** With MapLibre's pan and zoom off,
  the browser would scroll or pinch-zoom the page instead, so the map
  gets `touch-action: none` and main.ts swallows iOS's pinch on it too.
  *Unlocked 2026-11-10* (Jerry: the whole city is hard to see on a
  phone): pan and zoom stay on, so that CSS and the pinch exception are
  gone, and the fit button shows again, framing the city. Rotation is on
  as on the normal map; the frame straightens it. Taps still pick areas
  (a drag isn't a tap), and the slop is in pixels, so it scales with
  zoom.
- **Camera moves wait for the end of the tap.** Opening or closing the
  page changes the panel's height, which sets the map's padding, and in
  MapLibre that is a jump that cancels an ease under way. The fit and the
  return are queued until the tap's work is done. The fit also straightens
  a rotated map; the return puts the rotation back.
- **The shapes show only on the Area page** (Jerry, 2026-11-09). The
  Settings switch that drew them on the normal map for Part 2's review
  is gone; the Area page serves that review now. A device that had it
  on simply forgets it (unknown settings are dropped when read).
  *Changed 2026-11-10* (Jerry): the normal map highlights the areas in
  play, picked ones filled at 0.18 (against 0.4 on the page) with their
  edge, added ones hatched at half strength with the dashed edge, no
  names (the basemap has its own) and no unpicked areas.

## Icons (2026-11-09)

- **Directions** now uses Jerry's turn arrow.
- **Copy link** (the card's old Share button, which only ever copied the
  place's link) now uses Jerry's chain, as `copy-link.webp`. That also
  ends the two red curved arrows on one card.
- **The Area button** gets the treasure-map scroll that Directions had.
  That scroll is also `trip.webp`; the M10 trip planner gets its own art
  later (decided).
- **Resolution.** The arrow and the chain arrived as 72 and 56 px wide.
  The card draws the chain at about 27 px, which needs about 80 px on an
  iPhone's 3x screen, so a larger original would sharpen it.

## Decisions

Decided (2026-11-09):

1. Colour by section, with variants in lightness and saturation.
2. Tapping an area on the map toggles it.
3. The Area page keeps the strip at Half; the page scrolls.
4. Leaving restores the camera. It returns to the open card if its place
   still matches, else to the list.
5. An X in the page header closes the page; Clear sits at the top of the
   page's body.
6. The Area button shows whenever the region has areas; no special case.
7. In area mode the basemap hides its labels and roads but keeps the
   rail lines; our labels show.
8. Here takes its area's colour.
9. Three steps: filter pages, area shapes, area map.
10. Here by shape, once the shapes exist.
11. Nearby (near me) and widening the picked areas are two separate
    tools.
12. The Area button uses the scroll; Directions uses the turn arrow.
13. Nearby is a distance filter in Show only, starting at 1 km, with a
    slider for the radius.
14. "+ Adjacent" is the name; added areas are hatched, their chips
    hatched and marked ∗.
15. With + Adjacent on, a new pick brings its neighbours.
16. Area shapes come from e-Stat for both cities.
17. Copy link uses the chain; the trip icon comes later.

Proposed, with numbers above: the slider's stops, 500 m to 3 km.

## Steps, each deployable

1. **Filter pages** (Part 1): the pages, Nearby with its slider and its
   circle on the map, + Adjacent's looks in neutral greys, the Area
   button's icon. Wanted whatever happens to the rest. UI plumbing of a
   few hundred lines; no unknowns.
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
  - `src/config/settings.ts` (the remembered radius)
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

- [x] Filters and Area open in the strip at Half, with the live count and
      an X that closes them, and Clear at the top of the page; each also
      closes by its own button, another footer button or a region change,
      and returns to the card or the list it came from.
- [x] Nearby narrows to the slider's radius around you (1 km at first),
      with the circle on the map, and says so while locating.
- [x] + Adjacent's added areas behave as in the table, and a link
      reproduces them.
- [ ] Every Tokyo and Kyoto area has a shape, reviewed on the phone.
- [x] The Area page shows the whole city, locked, without basemap labels
      or roads, only bookmarks and lodging pinned and inert, and the blue
      dot. The rail lines show from zoom 11, so not on a phone (see "As
      built").
- [x] Areas are outlined, filled or hatched in colours that match their
      chips, readable in light and dark, and toggle when tapped.
- [x] Leaving the Area page puts the camera back where it was.

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
