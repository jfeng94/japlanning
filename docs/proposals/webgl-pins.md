# Pins drawn by the map, with Jerry's art

Status: **done** (2026-11-10). Part 1: the map layer is the default
after Jerry found it "way smoother" on the iPhone. Part 2 (declutter):
not needed, Jerry decided, with the speed-up. Part 3 (retire SDF): done.

## Why

Tokyo now has 242 pins, and the map pans and zooms in chunks on the
phone (Jerry, 2026-11-10).

Each pin is a MapLibre `Marker`: an HTML element the map moves on every
frame. MapLibre moves all of them, on screen or not, and the browser
restyles every one each time. On the same 80 small pans and zooms over
Tokyo (desktop Chrome, median main-thread time per frame, with pins
minus without):

| Pins | Extra time per frame |
| --- | --- |
| DOM markers, today | about 6 ms, at zoom 12 and at zoom 14 |
| A WebGL symbol layer with the same art | about 0.3 ms |

Zooming in doesn't help the DOM pins: at zoom 14 about 40 are on
screen, and all 242 still move. Removing the CSS drop-shadow filters,
the labels and the `:has()` rule saved about 1 ms between them. That
is only the main thread: on the iPhone each pin is also its own
composited layer, with a filter, which a desktop measurement doesn't
show. A frame has 16.7 ms at 60 Hz, 8.3 at 120.

M3 kept the SDF renderer "in case hundreds of markers prove heavy". They
do, but an SDF stores only a shape's outline and fills it with one
colour, which is why those pins look flat. MapLibre draws ordinary
full-colour images just as cheaply: that's this proposal.

## Goal

Pins the GPU draws that look like today's bare pins: Jerry's full-colour
art with its shadow, the badge (bookmark, unknown hours, closed, key
branch), and the name from zoom 14. The selected pin stays an HTML
element, so it keeps its glow and its scale-up.

## Done when

- [x] `?pins=raster` (and Settings → Pin renderer → Map layer) draws
      every pin with its art, shadow and badge. Crisp on the iPhone:
      to check.
- [x] A tap selects the pin nearest it, with a little slack; a tap on
      empty map deselects. On the Area page pins ignore taps: the same
      switch as the DOM pins', not tried in the pane.
- [x] The selected pin is today's HTML pin, on top, and its map copy and
      label hide.
- [x] Names show from the label zoom, drawn by the map; where names would
      collide, some hide instead of piling up.
- [x] Region switches and badges (closed, key branch) work as with DOM
      pins; filters and bookmarks go through the same `update`. Theme
      switch: the same reload path as a region switch, checked that way,
      since the pane can't fire the real theme change.
- [x] `?fps=1` shows the frame rate while the map moves, so the two
      renderers can be compared on the phone.
- [x] On the iPhone, panning and zooming Tokyo is smooth with the map
      layer, and Jerry accepts its look. Then it becomes the default
      (2026-11-10).

## Design

### The pin images

For each icon and badge pair in use, the renderer draws one image on a
canvas at the device's pixel ratio, 3 on the iPhone, so a 30 px pin is
90 px and stays sharp. It holds:

- the art, inset by the reach of its shadow;
- the badge in the upper right, as on today's pins;
- the shadow, baked in, the same as today's CSS
  `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))`.

Then `map.addImage(key, pixels, { pixelRatio })`.

**The badge is in the image, not a second layer.** A second layer draws
all badges after all icons, so where pins overlap, one pin's badge would
sit on its neighbour's art. One image per pair keeps each pin whole.

**Drawn on demand.** A pin's image is named `<icon>|<mark>`. When the map
meets a name it doesn't have, it fires `styleimagemissing`, and the
renderer draws that pair then. MapLibre only uses an image added inside
that handler, so the renderer decodes the art and badge files first,
once, when it starts, and draws synchronously in the handler. Only
pairs in use get drawn: at most 26 icons × 5 (no badge, four badges),
usually a few dozen (30 for Tokyo), about 58 kB of GPU memory each at 3×
(120 px square: the 90 px pin plus room for the badge and the shadow). Every pin with that
pair then shares the one image.

**Cached.** A theme switch loads a new style, which drops every image.
The decoded art and the drawn pixels are kept in memory for the session,
so the images go straight back in. Nothing is stored on the device; the
next launch draws them again.

**Cheap enough to draw in the app.** Measured in the pane (desktop
Chrome): 57 pairs (19 icons, each bare and with two badges) in 11 ms,
0.2 ms each, on a canvas kept in main memory (`willReadFrequently`). On
the default GPU canvas, reading the pixels back for MapLibre took 2.8 ms
each, 320 ms in all, so the flag matters. The iPhone will be a few times
slower: tens of milliseconds per launch, spread over the first frames.
The renderer reuses one small `OffscreenCanvas` with the flag, as
MapLibre does for its own images. Safari honours the flag from iOS 18;
an older iPhone ignores it and is slower at launch, never wrong.

**Not at build time.** Pre-drawing every pair into a sprite sheet during
the build would save those milliseconds, and the images would be files
to look at. But any icon can carry any badge on any phone (bookmarks are
per device, "closed" follows the clock), so all 130 pairs would ship and
load. MapLibre's sprite files come in 1× and 2× only, while the iPhone is
3×. And the build would need a native image library to draw them.
Revisit only if the phone shows a hitch at launch.

### Layers

- One GeoJSON source keyed by place id (`promoteId: "id"`), and one
  symbol layer of pins. As with DOM pins, every pin is drawn: overlap is
  allowed and pins don't push each other aside. A sort key draws
  bookmarked and key-branch pins on top.
- Names are a second symbol layer from the label zoom, anchored under
  each pin: Noto Sans Medium at 11.5 px with a halo in the background colour (as
  today's text shadow), wrapped at about 11 rem. Names that would
  collide hide (MapLibre's label placement), so busy streets show fewer
  names until you zoom in. Today's HTML names pile up instead.
- The pin layers stay above every layer the app adds: the Area page's
  shapes and labels go in beneath them. The blue location dot is an HTML
  marker and stays on top.
- The names use the Noto Sans glyphs the app ships (U+0000 to U+03FF),
  with the phone's own font for Japanese. A character outside both, a
  curly apostrophe say, would draw as nothing. All 436 names are fine
  today; a test keeps it that way.

### The selected pin

One HTML pin, built by the same code as today's DOM pins (`.dom-pin`),
so its glow, scale-up, badge and label are unchanged, placed at the
selected place. Its map copy and its map label hide through feature
state (`icon-opacity` and `text-opacity` 0), a paint change that costs
nothing. Selecting another place moves the one element. If filtering
removes the selected place, the element goes too.

### Taps

On a map click, look for pins in a box around the tap, about 12 px wider
than an icon on each side, and pick the one nearest the tap. None means
empty map. Nearest beats topmost for a finger on a crowded street. The
Area page makes the pins inert, as now. On a desktop, the pointer
changes over a pin.

### Data changes

Filters, bookmarks and region changes call `update`, which replaces the
source's data: a few milliseconds in MapLibre's worker for a few hundred
points. Selection only touches feature state and the one HTML pin.

### Settings, and comparing on the phone

`pinRenderer` gains `raster`, shown as "Map layer", beside DOM and SDF,
and `?pins=raster` works as the other values do. DOM stays the default
until the phone comparison. Then the map layer becomes the default and
DOM stays as the fallback.

`?fps=1` adds a small readout: frames per second, and the slowest frame,
while the map moves. It costs nothing when off.

## Part 2 (optional): declutter

*Declined 2026-11-10: with the map layer the overview is smooth enough
that every pin can stay drawn.*

After Part 1 is on the phone, if the overview still reads as a pile:

- Every place also gets a small dot in its layer colour, in a circle
  layer under the art, always drawn.
- Below a zoom (14 to start), the art takes turns: the map draws art in
  sort-key order (bookmarked, key branches, then the rest) and skips any
  that would overlap art already drawn, leaving its dot. Zooming in
  brings the art back.
- Tapping a dot selects its place.

To decide on the phone: whether it reads better, the zoom, and whether
art fading in and out while zooming feels busy. The fade time can be
tuned.

## Part 3: retire SDF

*Done 2026-11-10: the renderer, `sdf.ts` and its test, the 26
silhouettes and `scripts/pin-silhouettes.py` are gone; the artwork moved
from `src/map/icons/dom/` to `src/map/icons/`, one file per icon; the
Pin renderer setting offers Map layer and DOM markers. A saved "SDF
symbols" choice is no longer valid and falls back to the default.*

Once the map layer is the default, delete the SDF renderer, its distance
transform and the silhouettes (`src/map/icons/sdf/`,
`scripts/pin-silhouettes.py`). An icon becomes one file and one line in
`src/config/icons.ts`, so new art no longer needs a silhouette made.

## Files (Part 1)

```
docs/proposals/webgl-pins.md     this
src/map/pin-art.ts, .test.ts     new: draws an (icon, badge) pin image at a pixel ratio; layout maths tested
src/map/pins-raster.ts           new: the renderer: source, layers, images on demand, taps, the selected pin
src/map/pins-dom.ts              the pin element factored out, for the selected pin
src/map/pins.ts, pins.test.ts    sort key; nearest-pin hit test
src/map/area-layers.ts           area layers go in beneath the pins
src/config/settings.ts           pinRenderer: "raster"
src/ui/settings-sheet.ts         the option and its help text
src/ui/app.ts                    creates the raster renderer
src/ui/fps-meter.ts              new: ?fps=1
src/data/parse.test.ts           names only use characters the map can draw
```

## Order of work

1. `pin-art`, with tests; images checked in the pane at 1×, 2× and 3×.
2. The renderer: layers, images on demand, taps, the selected HTML pin.
   Checked in the pane against DOM pins: light and dark, names, badges,
   the Area page, a theme switch.
3. The fps meter; this proposal's measurement run again.
4. Deploy behind `?pins=raster`; Jerry compares on the phone.
5. Make it the default; update the docs (m3-map.md's renderer decision,
   the Settings help).

## Out of scope

- **Clustering** into numbered bubbles: it hides places, which is wrong
  for a hand-picked list.
- **Our own WebGL drawing code**: MapLibre's symbol layer already draws
  every pin in one batch.
- **Animating the map copy** of the selected pin: the HTML pin does that.

## Open questions

- **Disc style** (`pinstyle=disc`: the art on a white disc ringed in the
  layer colour). Easy to draw per (icon, colour) as well; worth keeping
  for the map layer, or bare only?
- **Label font.** The map's Noto Sans, not the iPhone's system font: close,
  not identical. HTML names would bring the cost back.
- **Part 2.** Declutter at all, or is every pin always drawn the point?

## Diff size

Part 1: about 500 lines, a third of them tests. Part 3 removes about 440
lines (the SDF renderer, the distance transform and its test, the
silhouette script) and 26 silhouettes.

## Measurement method (2026-11-10)

The preview build in Claude's browser pane, Tokyo with no filters (242
pins), a 1024 × 716 map at pixel ratio 1. Each run makes 80 camera moves
near Tokyo Station (pans of up to about 1 km, zoom steps of up to 0.04)
at zoom 12 and again at 14, and times, per move,
`jumpTo`, a synchronous map render and a forced style and layout pass,
then takes the median. DOM: the app's map with its markers, minus the
same run with the markers taken out of the page. Map layer: a second
map with one symbol layer of the same 242 pins, drawn from the same art
at 3× with the shadow baked in, minus the same map without the layer.
The pane was hidden, so a 16 ms timer stood in for animation frames.
The iPhone wasn't measured; the fps meter is for that.

## Results (Part 1, 2026-11-10)

Built as proposed, in `src/map/pins-raster.ts` with the images from
`src/map/pin-art.ts`. Checked in the pane with Tokyo's 242 pins: 30
images drawn on demand at zoom 12, 189 pins on screen; a tap 11 px off
a pin selects it; a tap on empty map deselects; the selected HTML pin
sits exactly on its place with its map copy hidden; region switches
re-add the pins on top with the theme's label colours.

**Measured in the app** (same page, same view at zoom 12 with the
basemap loaded, 60 small pans, median main-thread time per frame):

| Renderer | With pins | Without | The pins' cost |
| --- | --- | --- | --- |
| Map layer | 2.2–2.5 ms | 2.0 ms | about 0.3 ms |
| DOM markers | 4.6–4.8 ms | 2.9 ms | about 1.8 ms |

Smaller than the first estimate (6 ms for DOM, from a bare test map),
but still four to six times less, and only the main thread: the iPhone
also composites each DOM pin as its own layer. The fps meter on the
phone is the real test.

**Found and fixed on the way:**
- **The selected pin never grew.** `.dom-pin.is-selected` scaled with
  `transform: scale(1.3)`, which MapLibre's inline `transform` (the
  marker's position) overrides, and the separate `scale` property would
  scale that position too. The selected pin's box is now 1.3 times the
  size instead; MapLibre centres a marker on its own size. This shows
  with DOM pins too.
- **Dead CSS that could have hurt.** `.dom-pin` had `transition:
  transform 0.12s`, overridden by MapLibre's marker rule. Had it won,
  every pin would have trailed the map. Removed. The `:has()` rule for
  the selected marker's z-index never matched (the pin is the marker);
  now a plain class rule.
- **A renderer chosen in Settings mid-session drew nothing** until the
  next theme or region change. `onStyleLoad` ran late callbacks only if
  `map.isStyleLoaded()`, which also waits for every tile. It now uses
  its own "the current style has loaded" flag. The SDF renderer had the
  same problem.

**Choices made while building:**
- Names don't push the basemap's own labels (stations, streets) aside
  (`text-ignore-placement`): only pin names make room for each other.
- The badge's halo is in the theme's background colour, as on the HTML
  pins, so the images are redrawn once per theme; both sets are kept.
- **For the phone comparison, use Settings, not the URL.** The app
  rewrites the address bar on the first tap, dropping `?pins=raster`
  (and `?fps=1`) from it; they hold until a reload. The Settings choice
  is saved on the device.

**Default** (2026-11-10): Jerry found the map layer "way smoother" on the
iPhone, so it is the default; a choice saved in Settings still wins. On
the way, the art now loads by the image's load event rather than
`decode()` (which waits for the page to render, so it hung in a hidden
tab), and a file that fails to load falls back to the `?` art instead of
leaving the whole map without pins.
