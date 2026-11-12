# Stations and ODPT: where it stands (2026-11-12)

For whoever picks up the station work next. It covers what's live, how
to rerun the data, what ODPT's rules ask of us, and what comes next. The
decisions and results are in `docs/proposals/m8-transit.md`, from "Part
2, revised" on.

## What's live

- **Station cards.** Tapping a subway station on the map opens a card
  with:
  - its name in English and Japanese;
  - a row for each line that stops there;
  - Directions.
- **Times on every Tokyo line.** Toei's 4 lines (since 2026-11-10) and
  Tokyo Metro's 9 (since 2026-11-12) show, at every station of ours:
  - its station code, in one style ("G-02", "Mb-05" on the Marunouchi
    branch);
  - the first and last trains each way, for weekdays and for weekends
    and holidays;
  - a credit naming each operator, its licence, the timetable's date
    and the day it was fetched, with ODPT's disclaimer.
- **The arrows** step to the next station along one line.
  - The card's header shows a badge per line before the English name.
    The followed line's badge sits on a box tinted in its colour, on a
    one-line station too, and the whole header takes the same tint. A
    small line under the name gives the Japanese name, 門前仲町.
  - Tapping another badge, or another line's row, switches, and shows
    that line if the Lines button hid it. A station opened from the map
    starts on its first shown line.
  - On the map, the station's ring takes that line's colour.
  - The Marunouchi's Honancho branch joins the main line at
    Nakano-sakaue.
- **Kyoto** has arrows but no times. ODPT has no Kyoto subway data.
- **Amenities** (elevators, coin lockers, toilets including accessible
  ones, escalators; Jerry's set) aren't started anywhere. The data shape
  exists (`amenities` in `StationFacts`, src/data/transit.ts). The card
  only says they aren't in yet.

## How it's built

`npm run stations` (`scripts/build-stations.ts`) writes
`public/transit/<region>.stations.json`, which is committed and
precached. It holds:

- **`order`:** each line's stations in order, for the arrows;
- **`stations`:** per station and line, the code and the first and last
  trains;
- **`sources`:** the credit, with each operator's fetch date.

It reads `public/transit/<region>.geojson`, so it runs after
`npm run transit`.

- **ODPT is queried per railway** (`odpt.Railway:Toei.Oedo`) for
  Railway, Station and StationTimetable. Responses are cached in
  `.cache/stations/` (gitignored), and `--refresh` refetches. The fetch
  date is the oldest cache file's date, in Tokyo time.
- **The operators** are listed in `OPERATORS` in the script:
  - Toei: `api-public.odpt.org`, no token;
  - Tokyo Metro: `api.odpt.org` with `acl:consumerKey`, from the
    `ODPT_TOKEN` environment variable. Without it and without a cache,
    Metro is skipped with a note, and the tests fail (every Tokyo line
    must have times).
- **Lines link to ODPT** through `odpt` in `src/config/transit.ts`: the
  main railway first, then a branch.
- **Our stations are matched to ODPT's** by Japanese name
  (`normaliseStation`: drops 〈aliases〉, (notes) and 駅, folds ヶ/ケ and
  麴/麹) on each line. The build fails on any of ours it can't match,
  listing them. Fixes so far:
  - a spelling to fold in `normaliseStation` (麴町);
  - a platform OpenStreetMap names for another railway, in `RENAMED` in
    `scripts/build-transit.ts` (新線新宿 is 新宿), then rerun
    `npm run transit`;
  - shared track the tiles name for one line only, in `shares` in the
    config (the Mita to Meguro, the Fukutoshin to Hikawadai), then rerun
    `npm run transit`.

## Rerunning with the token

**The token lives only in Jerry's user environment.** It never goes in
the repo, a file, the chat or a printed URL; the script never prints a
request URL, so keep it that way in any new logging. If it ever leaks,
Jerry issues a new one on ODPT's developer site.

- **Jerry sets or replaces it** himself:
  ```powershell
  [Environment]::SetEnvironmentVariable("ODPT_TOKEN", "<token>", "User")
  ```
- **A shell started before that** doesn't see it. Rather than restart
  the Claude app, read it into the one command:
  ```powershell
  $env:ODPT_TOKEN = [Environment]::GetEnvironmentVariable("ODPT_TOKEN", "User"); npm run stations -- --refresh
  ```
  To check it's there without printing it:
  `[bool][Environment]::GetEnvironmentVariable("ODPT_TOKEN", "User")`.
- **When to refresh:**
  - within a week of ODPT e-mailing that a timetable changed (below);
  - before the trip, regardless;
  - a plain `npm run stations` (no `--refresh`) reads the cache and
    needs no token.
- **Then** run the tests, commit `public/transit/*.stations.json`, push,
  and watch the deploy whose commit is the one pushed.

## ODPT's rules for Tokyo Metro's data

Tokyo Metro's data is under ODPT's Basic License and Developer Guideline
(read 2026-11-10 on developer.odpt.org/terms). Toei's is CC BY 4.0, so
these bind only Metro, but the app does them for both.

- **Credit ODPT and say accuracy isn't guaranteed.** Done: the card's
  foot, Settings and the README.
- **Show when the data was fetched** (guideline 2.2.1). Done
  2026-11-12: "fetched 12 Nov 2026" in the card's credit, per operator.
- **Refresh within a week** of ODPT announcing an update (2.2.2). ODPT
  emails registered developers; rerun with `--refresh` and deploy.
- **A contact e-mail address for the app** (3.1(3)), so questions don't
  reach the operators. Done 2026-11-12: Jerry's email, in Settings and
  the README.
- **No republishing anything a timetable could be rebuilt from**
  (licence 8.4). First and last trains are a small summary; keep it that
  way. No full timetables in the repo or the app.
- **Don't alter the operators' line colours** (guideline 4). Checked
  2026-11-12: ODPT's `odpt:color` for every Metro line matches ours.
- **Credit wording:** "Tokyo Metro, ODPT Basic License".

## Decided

- **The contact address** (Jerry, 2026-11-12): his email.
- **Toei's colours: keep ours** (Jerry, 2026-11-10: they're from Toei's
  site). ODPT's Railway data gives different ones, for the record; the
  guideline's colour rule doesn't bind Toei's CC BY data anyway.

  | Line | Ours | ODPT |
  | --- | --- | --- |
  | Asakusa | `#E85298` | `#FF535F` |
  | Mita | `#0079C2` | `#0067B0` |
  | Shinjuku | `#6CBB5A` | `#9FB01C` |
  | Oedo | `#B6007A` | `#CF3366` |

## Next: amenities and Kyoto

- **Tokyo Metro amenities.** ODPT's `odpt:StationFacility` (token only)
  should list barrier-free facilities: elevators, escalators, toilets
  and accessible toilets. Check the real shape when it's fetched.
  - Coin lockers aren't in ODPT; tokyometro.jp's station pages list
    them.
- **Toei amenities.** `StationFacility` isn't public for Toei (404 on
  api-public). Its station pages on kotsu.metro.tokyo.jp list elevators,
  escalators and accessible toilets; lockers are to be checked.
- **Kyoto.** Times and amenities by hand from Kyoto City Subway's
  station pages: 31 stations, 2 lines.
- **The card** needs an amenities row: the four, each yes, no or
  unknown. Design it with Jerry.

## Testing tips (the hidden browser pane)

- **Old cached files.** The local preview's service worker serves the
  last precached transit files. Unregister it and clear Cache Storage
  after rebuilding.
- **Blank map in a hidden pane.** Shim `requestAnimationFrame` with
  `setTimeout` right after navigating; if the style still doesn't load,
  navigate again. The station cards work without the map: open one by
  URL, `/?r=tokyo&s=station:tokyo:新宿`.
- **Screenshots are scaled** (800×600 for a 1024×768 page). Convert
  before clicking by coordinate, or fire `map.fire("click", {point,
  lngLat, originalEvent})`.
