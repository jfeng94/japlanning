# M8 Part 2: lines in their colours, and the station for every place

Status: **accepted** (2026-11-10), narrowed: see "Decisions". Part 1 in
progress.

## Decisions (Jerry, 2026-11-10)

- **Lines:** every subway in Tokyo and Kyoto, for now. That's Tokyo
  Metro's 9 lines, Toei's 4, and Kyoto's Karasuma and Tozai. Osaka is
  only a possible day trip, so it isn't worth the effort. JR and the
  private lines keep the basemap's grey rail.
- **No nearest stations on the card** (Part 2 below): judging by eye on
  the map is enough. The old Part 3, stations as pins, becomes Part 2.
- **No station codes** for now.
- **Colours, all confirmed:**
  - Tokyo Metro: Jerry's list. OpenStreetMap agrees except for Chiyoda,
    which it has as `#00A650`; Jerry's `#00BB85` stays.
  - Toei: OpenStreetMap's tags, which match the values in the table.
  - Kyoto: OpenStreetMap's tags, Karasuma `#3CB371` and Tozai `#FF4500`.
    Kyoto City publishes only the colour names, green (緑) and vermilion
    (朱); these match them.

## Why

Jerry: "be able to quickly determine which station and line to hit up
to get somewhere without leaving the webapp."

M8 brought the rail forward, but as one grey. It doesn't tell the Ginza
line from the Hanzomon. Subways reach our tiles only at zoom 15, so at
city zoom the subway network is mostly missing.

The reference is a subway diagram, for its look: thick lines in each
line's own colour, white station markers, line letters. The lines follow
their **real routes**, though, since the map is for walking to a door.

## What it adds

1. **Every line in its colour**, at every zoom, from city view to street
   level. The lines sit above the roads and under our pins.
2. **The nearest stations on each place's card.** For example: "Shibuya
   · 4 min walk", followed by line chips (G, Z, F, JY). Opening a card
   then answers "how do I get there".
3. **Stations as pins.** A white marker on the lines; tapping it opens a
   small station card with:
   - the name in English and Japanese;
   - the lines that stop there, as coloured chips;
   - our places within a short walk, nearest first;
   - Directions.

Part 1 is the backbone. Part 2 is where most of the value is. Part 3
completes the picture. Each can be checked on the phone before the next.

## Where the data comes from

**Our own map tiles.** Their zoom-15 layer holds every rail line's track,
named in Japanese and English, often with its letter code. Decoded over
Shibuya on 2026-11-10, it had:

- "Yamanote Line" (ref JY);
- "Tokyo Metro Hanzomon Line" (Z);
- the Ginza, Chiyoda, Fukutoshin, Den-en-toshi and Inokashira lines.

The tiles have no colours, and station nodes carry names only.

A build step, **`npm run transit`**, much like `npm run areas`, reads
each region's zoom-15 tiles from the maps site:

1. It keeps rail features whose name matches a line in our config, and
   drops yards, sidings and crossovers.
2. It joins each line's pieces and simplifies them to a few metres.
3. It collects the station nodes and merges same-name nodes within
   300 m (Shibuya has four).
4. It assigns each station the configured lines whose track passes
   within about 120 m.

It writes `public/transit/<region>.geojson`, which is committed and
precached for offline use like the area shapes. Expect a few hundred KB
for Tokyo; the build reports the size. The data is OpenStreetMap's, so
the credit we already show covers it. Nothing is queried at runtime.

**Colours and codes: our own table**, `src/config/transit.ts`, one entry
per line: its name as the tiles spell it, the code, the English label,
the colour and where the colour came from. A test fails if a configured
line is missing from the built data. The build also lists named lines
that have no entry, so new ones are noticed.

| Operator | Line | Code | Colour | Source |
| --- | --- | --- | --- | --- |
| Tokyo Metro | Ginza | G | `#FF9500` | Jerry, 2026-11-10 (from Tokyo Metro) |
| | Marunouchi | M | `#F62E36` | 〃 |
| | Hibiya | H | `#B5B5AC` | 〃 |
| | Tozai | T | `#009BBF` | 〃 |
| | Chiyoda | C | `#00BB85` | 〃 |
| | Yurakucho | Y | `#C1A470` | 〃 |
| | Hanzomon | Z | `#8F76D6` | 〃 |
| | Namboku | N | `#00AC9B` | 〃 |
| | Fukutoshin | F | `#9C5E31` | 〃 |
| Toei | Asakusa | A | rose `#E85298` | to confirm on Toei's site |
| | Mita | I | blue `#0079C2` | 〃 |
| | Shinjuku | S | leaf green `#6CBB5A` | 〃 |
| | Oedo | E | magenta `#B6007A` | 〃 |
| JR East and others | see the question below | | | each operator's own page |

## How it looks

- **The lines:** 3 px at city zoom, growing to 6 px at street level, in
  their colours, each with a thin white casing as on the diagram, so
  crossing lines stay distinct.
- **Shared track:** where two lines run in the same corridor (the
  Yamanote and Keihin-Tohoku, say), one would hide the other. A
  per-line pixel offset in the config sets known pairs side by side,
  and anything else overlaps. Tuned by eye.
- **Stations:** white circles with a dark ring, larger where more lines
  stop. Their names are in English, with the Japanese underneath at
  street level. They replace the basemap's own station icons, which go,
  so Shibuya stops appearing four times.
- **The basemap's grey rail** stays underneath for the lines we don't
  colour: freight, and small private lines.
- **The Area page** shows the coloured lines on its quiet map, which
  helps for choosing an area by how you'd get there.
- **Taps:** our pins win; a tap that misses every pin but lands on a
  station opens the station.

## The nearest stations on a place's card (Part 2)

Up to two stations within 1.2 km (about 15 minutes' walk), nearest
first:

> **Shibuya** 渋谷 · 4 min · [G] [Z] [F] [JY] [DT] [IN]
> **Shinsen** 神泉 · 9 min · [IN]

A station with several entrances or platforms is still one row.

The walking time comes from straight-line distance, with the same
allowance the Nearby slider uses. That isn't routing, and the text
doesn't claim it is. Tapping a station row opens that station.

## Files

```
scripts/build-transit.ts        the build: tiles → lines and stations per region
package.json                    npm run transit
src/config/transit.ts           lines: tile name → code, label, colour, offset, source
public/transit/<region>.geojson built, committed
src/data/transit.ts (+ test)    load; nearest stations to a point; lines at a station
src/map/transit-layers.ts       the line, casing, station and label layers
src/map/style.ts                drop the basemap's station icons
src/ui/detail.ts                Part 2: the stations row
src/ui/station-card.ts          Part 3: the station card
src/ui/app.ts                   wiring: load per region, taps, the card
src/sw.js / precache            the transit files
docs: this file; m8-atlas-styling.md; CLAUDE.md
```

Roughly two to three days: Part 1 about a day with the tuning, Part 2
half a day, Part 3 one to two.

## Questions for Jerry

1. **Which lines beyond the subways?** Recommended: every subway (Tokyo,
   Kyoto's Karasuma and Tozai, Osaka Metro), then the JR lines in the
   cities (Yamanote, Chuo, Keihin-Tohoku, Saikyo, the Osaka Loop, JR
   Nara), then the private lines our places depend on:
   - Tokyo: Keio Inokashira (Kichijoji), Odakyu (Shimokitazawa), Tokyu
     Toyoko (Nakameguro and Daikanyama), Yurikamome;
   - Kyoto: Keihan, Hankyu, Randen (Arashiyama), Eizan;
   - Nara and Uji: Kintetsu, Keihan Uji.

   That's about 50 lines, each needing its colour from its operator.
2. **Station codes** (G-09) aren't in the tiles. Show lines only for
   now, or bring codes in from OpenStreetMap's route data? The latter
   means a second, query-based step; its servers were down when tried on
   2026-11-10.
3. **Order:** Part 1, check on the phone, then Parts 2 and 3? Or Parts 1
   and 2 together, since Part 2 is where the answer to "how do I get
   there" lives?

## Results: Part 1, the lines (2026-11-10)

Built, with a Lines toggle Jerry asked for while it was under way.

- **`npm run transit`** (`scripts/build-transit.ts`) reads each region's
  zoom-15 tiles from the local archive in about a second, and writes:
  - Tokyo: 13 lines and 185 stations in 179 KB;
  - Kyoto: 2 lines and 31 stations in 19 KB.

  Both files are committed and cached for offline use like the area
  shapes.
- **The stations are exact.** A first version guessed which lines stop
  at a station from how close their track runs, and was about 95% right.
  It put the Keisei-Ueno, the Mukohara tram stop and Keio's Shinsen-
  Shinjuku on our lines, and dropped Morishita from the Oedo.
  - **Each line's real stop list** from OpenStreetMap replaced the
    guess: a station counts for a line when its name is on the line's
    list and it lies within 300 m of the line's own track.
  - **Through-running stops** stay off our lines: the Hanzomon's trains
    run on to Sangenjaya as the Den-en-toshi line, which doesn't make
    Sangenjaya a Hanzomon station.
  - **Counts that match the operators':** Ginza 19, Marunouchi 28,
    Asakusa 20, Hanzomon 14, Karasuma 15, Kyoto Tozai 17. The Oedo has 37
    of its 38, since Hikarigaoka is outside the map box.
  - **The stop lists** are cached in `.cache/transit/stops.json`, so the
    Overpass servers (often busy: they answered on the third try) are
    needed only with `--refresh`.
- **On the map** (`src/map/transit-layers.ts`):
  - each line in its colour over a thin casing, white on the light map
    and near-black on the dark;
  - white station dots with a dark ring, from zoom 11;
  - everything under our pins and above the area shapes, on the Area
    page too.

  In Tokyo and Kyoto the basemap's station names stay, but without its
  train icon, so the dot is the only marker.
- **The Lines button** (`src/ui/lines-control.ts`) sits under fit and
  locate. Its panel lists the region's lines, each a chip with the
  line's letter on a badge in its colour:
  - a tap hides or shows that line, and its stations when no line
    through them is left;
  - All and None at the foot;
  - the choice is kept on the device (`localStorage`, as a convenience)
    and survives a reload;
  - the button hides in a region without lines.
- **Checked in the pane** at phone width:
  - Tokyo at zooms 12 to 14, light and dark;
  - Kyoto;
  - the panel, showing only the Ginza and Oedo lines, then a reload
    that kept that choice.
- **Not yet:** shared-corridor offsets. No pair of lines hid another
  badly enough to need one.

**Next, Part 2: stations as pins**, each with its own card (the old
Part 3).
