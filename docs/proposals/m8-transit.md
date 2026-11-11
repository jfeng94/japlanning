# M8 Part 2: lines in their colours, and the station for every place

Status: **accepted** (2026-11-10), narrowed: see "Decisions". Part 1
done. Station pins wired, with Toei's first and last trains and arrows
along a line (2026-11-10); Tokyo Metro waits on the ODPT token, then
amenities and Kyoto. Pick-up note: `docs/research/stations-odpt-state.md`.

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
- **The Area page** hides the lines, the stations and the Lines button
  (Jerry, 2026-11-10: "quite busy"). The first plan showed them there,
  for choosing an area by how you'd get there.
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

**The basemap's rail and stations go** where we draw our own (Jerry,
2026-11-10, after seeing it). In Tokyo and Kyoto the style leaves out
Protomaps' rail lines and station labels (`OWN_TRANSIT_REPLACES` in
`src/map/style.ts`):

- **Rail:** the JR and private lines' grey goes with them, so only the
  subway lines show.
- **Station names are ours:** blue beside the dot from zoom 12, with the
  Japanese underneath from zoom 15. Interchanges win where names
  collide. A hidden line's stations lose their names along with their
  dots.
- **Aliases in brackets:** the build writes OpenStreetMap's quoted
  aliases the way the signs do, as "Meiji-jingumae (Harajuku)".
- **Osaka, Nara and Hakone,** which have no lines of ours, keep the
  basemap's rail and station names.

**Basemap text above the lines** (Jerry, 2026-11-10: street and
district names were hidden under them). The layers now draw in this
order:

1. the lines and station dots, just under the basemap's first text
   layer;
2. the basemap's text (street and district names);
3. our station names;
4. the pins.

The area shapes now draw over the lines, tinting them where an area is
filled. On the Area page our station names hide, so the area names stay
the page's only text, as designed. (Since 2026-11-10 the lines and
stations hide there altogether.)

**Next, Part 2: stations as pins**, each with its own card (the old
Part 3).

## Part 2, revised: stations for planning (2026-11-10, pins done; facts to come)

Jerry: no nearby places on the station card. It holds the facts for
planning, such as when the trains run and what the station has.
Stations also stay out of search: they aren't places, and nothing adds
them to the list or the search.

**The card**, opened by tapping a station's dot or name:

- **The name** in English and Japanese.
- **Each line that stops there,** as a chip in its colour with its
  letter, and with its station code (G-09) where one is known.
- **First and last trains** per line and direction, on weekdays and on
  weekends and holidays.
- **Amenities that matter to a visitor:** elevators (suitcases), coin
  lockers, toilets including accessible ones, and escalators.
- **Directions** to the station.

**Taps** follow the place rule: the first opens the card without moving
the map, and a second centres on the station. Pins win where they
overlap a station. On the Area page, stations can't be tapped, since
taps pick areas there. The station goes in the link, as places do.

**Where the facts come from:**

| Operator | Train times and codes | Amenities |
| --- | --- | --- |
| Tokyo Metro (9 lines) | ODPT, the national public-transport open-data centre: station timetables (first and last trains derived from them) and station codes. Its own basic licence, with attribution | ODPT's station facilities (barrier-free), checked against tokyometro.jp's station pages, which also list coin lockers |
| Toei (4 lines) | ODPT, CC BY 4.0 | kotsu.metro.tokyo.jp's station pages (elevators, escalators, accessible toilets) |
| Kyoto City Subway (2 lines) | Not in ODPT (only Kyoto's buses are). By hand from the city's pages, 31 stations | By hand, the same pages |

ODPT needs a free developer account, which gives an access token. Jerry
registers (Claude can't create accounts) and puts the token in an
environment variable. A build step (`npm run stations`) then fetches the
data once, keeps only the summary above, and bakes it into
`public/transit/<region>.geojson`; the app makes no live calls.
Timetables change with each operator's timetable revision, so the step
is rerun before the trip.

**If ODPT is too much,** a lighter fallback: each line's service hours
("first trains about 5:00, last about 0:15"), entered by hand from the
operators' pages, with no per-station amenities. That's 15 lines, about
an hour.

**Answered (Jerry, 2026-11-10):**

1. **ODPT.** Jerry registered; the token is pending (up to two business
   days).
2. **Amenities:** elevators, coin lockers, toilets (and accessible
   ones) and escalators.

### Results: the pins (2026-11-10)

Jerry: "wire up the pins and then we can fill the missing info later."
Done, with the facts still to fill:

- **Ids.** Each station in the built file has an `id`,
  `<region>:<Japanese name>` (`tokyo:渋谷`), stable across rebuilds; a
  second station of the same name in a region would get `~2`. A
  selection is that id behind `station:`, so `s=station:tokyo:渋谷` in
  the URL opens the card, and a reload keeps it. A test checks the ids
  are unique and find their station again.
- **Taps.** A tap that misses every pin asks the transit layers for the
  nearest station dot or name within 12 px (`stationAt`). Pins win
  where they overlap. The Area page skips the lookup, so taps there
  still pick areas. First tap opens the card without moving the map;
  the second centres on the station, as for places.
- **The card** (`src/ui/station-card.ts`): the station's marker and
  name in English and Japanese in the header, with Directions (to the
  station's coordinates) and the panel chevron. The body has "Subway
  station · n lines", Show on map, one row per line (its badge and
  name, with room for that line's first and last trains), and a note
  that train times and amenities aren't in yet. No bookmark, and
  Prev/Next are disabled: stations aren't in the list.
- **The open station** gets a larger dot ringed in the label blue.
- **Stations stay out of search and the list:** they are never places.
- **A station link from another region** switches to that region
  first; the id names it.

### The facts: plan (2026-11-10, proposed)

**What ODPT serves without a token** (checked 2026-11-10): Toei's
stations, railways and station timetables, on `api-public.odpt.org`.
Every Toei station has a timetable per direction and day type
(weekday; Saturday and holiday), with the first and last trains marked,
and a station code (E-27). The timetables are current: Mita from March
2026, Asakusa from December 2025, Oedo and Shinjuku from March 2025.
Toei's facilities aren't there (404). Tokyo Metro's data comes back
empty without the token.

**Built in two passes:**

1. **Now, before the token:** the build step, the data file and the
   card, with Toei's train times as the first data.
2. **When the token arrives:** Tokyo Metro's times from `api.odpt.org`
   (`ODPT_TOKEN` in the environment, never in the repo), and its
   facilities from ODPT. Then Toei's facilities and Kyoto's times and
   facilities by hand, from the operators' station pages.

**`npm run stations`** fetches once into `.cache/stations/` (`--refresh`
to refetch), matches ODPT's stations to ours by line and Japanese name,
and fails on a station of ours it can't match. It writes
`public/transit/<region>.stations.json`, keyed by our station id. That
file is separate from the geojson, so rerunning `npm run transit` after
a map change needs no token and keeps the facts. It is committed and
precached, like the geojson.

Per station and line:

- the station code;
- each direction, named by where it goes ("to Motoyawata");
- weekday and Saturday/holiday first and last trains;
- where the last train stops when that's short of the end. Shinjuku's
  last eastbound train runs only to Iwamotocho, so the card says "last
  0:10 to Iwamotocho".

Per station, the four amenities, each yes, no or unknown.

**The card:** each line's row gains its station code and a small table
under it, one line per direction:

```
[S] Shinjuku Line  S-01
    to Motoyawata     first 5:00 · last 0:10 (to Iwamotocho)
    Sat & hol         first 5:00 · last 0:10 (to Iwamotocho)
```

A row of amenities follows. A station without facts yet keeps today's
note.

**What the licence asks** (ODPT's basic licence, Tokyo Metro's data;
Toei's is CC BY 4.0):

- **A credit and a disclaimer** at the foot of the card: "Train times:
  Public Transportation Open Data Center, as of <date>. ODPT and the
  operators aren't responsible for their accuracy."
- **A contact for questions about the app**, kept away from the
  operators: in Settings, the repo's issues page.
- **A summary only.** First and last trains can't rebuild a timetable;
  the licence forbids republishing data that could.
- **Kept current.** Rerun the step before the trip, as for the maps.

**Station codes** come free with the data. "No codes for now" was about
drawing them on the map, so the card shows them.

**Files:** `scripts/build-stations.ts` (new), `package.json`
(`npm run stations`), `src/data/transit.ts` (+ test: types, the loader,
and every Toei station of ours has times), `src/ui/station-card.ts`,
`src/ui/app.ts` (load the file with the geojson),
`src/ui/settings-sheet.ts` (the contact), `src/style.css`, `CLAUDE.md`,
`docs/design/adding-places.md` (rerun before the trip).

### Results: Toei's times and the arrows (2026-11-10)

**`npm run stations`** (`scripts/build-stations.ts`) built as planned:
per-railway queries, cached in `.cache/stations/`. Every Toei station of
ours (89) has its code and first and last trains. Tokyo Metro's lines
are skipped without `ODPT_TOKEN`; Kyoto has order only.

**Directions:**
- **Plain lines** are named by the line's end, as station signs do
  ("to Motoyawata").
- **The Oedo's loop** has no end to name. Each direction is named by
  where most of its trains go ("to Hikarigaoka"), or failing that by the
  next station ("via Azabu-juban").
- **A short last train** is noted with where it stops ("0:10 to
  Iwamotocho").
- **Weekdays and weekends** get one row when their times agree.

**The arrows** (Jerry, 2026-11-10: "page through to the next sequential
station on the line"):
- **One line at a time.** The card outlines the row of the line they
  follow; tapping another row switches.
- **Through interchanges,** stepping keeps the line.
- **From the map,** a tapped station starts on its first line.
- **Next steps away from station 01** (`first` in the config).
- **Where the order comes from:**
  - **ODPT's railways** where we have them, with a branch oriented to
    end at its junction.
  - **The Oedo's loop:** its repeated first station, Tochomae, becomes
    a closing link, so the loop goes round and on along the tail.
  - **Elsewhere,** OpenStreetMap's stop list, split where it jumps more
    than 4 km. Until the token, the Marunouchi's Honancho branch is a
    run of its own, not joined to Nakano-sakaue.
- The arrows grey out at the ends, and their labels name the station
  they go to.

**Two data fixes in the transit build**, found by matching to ODPT:
- **Shared track.** The tiles name the Meguro–Shirokane-takanawa track
  for the Namboku only, so the Mita stopped at Shirokane-takanawa. A
  line's config can now claim another's track inside a box (`shares`).
  The Mita gains Meguro and Shirokanedai, and the shared stretch is
  drawn dashed over the Namboku.
- **A renamed platform.** OpenStreetMap names the Shinjuku Line's
  platforms 新線新宿 (the Keio New Line's name). The build renames them
  to 新宿 (`RENAMED`), which merges them into Shinjuku with the
  Marunouchi and Oedo, as the signs and ODPT have it. The station id
  `tokyo:新線新宿` is gone.

**The licence:** the card's foot credits Toei (CC BY 4.0) via ODPT, with
the timetable's date and ODPT's disclaimer. Settings and the README give
the repo's issues page as the app's contact.

**Which line, at a glance** (Jerry, 2026-11-10):
- **On the card,** the first line reads "Subway station" and each
  line's badge (no line count). The badge of the line the arrows follow
  sits on a light box tinted in its colour, on a one-line station too,
  where it can't be turned off.
- **Switching:** tapping another badge switches line; so does tapping a
  line's row, which no longer carries a highlight of its own.
- **On the map,** the open station's ring takes the colour of the line
  being followed, so stepping shows which line it is.

**Deferred and decided** (Jerry, 2026-11-10):
- **ODPT's guideline items wait until Tokyo Metro's data is used:** the
  fetch date on the card and the contact address.
- **Toei's colours stay ours;** they're from Toei's site. ODPT's
  Railway data lists other values
  (`docs/research/stations-odpt-state.md`).
