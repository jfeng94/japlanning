# Stations and ODPT: where it stands (2026-11-10)

For whoever picks up the station work once Jerry's ODPT token arrives,
which he expected to take a few days. It covers what's live, what to do
with the token, and what ODPT's rules still ask of us. The decisions
and results are in `docs/proposals/m8-transit.md`, from "Part 2,
revised" on.

## What's live

- **Station cards.** Tapping a subway station on the map opens a card
  with:
  - its name in English and Japanese;
  - a row for each line that stops there;
  - Directions.
- **Toei's times.** Every Toei station (89 of them, on the Asakusa, Mita,
  Shinjuku and Oedo) shows:
  - its station code;
  - the first and last trains each way, for weekdays and for weekends
    and holidays;
  - a credit naming Toei, CC BY 4.0 and ODPT, with ODPT's disclaimer.
- **The arrows** step to the next station along one line.
  - The card's header shows a badge per line before the English name.
    The followed line's badge sits on a box tinted in its colour, on a
    one-line station too, and the whole header takes the same tint. A
    small line under the name gives the Japanese name, 門前仲町.
  - Tapping another badge, or another line's row, switches.
  - On the map, the station's ring takes that line's colour.
- **Tokyo Metro's lines** (9) say "Train times not in yet". Their arrows
  use OpenStreetMap's station order.
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
- **`sources`:** the credit.

It reads `public/transit/<region>.geojson`, so it runs after
`npm run transit`.

- **ODPT is queried per railway** (`odpt.Railway:Toei.Oedo`) for
  Railway, Station and StationTimetable. Responses are cached in
  `.cache/stations/` (gitignored), and `--refresh` refetches.
- **The operators** are listed in `OPERATORS` in the script:
  - Toei: `api-public.odpt.org`, no token;
  - Tokyo Metro: `api.odpt.org` with `acl:consumerKey`, from the
    `ODPT_TOKEN` environment variable. Without it, Metro is skipped with
    a note, not an error.
- **Lines link to ODPT** through `odpt` in `src/config/transit.ts`: the
  main railway first, then a branch. Marunouchi already lists
  `TokyoMetro.MarunouchiBranch`.
- **Our stations are matched to ODPT's** by Japanese name
  (`normaliseStation`) on each line. The build fails on any of ours it
  can't match, listing them.

## When the token arrives

1. **Jerry sets the token** (never in the repo, a file or the chat):
   ```powershell
   [Environment]::SetEnvironmentVariable("ODPT_TOKEN", "<token>", "User")
   ```
   Then he restarts the Claude app so its shells see it. To check without
   printing it: `node -e "console.log(!!process.env.ODPT_TOKEN)"`.
2. **Run `npm run stations`.** Toei comes from the cache. Metro is fetched
   once per railway (10 railways) and cached.
   - Each line should print "N stations … N with times", and the "no
     ODPT data" notes should be gone.
   - The script never prints a request URL, since the URL carries the
     token. Keep it that way in any new logging.
3. **Fix what it reports.** Likely:
   - **Name mismatches.** Our names come from OpenStreetMap; ODPT uses
     the operator's.
     - `normaliseStation` already drops 〈aliases〉, (notes) and 駅, and
       folds ヶ/ケ.
     - A platform OpenStreetMap names for another railway goes in
       `RENAMED` in `scripts/build-transit.ts`. That's how 新線新宿
       became 新宿. Then rerun `npm run transit`.
     - Station ids are made from names, so a rename changes an id.
   - **Shared track** the tiles name for one line only. That's how the
     Mita got Meguro and Shirokanedai (`shares` in the config). Suspects
     on Metro:
     - Yurakucho/Fukutoshin, Wakoshi to Kotake-mukaihara (mostly outside
       our box);
     - Namboku/Mita, already handled.
   - **The Marunouchi branch.** With ODPT it should join the main line:
     Honancho → Nakano-fujimicho → Nakano-shimbashi → Nakano-sakaue. The
     build turns a branch around so it ends at its junction.
4. **Meet the guideline** (below) before shipping Metro's times. Jerry
   deferred it to this point ("defer until we actually use ODPT",
   2026-11-10).
5. **Tests** (src/data/transit.test.ts):
   - Widen "Toei's stations (public in ODPT)" to every ODPT line: every
     station has a code and times.
   - Add arrow cases: Nakano-sakaue's previous station is Shin-nakano
     (main line); Nakano-shimbashi's next is Nakano-sakaue.
   - Keep the per-line station counts.
6. **Check in the browser.**
   - Shinjuku: the Marunouchi row now has times.
   - Omotesando: three lines, each with times.
   - The Marunouchi branch arrows.
   - A through-running line's last train (Hanzomon, Hibiya). A
     destination off our railway shouldn't get a "to …" note.
7. **Commit `public/transit/*.stations.json`** with the docs, push, and
   watch the deploy whose commit is the one pushed.

## ODPT's rules for Tokyo Metro's data

Tokyo Metro's data is under ODPT's Basic License and Developer Guideline
(read 2026-11-10 on developer.odpt.org/terms). Toei's is CC BY 4.0, so
these bind only Metro, but doing them for both is simpler.

- **Credit ODPT and say accuracy isn't guaranteed.** Done: the card's
  foot and Settings.
- **Show when the data was fetched** (guideline 2.2.1). The card shows
  the date the timetable took effect, not when we fetched it.
  - The build should record each source's fetch date in `sources` (when
    the cache file was written), and the credit should show it.
  - Not done yet.
- **Refresh within a week** of ODPT announcing an update (2.2.2). ODPT
  emails registered developers; rerun `npm run stations -- --refresh` and
  deploy. Also rerun before the trip regardless.
- **A contact e-mail address for the app** (3.1(3)), so questions don't
  reach the operators. Settings and the README point to the repo's
  issues page, which Jerry agreed to for Toei. The guideline's example
  is an e-mail address. **Jerry decides:** a dedicated address, or the
  issues page as is.
- **No republishing anything a timetable could be rebuilt from**
  (licence 8.4). First and last trains are a small summary; keep it that
  way. No full timetables in the repo or the app.
- **Don't alter the operators' line colours** (guideline 4). Our Metro
  colours are Tokyo Metro's own (Jerry's list). Compare them with
  ODPT's `odpt:color` when the Railway data arrives.
- **Credit wording.** The Metro entry in `OPERATORS` reads "Tokyo Metro,
  the Public Transportation Open Data Basic License" in the credit.
  Shorten it to "ODPT Basic License" when it first shows.

## Decided, and open

- **The contact address** (above): open, for when Metro's data ships.
- **Toei's colours: keep ours** (Jerry, 2026-11-10: they're from Toei's
  site). ODPT's Railway data gives different ones, for the record; the
  guideline's colour rule doesn't bind Toei's CC BY data anyway.

  | Line | Ours | ODPT |
  | --- | --- | --- |
  | Asakusa | `#E85298` | `#FF535F` |
  | Mita | `#0079C2` | `#0067B0` |
  | Shinjuku | `#6CBB5A` | `#9FB01C` |
  | Oedo | `#B6007A` | `#CF3366` |

## After Metro: amenities and Kyoto

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
  navigate again.
- **Screenshots are scaled** (800×600 for a 1024×768 page). Convert
  before clicking by coordinate, or fire `map.fire("click", {point,
  lngLat, originalEvent})`.
