# Places research: where it stands (2026-11-10)

For whoever resumes curating the places from Jerry's trip list, without
the session that imported them: what landed, how it was researched, what
is still open, and where to start. The workflow itself is
`docs/design/adding-places.md`.

## What landed

**Source.** Jerry's trip list, `japan_trip_master.csv` (361 places;
columns Category, Establishment, What, City, Neighborhood, Info), kept
outside the repo. Its `line` numbers, used here and in the follow-up
list, are file lines: line 1 is the header, line 2 the first place.

**Import** (2026-11-09): 362 new rows from 358 of its lines.

- Lines 35 and 105 were already in drinks (drinks:17, drinks:68).
- Line 300 became two concert rows, line 308 four knife shops.
- Line 196, Hachidaime Gihey, is missing: never researched, and in
  neither the data nor the follow-up list (see "Other open items").

| Layer | Tokyo | Kyoto | Osaka | Nara | Hakone | New | Rows now |
| --- | --- | --- | --- | --- | --- | --- | --- |
| drinks | 22 | 16 | 4 | 1 | | 43 | 117 |
| sweets | 43 | 37 | | 7 | 3 | 90 | 90 |
| food | 73 | 44 | 29 | 10 | 2 | 158 | 158 |
| music | 6 | 5 | 1 | | | 12 | 12 |
| shops | 34 | 13 | 5 | | | 52 | 52 |
| activities | 3 | 3 | 1 | | | 7 | 7 |
| **All** | 181 | 118 | 40 | 18 | 5 | 362 | 436 |

**Commits**, on main and deployed: `bcdd48e` (icons from Jerry's art),
`9c7940e` (the five new layers; Osaka and Nara; Hakone's areas; bigger
Tokyo and Kyoto map boxes), `05b6832` (the rows), `73c4320` (area shapes
rebuilt around them), `53b9301` (docs and the follow-up list).

**Not reviewed.** Jerry waived the findings table (adding-places.md,
step 3) for this batch, so the rows have not had his review. The
follow-up list stands in for it.

## How it was researched

1. **Web research per place**, in 13 batches of 20 to 40 lines, by
   helper agents working from one brief: identity and branch, status,
   official link, Japanese address and ward, hours (plain and OSM
   syntax) and their source, reservation, other branches, a confidence
   (high: official source for identity, address and hours; medium: one
   of them from a third party; low: identity uncertain) and questions.
   The aim was one search and one page fetch per place.
2. **A second pass** for 76 places the first left without an address,
   one search each. 26 got one.
3. **Pins.** Every address went through GSI's geocoder, which says how
   precisely it matched. A place without an address was looked up by
   name on OpenStreetMap within about 1.5 km of a reference station, and
   a match counted only if the OSM object carried the name. Failing
   both, the place sits on the station. As imported: 116 pins at the
   building, 97 at the block, 5 at town level, 83 from OSM, 58 on a
   station, 3 placed by hand.
4. **Areas.** A pin inside an existing area's shape, in the same ward,
   took that area. Otherwise a new raw area was named from the list's
   Neighborhood. GSI's reverse geocoder checked each pin's ward.
5. **Rows**, written by script: Kind, Type and Icon from the list's
   Category and What; Notes from its Info, plus "Update: …" where the
   research contradicted it.

### What worked, what didn't

- **GSI geocoder** (`msearch.gsi.go.jp/address-search/AddressSearch?q=`),
  no key needed. Cut the address after its last block number, since
  buildings and floors confuse it. Kyoto's street-direction addresses
  (〜通〜西入ル) match once reduced to ward, registered town and number.
  Reverse: `mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress`.
- **Nominatim** finds one shop by name near a point. One request a
  second, with the generic user agent the build scripts use, never an
  email. Overpass works too but is slow for a batch: a pass over the
  unlocated places can take over ten minutes.
- **Web search is capped**, at about 200 searches a turn shared by
  every helper running at the time. The first pass ran out partway, so
  some places got page fetches only, and the follow-up list still says
  "search budget exhausted" for them. Plan one search per place:
  Japanese name plus `住所 営業時間`.
- **Tabelog answers fetches with 403.** Its pages still turn up in
  search results with the address and hours quoted. Official sites,
  Michelin Guide and Rurubu pages fetched fine.
- **On Windows, curl mangles Japanese text.** Use Node's `fetch` with
  `encodeURIComponent`. Shell quoting also breaks regexes and Japanese
  in `node -e` one-liners, so put scripts in files.

### Conventions applied

- Blank beats a guess: no facet, hours or coordinates without a source.
- `~` before an address that stops short of the street number.
- The Area follows the address's ward; the build checks it.
- Icon `question` where no art fits.
- Last verified only for hours read from the shop's own site or
  Instagram: 36 of the 362 rows.
- A pin that isn't at the door says so in Notes ("Location approximate:
  pinned near … station until the shop is found", "Pinned at the block,
  not the door").
- A multi-branch brand gets one row: Name is the brand, Branch the shop
  the list said to visit (often the flagship), else the first it named.

## What's open

### The follow-up list

`docs/research/places-followup-2026-11-09.csv`, 215 places, one row
each, sorted by priority, then line. A place whose only gap is
unverified hours isn't in it; that is normal.

| Column | Meaning |
| --- | --- |
| priority | **high** (81): not located, may have closed or moved, or maybe not the shop the list meant. **medium** (123): placed, but the address is approximate, the pin rough, or sources disagree. **low** (11): only the hours are missing. |
| id | `<layer>:<ID>`, the row in `data/<layer>.csv` |
| name | Name (Branch) |
| region, area | As in the row |
| problem | Tags, `;`-separated (below) |
| detail | What the research found, and the question to answer |
| line | The place's line in the trip list |

| Tag | Places | Meaning |
| --- | --- | --- |
| not located: pinned at … station | 56 | No address found; the pin is the station. |
| low-confidence identity | 75 | Maybe not the shop meant; often a branch question. |
| status: unclear, status: moved | 61, 1 | May have closed or moved. |
| approximate address | 137 | A `~` address. |
| rough pin | 7 | A town-level geocode, or placed by hand on a landmark. |
| sources disagree | 30 | Hours, address or details conflict; see detail. |
| no hours | 154 | No hours at all. |

**Working through it.** High first, starting with the region the group
visits first, and within it the "not located" rows, since those pins
are in the wrong spot. For each place, research it as adding-places.md
says, fix the row (its ID never changes), and delete its line from the
follow-up list in the same commit, so the file stays the list of what's
left (four went that way on 2026-11-09). Many details end in a question
for Jerry (which branch, is the spelling right): collect those into one
findings table instead of guessing.

### Other open items

- **Line 196, Hachidaime Gihey** (Kyoto, Gion, by Yasaka Shrine;
  claypot rice): the one place on the list that isn't in the data.
  Research it and add it to `food`, with Type from the layer's list
  (Rice, Donabe rice).
- **Approximate addresses:** 148 rows start Address (JA) with `~`: the
  137 in the follow-up list and 11 older drinks rows.
- **Hours:** of the 362 new rows, 154 have none and 238 have no OSM
  hours, so Open now counts those as unknown. 36 have a Last verified
  date.
- **Links:** 228 of the new rows have none. An official site or
  Instagram is quick to add while working a row anyway.
- **Pins sharing a spot:** 17 spots hold two or more pins, 44 places in
  all. Ten are station fallbacks (29 places, all "not located" above;
  six sit on Kyoto-Kawaramachi station) and separate as addresses turn
  up. Seven are a shared block or building (15 places: Tokyo Station,
  Tokyu Food Show in Shibuya, Kintame and Tenjaku on 牡丹鉾町, the two
  aburi-mochi shops at Imamiya Shrine, among others); door-level
  coordinates from OSM would part them.
- **Ratings:** only drinks has the Google rating columns, and only 43
  of its older rows have a snapshot. None of the new rows do; whether
  the other layers get the columns is open.
- **Icons:** 119 places wait for art under `question` (`,question,` in
  `data/` finds them). Adding art is two steps, listed at the top of
  `src/config/icons.ts` (the file in src/map/icons/, a line in the
  list); then point the rows' Icon at it.

| Group | Places | Types |
| --- | --- | --- |
| Wagashi | 21 | taiyaki 6, warabi mochi 6, mochi 4, wagashi 4, dango 1 |
| Rice dishes | 18 | onigiri, kamameshi, donburi, Fukagawa-meshi, donabe rice |
| Ceramics and crafts | 15 | ceramics, tableware, chopsticks, woodwork, brushes, lacquer, glass |
| Tempura | 13 | tempura, tendon |
| Knives and kitchen tools | 13 | |
| Gyoza | 11 | |
| Unagi | 10 | |
| Okonomiyaki and monjayaki | 7 | |
| Tsukemono | 6 | |
| Donuts | 5 | |

### Open decisions

- **Aoyama – Harajuku:** their shapes touch, but they aren't listed as
  neighbours. Waiting for Jerry (`AWAITING_DECISION` in
  `src/data/area-shapes.test.ts`;
  `docs/proposals/filter-pages-and-area-map.md`, Part 2).
- **Area merges** (reviewed 2026-11-10, deferred by Jerry). With the
  new places, two merges have enough on both sides to split:
  Nihonbashi (7) / Ningyocho (6) and Okazaki (3) / Nanzenji (2, which
  needs neighbours of its own). Ginza (17) / Tsukiji (2) could go either
  way. Keep the ward-line merges (Tokyo Station, Shinjuku with
  Minami-Shinjuku, Meguro with Kamiosaki, Kyoto's Shijo-* halves), the
  ones with a single place on a side, and Yanaka · Nezu · Sendagi
  ("Yanesen"). Splitting follows "Adding an area" in adding-places.md:
  config, `npm run areas`, review on the Area page.
- **Layers and kinds:** the 2026-11-09 split is a first cut from the
  list's categories (`docs/design/regions-layers-filters.md`,
  "Layers"). Food got 17 kinds from Type on 2026-11-10
  (`docs/proposals/food-kinds.md`).
- **Lodging:** its schema is still to come (same doc, "Lodging").

## Scratch data

The research files lived in a session scratchpad that will be deleted:
the per-batch research, the merged research (363 objects), the GSI
geocodes, the OSM matches, each place's pin and area, and the scripts
that turned them into rows. Everything the app uses is in the rows and
the follow-up list.

Kept: `docs/research/places-sources-2026-11-09.csv`, one row per new
place (`id`, `line`, `name`) with its research **confidence**, its
**hours source** (official, tabelog, other, or blank), the **other
branches** of the 50 multi-branch brands, and the **source URLs**,
space-separated (251 of the 362 rows have at least one). Look there
before searching again for a place on the follow-up list.

## How to resume

- The workflow is `docs/design/adding-places.md`: research, a findings
  table Jerry reviews, then the rows ("Adding an area" for a new area).
  The review applies again unless Jerry waives it.
- `npm run ids` prints ID problems and the next free ID per layer.
- `npm run import -- <layer>` round-trips `data/<layer>.csv`, fixing
  quoting and column order.
- `npm run areas` rebuilds the area shapes. Run it whenever a pin moves
  into another area or a row's Area changes: shapes grow around their
  places, so a misfiled place drags a stray piece into its area's
  shape.
- `npm test` and `npm run snapshot` are what Actions runs before it
  deploys.
- A place outside its region's map box fails the tests, and growing a
  box re-downloads every device's maps (adding-places.md, "Pitfalls").

**First step:** research and add Hachidaime Gihey (line 196). Then the
56 "not located" rows, for the region the group visits first.
