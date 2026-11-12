# Station amenities: elevators, escalators, toilets, lockers

Status: **proposed** (2026-11-12). Waiting on Jerry's three answers
under "Decisions"; nothing is built yet.

## Why

The station card has first and last trains on every Tokyo line. The
other half of Jerry's list (2026-11-10) is the station itself:
elevators (suitcases), escalators, toilets including accessible ones,
and coin lockers. Today the card says "The station's amenities aren't
in yet."

## What the sources turned out to be

The plan assumed ODPT's `odpt:StationFacility`. **It doesn't exist in
ODPT's current API.** It answers "There is no rdf:type :
StationFacility" with Jerry's token, and ODPT's catalog lists no
facility dataset for Tokyo Metro (fares, stations, timetables and train
data only). It came from Tokyo Metro's retired API. So each amenity
needs its own source:

| What | Toei (84 of our stations) | Tokyo Metro (127) |
| --- | --- | --- |
| Elevators, escalators | **Open data**: the Bureau of Transportation's "barrier-free facilities" table per line, CSV, CC BY, updated Jan 2024. Street ↔ gates and gates ↔ platform, per station. The build can download it. | **Tokyo Metro's website only**: a "barrier-free facilities" page per line, with every station's elevators, escalators and stair lifts, each with where it runs ("gates to exit B3") and any hours. |
| Toilets | The same CSV: an accessible toilet at all 84; no location. | The same pages: accessible, baby-changing and ostomate toilets, inside or outside the gates, and where. |
| Coin lockers | **Behind a "prove you're human" check** on Toei's site, which Claude won't click through. | **Metro Commerce's list** (the company that runs them): one page, every station, counts per price (¥300 to ¥1,600), as of 1 Nov 2026. 103 of our 127 stations have lockers, at least 85 with ¥1,000 and up. The build can download it. |

OpenStreetMap was the open fallback for Tokyo Metro, but it's too
patchy: of six Metro stations sampled, four had no elevators mapped.

## Decisions (Jerry)

1. **Tokyo Metro's elevators, escalators and toilets.** Its site's
   terms say everything on it is copyrighted, and use beyond private
   use or quotation needs Tokyo Metro's permission. Its server also
   turns away scripts, so the build can't fetch it; Claude would read
   the 9 line pages in the browser pane, as a person would.
   - **(a) Summarise the facts (recommended).** Our own short summary
     (which lines' platforms have an elevator, which exits, which toilet
     types and whether inside the gates), not their text or maps,
     credited with a link and its date. Facts as such aren't copyright,
     and this is a personal, non-commercial app; the terms' wording is
     broad, so this is a judgement call.
   - **(b) Ask Tokyo Metro first.** A short email to its contact form;
     an answer may not come before the trip.
   - **(c) Link out only.** Metro stations get a "Elevators and toilets
     on Tokyo Metro's site ↗" link to the station's page; only Toei's
     open data is shown on the card.
2. **Toei's lockers.** Either Jerry opens Toei's store and locker list
   (kotsu.metro.tokyo.jp → 関連事業 → 店舗・コインロッカー等) and saves
   the page for Claude to read, or Toei stations show no locker row
   for now (recommended: skip for now; Toei stations are fewer and
   Metro's list covers the big hubs it shares with Toei).
3. **How much detail.** One line per amenity, as below (recommended),
   or the full list of each elevator's route and hours.

## The card

A section after the lines and before the credit, one row per amenity,
each row only when something is known:

```
At the station
Elevators   To the street: exits B3, A2 (7:00 to last train)
            To the platforms: every line
Escalators  To the street and to the platforms
Toilets     Accessible, baby, ostomate · outside the gates, by B4
Lockers     59, 8 of them ¥1,000 and up
```

- **Elevators** come first, as the suitcase question: "to the street"
  (gates ↔ street, with Metro's exits) and "to the platforms" (gates ↔
  platform, per line). Where a line lacks one, the row says so ("not on
  the Ginza platform"); Toei's Takanawadai and Sengakuji have none
  between gates and platform.
- **Escalators** say only which stretches have them.
- **Toilets** give the types and, for Metro, inside or outside the
  gates, which decides whether you pay a fare to use them.
- **Lockers** give a count and how many are the larger (¥1,000 and up)
  sizes. Metro Commerce's list covers its own lockers only, so a
  station may have more.
- **Unknown** stays silent: no row, rather than a guess. A station
  with nothing known keeps today's note.
- **The credit** gains one line per source and date, e.g. "Facilities:
  Toei (CC BY 4.0, Jan 2024); Tokyo Metro's site (Nov 2026); lockers:
  Metro Commerce (1 Nov 2026)."

## How it's built

- **`npm run stations`** gains the amenities, so one file still holds
  each station's facts (`public/transit/<region>.stations.json`):
  - **Toei's CSVs** are downloaded into `.cache/stations/` (Shift-JIS,
    one per line), matched by the station code in each row ("（E-01）
    新宿西口").
  - **Metro Commerce's list** is downloaded and read the same way,
    matched by name (it writes 麴町 too).
  - **Tokyo Metro's pages** (if 1a): a committed snapshot,
    `data/transit/tokyometro-facilities.json`, made by a small extractor
    (`scripts/extract-metro-facilities.js`) that Claude runs on each of
    the 9 line pages in the browser pane. Rerun by hand before the trip.
- **The data shape** replaces today's `Amenities` (five yes/no flags)
  with what the card needs: street and platform elevators (with exits
  and hours), escalators, toilet types and whether inside the gates,
  and lockers (count and large), each with its source.
- **A station on several lines** merges them: the elevator to the
  platforms is per line, the rest is the union.
- **Tests**: every Toei station of ours matched in its CSV, every Metro
  locker row matched, and a few fixed stations (Omotesando, Takanawadai,
  Shinjuku).
- **Kyoto** stays out of this: by hand from Kyoto City Subway's pages
  later (31 stations).

## Files

- `scripts/build-stations.ts`, `src/data/transit.ts` (+ tests)
- `scripts/extract-metro-facilities.js` and
  `data/transit/tokyometro-facilities.json` (if 1a)
- `src/ui/station-card.ts`, `src/style.css`
- `CLAUDE.md`, `docs/research/stations-odpt-state.md`,
  `docs/proposals/m8-transit.md`

About a day's work with 1a, less with 1c.

## Sources (read 2026-11-12)

- ODPT API v4, `odpt:StationFacility` (404) and ODPT's dataset catalog
  for Tokyo Metro.
- [Toei barrier-free facilities, Tokyo open data catalog](https://catalog.data.metro.tokyo.lg.jp/dataset/t000018d0000000028),
  CC BY; the CSVs at `opendata.metro.tokyo.lg.jp/kotsu/subway_barrierfree_<line>.csv`
  (`shinjyuku` for the Shinjuku Line).
- [Tokyo Metro, barrier-free facilities by line](https://www.tokyometro.jp/safety/barrierfree/progress/)
  and its [terms of use](https://www.tokyometro.jp/terms/index.html).
- [Metro Commerce, coin locker locations](https://www.metocan.co.jp/locker/),
  as of 1 Nov 2026.
- [Toei, stores and coin lockers](https://www.kotsu.metro.tokyo.jp/other/kanren/stores/location_map.html)
  (behind a bot check).
