# Adding places

Status: **agreed** (2026-11-05; "Adding an area" 2026-11-09). The
workflow for turning a name on a list into a row in `data/<layer>.csv`.
Jerry supplies candidates, Claude researches and writes; nothing is
written before Jerry has seen the findings.

## 1. Intake

Jerry gives names with whatever hints he has: an area, a kind, "multiple
locations", a friend's note. Claude normalises them into a candidate
list (given name, hint, guessed region and kind) and repeats it back only
if something is ambiguous enough to stop the research.

## 2. Research, per candidate

- **Identity.** The official site or Instagram, and which shop exactly.
  For a brand with several branches the hint decides; without a hint,
  list the branches in the findings and ask. Name = the brand, Branch =
  the shop, as in the column conventions.
- **Position.** Coordinates from the official address, cross-checked on
  OpenStreetMap or Google Maps, and inside the region's bounding box.
  The Japanese address from the official source; a `~` prefix when only
  the area is known.
- **Area.** The raw area the place is in, as a visitor would name it,
  following the address; the ward in the address must be the area's
  (the build checks). A place in a new area brings a new raw area: see
  "Adding an area" below.
- **Hours.** Human-readable plus OSM syntax. `Last verified` is today
  only when the hours were read from the official source; hours from a
  third party go in without a date, so the card badges them
  "unverified". The cell holds times and days only: no source ("per
  Tabelog"), no doubt ("verify", "sources differ"), no tips (a cover
  charge goes in Notes). When sources disagree, the cell takes the best
  one and the follow-up list records the rest.
- **Kind** always: it is required, and it files the place under its
  category chip. Food has no Kind column: its Type gives the kind
  (`FOOD_KINDS` in `src/config/layers.ts`), so Type is required there,
  and a new type goes into one of those groups first.
- **Facets.** Format, Food, Linger, Reservation, Specialty only when a
  source supports them; blank otherwise. Blank beats a guess: a wrong
  value misleads on the card and in search.
- **Notes.** Two or three sentences in English, written as a friend's
  recommendation (2026-11-10, `docs/proposals/content-pass.md`): what
  it is, why go, what to order, practical tips (card only, queues, how
  to book, a cover charge, a short walking direction). Definitive and
  present tense. Never hours, addresses, sources, research dates,
  "Update:", doubt or where the pin is: hours and addresses have their
  own cells and badges, and open questions go to the follow-up list
  (`docs/research/`) or the findings. A test fails on research wording
  in a note or an Hours cell. Nothing private, ever.
- **History** (2026-11-12), for cultural sites: shrines, temples,
  castles, historic gardens and districts, and old shops whose story is
  the draw. Three or four sentences in its own `History` column, meant
  to make someone want to go: who founded or built it and when, what
  happened to it, and one thing you can still see there that the story
  explains (the 1589 gate, the donor names on the torii). Dates belong
  here, unlike in Notes; tips, hours and prices stay in Notes. Every fact
  comes from a source, the place's own history page (由緒, 沿革) first,
  and the findings show the draft for Jerry's review. Blank for
  everywhere else. The card shows it as a "History" section at full
  height, first after the essentials; search matches it, and the same
  test keeps research wording out of it.
- **Events** (2026-11-12): dated happenings around the trip that are
  worth planning for, in its own `Events` column: a market, a festival,
  an exhibition's last day, an illumination, a part of the place closed
  on certain days. Each starts with its date ("Dec 21: …", "To Dec 6:
  …"). Regular hours and closing days stay in Hours; this is for what's
  special. The card shows it as an "Events" section after History.
  Refresh it in the pass before the trip ("Before the trip" in
  `auditing-places.md`), since events go stale.
- **Icon** by Kind (coffee, tea, bar) unless Jerry wants a special one.
- **Key** only when Jerry says so, or the brand itself calls a branch
  its flagship.

Sources, in order of trust: the official site, the official Instagram,
Google Maps or Tabelog listings, travel write-ups. Coordinates and hours
are never inferred; if no source gives them, the cell stays blank and the
findings say so.

## 3. Findings (the gate)

One table, one row per candidate: name and branch, region and
area, coordinates, hours and whether verified, the facets found,
a one-line note, the History draft for a cultural site, source links, a confidence (high: official source for
identity, position and hours; medium: one of those from a third party;
low: identity uncertain), and open questions. Below it: anything the
config lacks (a new Specialty value, a region bounding box), since those
go in the same commit, and new areas in a table of their own ("Adding an
area").

Claude stops here. Jerry answers the questions, drops candidates, or
corrects facts. Nothing is written until he says go.

## 4. Write

- Append the rows to `data/<layer>.csv` with the next free IDs
  (`npm run ids`), in ID order; config additions in the same change.
- `npm test` and `npm run snapshot` green; `npm run import -- <layer>`
  round-trips the file to normalise quoting.
- One commit per batch, naming the places: "Data: add 5 tea shops
  (Ginza, Shibuya, Asakusa, Kyoto)". Push; Actions deploys.
- Report: the ids, the live link, and what was left blank and why.

## Adding an area (2026-11-09)

An area is config plus a generated shape: the raw area in
`src/config/regions.ts`, and its outline in
`public/areas/<region>.geojson`, built from census blocks by
`npm run areas` (docs/proposals/filter-pages-and-area-map.md, Part 2).
The rows, the config and the rebuilt shapes land in one commit: the
build rejects an Area the config doesn't know, and the tests reject a
config the shapes don't match.

### Decide, in the findings

New areas get a table of their own below the places, one row each:

| Decide | |
| --- | --- |
| **Label** | The name a visitor would use, unique among the region's chips. It travels in share links (`a=`), so pick one to keep. |
| **Ward** | As the addresses write it: 豊島区, 宇治市. The build checks every row against it. |
| **Section** | The heading it sits under on the Area page, which sets its colour. A new ward joins a section, or starts one with its own `hue`. |
| **Neighbours** | The areas a visitor would walk to next, listed both ways. + Adjacent follows them. |
| **Merge** | Its own chip, or folded into an existing one (`areaGroups`). |
| **Map box** | Every place inside the region's `bbox`, or the box grows (Pitfalls). |

With a long list, this table comes first and is settled in one round
before any row is written, so the shapes are built and reviewed once,
not once per area.

### Build

1. **Config.** The area in the region's `areas` (label, ward,
   `adjacent`); its name in each neighbour's `adjacent`; the merge, if
   any; for a new ward, its section in `areaSections`.
2. **A new ward** also needs its e-Stat code in `WARD_CODES`
   (`scripts/build-areas.ts`), the five-digit municipality code: 豊島区
   is 13116. `npm run areas` stops and names a ward without one.
3. **The rows**, as in "Write".
4. **`npm run areas`.** Downloads a new ward's census blocks once
   (cached in `.cache/estat`), rebuilds every shape in the region, and
   reports each area's blocks, shapes that touch without being
   neighbours, and neighbours whose shapes are apart.
5. **`npm test`.** It checks:
   - one shape per chip, holding every one of its places (or within
     100 m of each), and no two shapes overlapping;
   - shapes that touch are listed as neighbours;
   - every ward is in a section, and no two sections share a hue;
   - every place is inside its region's map box.

   Actions runs the same tests before it deploys.
6. **Review on the Area page,** the new shape and its neighbours'. Each
   block goes to the nearest area centre within 700 m in its own ward,
   so a new area takes blocks from the areas around it.

A wrong shape is corrected by the area's `shape` in config, then
`npm run areas` again:
- `centre`: measure from this point instead of the places' average;
- `reachM`: a reach other than 700 m;
- `include`, `exclude`: census blocks by their e-Stat name (神宮前四丁目).

### Pitfalls

- **The map box is the offline map.** A region's `bbox` is the extent
  of its basemap extract (`scripts/build-basemap.ts`, which Actions runs
  on deploy). A place outside it has no map around it offline, and Here
  can't resolve there. Growing the box makes every device's download
  bigger, and GitHub Pages caps a file at 100 MB. Tokyo's box reaches
  Kichijoji and Kamata but stops short of Akabane and Shibamata.
  Changing a box also means a new extract and publishing the maps
  first ("Changing a map box", below), and every device downloads all
  its maps again.
- **Colours move.** A section's shades go to its busiest chips first,
  so a new chip can change its siblings' shades. Past seven chips in a
  section, shades repeat; neighbours still differ where they can.
  Shibuya already has seven.
- **Renames break links.** Renaming or merging an area later breaks the
  area part of links already shared.
- **A region's first area** (Hakone, one day) turns its Area button on.
  It needs its census code (箱根町 is 14382) and a `bbox`.

## Changing a map box (2026-11-10)

A region's `bbox` in `src/config/regions.ts`, the `build` pin or the
`maxzoom` in `src/config/basemap.ts` decide its offline map. The maps
live on their own site, published from this repo by
`jfeng94/japlanning-maps` (`docs/proposals/maps-site.md`), so a change
takes two steps, in order:

1. **Commit the change, with `build` set to a current Protomaps build**
   (they keep about a week; `npm run maps` names the newest when the pin
   is gone). Every region is extracted again, since the build is shared.
   Push: the app's deploy will fail at `npm run check-maps`, which is
   expected, since the maps site doesn't have the new maps yet.
2. **Publish the maps, then deploy the app again:**
   `gh workflow run maps.yml -R jfeng94/japlanning-maps -f ref=<that commit>`,
   wait for it to finish, then re-run the failed deploy (or push the next
   commit). `check-maps` passes, and phones see "update available" for
   their maps.
3. **Rebuild the subway lines** from the new maps: `npm run maps` to get
   them locally, then `npm run transit` and `npm run stations`, and
   commit `public/transit/`. The lines and stations come from the maps'
   zoom-15 tiles (`docs/proposals/m8-transit.md`), so a new box or build
   can add or move them; `npm run stations` matches them to ODPT's again
   and fails on one it can't place. Tests pin the station counts of a
   few lines; a change there is a prompt to look, not necessarily a
   fault. `npm run stations` reads Tokyo Metro from its cache; a
   `--refresh` or a fresh clone needs `ODPT_TOKEN`
   (`docs/research/stations-odpt-state.md`).

**Before the trip**, run `npm run stations -- --refresh` and commit:
timetables change with each operator's revision, and ODPT's licence asks
that the app keep up.

Never the other way round: an app that expects maps the site doesn't
have would let phones store the old maps under the new label. The phone
checks the site's version file before downloading, and `check-maps`
stops such an app from shipping.

## Rules that do not bend

- IDs are never reused, even for a deleted row.
- A row is never written from memory; every fact has a source in the
  findings.
- An area lands whole: its config, its rows and its rebuilt shapes in
  one commit.
- A region needs its bounding box before its first pins are considered
  done, so the map has a basemap there (a follow-up, not a blocker: pins
  render on a plain background until then).
