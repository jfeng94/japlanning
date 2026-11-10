# Places: where it stands (2026-11-10)

For whoever picks up the places work without the sessions that did it:
where it stopped, what landed, how it was researched, what's open, and
how to resume. Three docs hold the workflows:

- `docs/design/adding-places.md`: new places.
- `docs/design/auditing-places.md`: scrubbing the places we have.
- `docs/proposals/content-pass.md`: the rules for notes, hours and
  addresses.

## Where we left off

**Done on 2026-11-10**, after the import below:

- **Food got 17 kinds** (Ramen, Katsu, Donburi…), worked out from each
  place's Type (`docs/proposals/food-kinds.md`). The Filters page shows
  only the kinds a city has places for.
- **Content pass, Parts 1 and 2** (`docs/proposals/content-pass.md`):
  - **The card:** hours not read from the shop's own site carry an
    "unverified" badge on the Hours row.
  - **The notes:** 223 were rewritten as a friend's recommendation, in
    the voice Jerry approved on a ten-note sample
    (`notes-sample-2026-11-10.md`).
  - **The hours:** 112 places lost their research wording; where a note
    held the only hours, they moved into the Hours cells.
  - **What the notes used to say** went into the audit queue:
    disagreements between sources, open questions, where a pin really
    is.
  - **A data test** now fails on research wording in a note or an Hours
    cell.
- **The audit is codified** (`docs/design/auditing-places.md`):
  - what "scrubbed" means;
  - `npm run audit`, the scorecard;
  - audit passes, where Claude settles a region's places from evidence;
  - `/audit` (`.claude/skills/audit/`), which works through what needs
    Jerry one place at a time.

  The follow-up list became the living `audit-queue.csv`, and the
  questions for Jerry `audit-decisions.md`.
- **The trip order is set:** Tokyo, then Nara and Uji on one day trip,
  then the rest of Kyoto. Osaka and Hakone come last until they're
  placed in the itinerary.

**The scorecard** on 2026-11-10 (`npm run audit`). "Ready" means the
only gap left is unverified hours, and includes the scrubbed places:

| Stop | Places | Scrubbed | Ready | Questions for Jerry | Not located | Approximate address | No hours |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tokyo | 242 | 45 | 76 | 15 | 24 | 84 | 94 |
| Nara | 18 | 3 | 9 | 3 | 0 | 1 | 1 |
| Uji | 8 | 2 | 2 | 1 | 0 | 0 | 2 |
| Kyoto | 123 | 11 | 41 | 10 | 26 | 49 | 38 |
| Osaka | 40 | 4 | 15 | 1 | 7 | 14 | 15 |
| Hakone | 5 | 0 | 1 | 0 | 0 | 0 | 0 |
| **All** | 436 | 65 | 144 | 30 | 57 | 148 | 150 |

**Next**, in Jerry's order:

1. **The Tokyo audit pass.** Jerry deferred it to "later". Claude
   researches Tokyo's 166 not-ready places in batches and applies what
   the evidence settles, as the doc's table says. It adds what needs
   Jerry to the decisions file. Expect several turns: searches run about
   200 a turn.
2. **The 30 decisions**, with `/audit`. 15 are in Tokyo, from Apollon's
   Gold, Bar Libre and Tonkatsu Nanaido down. Answering them first
   would save the pass researching places that get dropped.
3. **Then** Nara and Uji, then Kyoto, the same way.

## What landed

**Source.** Jerry's trip list, `japan_trip_master.csv` (361 places;
columns Category, Establishment, What, City, Neighborhood, Info), kept
outside the repo. Its `line` numbers, used here and in the audit queue,
are file lines: line 1 is the header, line 2 the first place.

**Import** (2026-11-09): 362 new rows from 358 of its lines.

- Lines 35 and 105 were already in drinks (drinks:17, drinks:68).
- Line 300 became two concert rows, and line 308 four knife shops.
- Line 196, Hachidaime Gihey, is missing. It was never researched, and
  it's in neither the data nor the queue ("Other open items").

| Layer | Tokyo | Kyoto | Osaka | Nara | Hakone | New | Rows now |
| --- | --- | --- | --- | --- | --- | --- | --- |
| drinks | 22 | 16 | 4 | 1 | | 43 | 117 |
| sweets | 43 | 37 | | 7 | 3 | 90 | 90 |
| food | 73 | 44 | 29 | 10 | 2 | 158 | 158 |
| music | 6 | 5 | 1 | | | 12 | 12 |
| shops | 34 | 13 | 5 | | | 52 | 52 |
| activities | 3 | 3 | 1 | | | 7 | 7 |
| **All** | 181 | 118 | 40 | 18 | 5 | 362 | 436 |

**Commits**, on main and deployed:

- `bcdd48e`: icons from Jerry's art;
- `9c7940e`: the five new layers; Osaka and Nara; Hakone's areas; bigger
  Tokyo and Kyoto map boxes;
- `05b6832`: the rows;
- `73c4320`: area shapes rebuilt around them;
- `53b9301`: docs and the follow-up list;
- `0ee5570` to `7191d74`: the notes rewrite, one commit per layer;
- `32a9392` and `71596e3`: the audit workflow and the trip order.

**Not reviewed.** Jerry waived the findings table (adding-places.md,
step 3) for this batch, so the rows haven't had his review. The audit
queue and the decisions file stand in for it.

## How it was researched

1. **Web research per place**, in 13 batches of 20 to 40 lines, by
   helper agents working from one brief:
   - identity and branch, and status;
   - official link, Japanese address and ward;
   - hours (plain and OSM syntax) and their source;
   - reservation, and other branches;
   - a confidence: high when an official source gave identity, address
     and hours; medium when one of them came from a third party; low
     when the identity was uncertain;
   - questions.

   The aim was one search and one page fetch per place.
2. **A second pass** for the 76 places the first left without an
   address, one search each. 26 got one.
3. **Pins.** Every address went through GSI's geocoder, which says how
   precisely it matched. A place without an address was looked up by
   name on OpenStreetMap, within about 1.5 km of a reference station; a
   match counted only if the OSM object carried the name. Failing both,
   the place sits on the station. As imported:
   - 116 pins at the building, 97 at the block, 5 at town level;
   - 83 from OpenStreetMap;
   - 58 on a station;
   - 3 placed by hand.
4. **Areas.** A pin inside an existing area's shape, in the same ward,
   took that area. Otherwise a new raw area was named from the list's
   Neighborhood. GSI's reverse geocoder checked each pin's ward.
5. **Rows**, written by script: Kind, Type and Icon from the list's
   Category and What. The notes came from its Info, at first with the
   research appended. The 2026-11-10 rewrite moved that research into
   the queue.

### What worked, what didn't

- **GSI geocoder** (`msearch.gsi.go.jp/address-search/AddressSearch?q=`),
  no key needed. Cut the address after its last block number, since
  buildings and floors confuse it. Kyoto's street-direction addresses
  (〜通〜西入ル) match once reduced to ward, registered town and number.
  Reverse: `mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress`.
- **Nominatim** finds one shop by name near a point: one request a
  second, with the generic user agent the build scripts use, never an
  email. Overpass works too but is slow for a batch: a pass over the
  unlocated places can take over ten minutes.
- **Web search is capped**, at about 200 searches a turn shared by
  every helper running at the time. The first pass ran out partway, so
  some places got page fetches only. Plan one search per place: the
  Japanese name plus `住所 営業時間`.
- **Tabelog answers fetches with 403.** Its pages still turn up in
  search results with the address and hours quoted. Official sites,
  Michelin Guide and Rurubu pages fetched fine.
- **On Windows, curl mangles Japanese text.** Use Node's `fetch` with
  `encodeURIComponent`.
- **Write scripts to files with the editor, not through the shell.**
  Japanese and regexes break in `node -e` one-liners and heredocs. On
  2026-11-10 a heredoc's `\b` reached the file as a backspace
  character.
- **Rewriting with helper agents worked** (the notes, 2026-11-10). Each
  wrote proposed changes to a JSON file and never touched the data. A
  script then checked them: ids, banned wording, opening_hours syntax,
  and every number or superlative absent from the old text. Then it
  applied them and the import normalised the files.

### Conventions

- Blank beats a guess: no facet, hours or coordinates without a source.
- A `~` before an address that stops short of the street number.
- The Area follows the address's ward; the build checks it.
- Icon `question` where no art fits.
- Last verified only for hours read from the shop's own site or
  Instagram.
- **Notes are a friend's recommendation.** No hours, sources, research
  dates, doubt or pin locations; they go in the cells, the badges, the
  queue or the decisions file. The data test enforces it.
- A multi-branch brand gets one row: Name is the brand, and Branch the
  shop the list said to visit (often the flagship), else the first it
  named.

## What's open

### The audit queue and the decisions

**`docs/research/audit-queue.csv`** has 272 places, one row each, sorted
by priority, then line:

- 83 high: not located, maybe closed or moved, or maybe not the shop
  meant;
- 159 medium: approximate, conflicting or rough;
- 30 low: only the hours, or a detail.

A place whose only gap is unverified hours isn't in it.

| Column | Meaning |
| --- | --- |
| priority | high, medium, low (above) |
| id | `<layer>:<ID>`, the row in `data/<layer>.csv` |
| name | Name (Branch) |
| region, area | As in the row |
| problem | Tags, `;`-separated (below) |
| detail | What the research found, and what's left to check |
| line | The place's line in the trip list |

| Tag | Places | Meaning |
| --- | --- | --- |
| approximate address | 138 | A `~` address. |
| no hours | 133 | No hours at all. |
| low-confidence identity | 75 | Maybe not the shop meant; often a branch question. |
| sources disagree | 68 | Hours, address or details conflict; see the detail. |
| status: unclear, status: moved | 63, 1 | May have closed or moved. |
| not located: pinned at … station | 57 | No address found; the pin is the station. |
| rough pin | 10 | A town- or block-level geocode, or placed by hand. |
| (others) | about 30 | One-offs from the rewrite: stale hours, an unconfirmed detail, a possible duplicate. |

The one-off tags are free text. Normalise them to the table's tags as
places are audited. Some "rough pin: fixed …" tags describe a fix
already made, and can go once checked.

**`docs/research/audit-decisions.md`** holds 30 questions for Jerry,
each with options. Some places nobody could find (Akasaka Raimon,
Fromagerie Harmonie, Seizan Sodo…), and the place's Japanese name or
where it came from would settle them. Others are identity calls (Acid
Coffee: listed as Kyoto, but only a Tokyo shop exists) or possible
duplicates (Kiwami and Washindo). Tonkatsu Nanaido has moved: its pin
sits on Yakitori Imai's address.

### Still to build or decide for the audit

- **The OpenStreetMap check** (content-pass.md, Part 3): a script that
  matches each place to a named OSM object nearby, for door pins and
  opening hours. Not built yet. Worth doing before the Tokyo pass, since
  it settles pins without searches.
- **Approximate pins on the map:** draw them differently (faded, or
  with a dashed ring), or is the card's badge enough? Jerry hasn't
  said.
- **Closed places:** the workflow deletes a place Jerry agrees to drop,
  and its ID is never reused. Removal over a "closed" mark is the
  proposal's recommendation; Jerry hasn't confirmed it.
- **Part 4 of the content pass** is partly done. adding-places.md has
  the voice and the Hours rule. The rest is the OSM check as a research
  step, and the findings table back as the gate for new batches.

### Other open items

- **Line 196, Hachidaime Gihey** (Kyoto, Gion, by Yasaka Shrine;
  claypot rice): the one place on the list that isn't in the data.
  Research it and add it to `food`, Type "Rice; Donabe rice", following
  adding-places.md.
- **Links:** 251 of the 436 rows have none. An official site or
  Instagram is quick to add while auditing a row.
- **Opening hours for Open now:** 224 rows have no OSM hours, so Open
  now counts them as unknown. 77 rows have a Last verified date.
- **Pins sharing a spot** (as of the import): 17 spots hold two or more
  pins, 44 places in all.
  - Ten are station fallbacks (29 places; six sit on Kyoto-Kawaramachi
    station), and they separate as addresses turn up.
  - Seven are a shared block or building (15 places): Tokyo Station,
    Tokyu Food Show in Shibuya, Kintame and Tenjaku on 牡丹鉾町, and
    the two aburi-mochi shops at Imamiya Shrine, among others. Door
    coordinates from OSM would part them.
- **Ratings:** only drinks has the Google rating columns, and only 43
  of its older rows have a snapshot. Whether the other layers get the
  columns is open.
- **Icons:** 119 places wait for art under `question` (`,question,` in
  `data/` finds them). Adding art takes two steps, listed at the top of
  `src/config/icons.ts`: the file in `src/map/icons/`, then a line in
  the list. Then point the rows' Icon at it.

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

### Other open decisions

- **Aoyama – Harajuku:** their shapes touch, but they aren't listed as
  neighbours. Waiting for Jerry (`AWAITING_DECISION` in
  `src/data/area-shapes.test.ts`;
  `docs/proposals/filter-pages-and-area-map.md`, Part 2).
- **Area merges** (reviewed 2026-11-10, deferred by Jerry).
  - **Ready to split:** Nihonbashi (7) / Ningyocho (6), and Okazaki (3)
    / Nanzenji (2, which needs neighbours of its own).
  - **Either way:** Ginza (17) / Tsukiji (2).
  - **Keep:** the ward-line merges (Tokyo Station; Shinjuku with
    Minami-Shinjuku; Meguro with Kamiosaki; Kyoto's Shijo-* halves), the
    ones with a single place on a side, and Yanaka · Nezu · Sendagi
    ("Yanesen").

  Splitting follows "Adding an area" in adding-places.md: config, then
  `npm run areas`, then a review on the Area page.
- **Layers and kinds:** the 2026-11-09 split is a first cut from the
  list's categories (`docs/design/regions-layers-filters.md`,
  "Layers"). Food got its kinds on 2026-11-10.
- **Lodging:** its schema is still to come (same doc, "Lodging").

## Scratch data

The research files lived in session scratchpads that are gone:

- the import's per-batch research, geocodes, OSM matches and scripts;
- the 2026-11-10 rewrite's agent outputs and apply script.

Everything the app uses is in the rows. What's left to do is in the
queue and the decisions file.

Kept: `docs/research/places-sources-2026-11-09.csv`, one row per
imported place (`id`, `line`, `name`), with:

- its research **confidence**;
- its **hours source** (official, tabelog, other, or blank);
- the **other branches** of the 50 multi-branch brands;
- the **source URLs**, space-separated (251 of the 362 rows have at
  least one).

`npm run audit -- --place <id>` prints them. Look there before
searching again.

## How to resume

- **`npm run audit`** shows where things stand.
  - `--next N` lists what's next, in trip order and worst gap first.
  - `--next 1 --region kyoto` does the same for one region.
  - `--place <id>` prints everything held on one place.
- **`/audit`** runs a decision session: one place per turn, researched
  first, one question with a recommendation, then a commit per place
  and a push at the end. Say "audit pass for Tokyo" for the batch
  research instead (`docs/design/auditing-places.md`, "Two ways to
  work").
- **New places** follow `docs/design/adding-places.md`: research, a
  findings table Jerry reviews, then the rows ("Adding an area" for a
  new area).
- **The data tools:**
  - `npm run ids` prints ID problems and the next free ID per layer.
  - `npm run import -- <layer>` round-trips `data/<layer>.csv`, fixing
    quoting and column order.
  - `npm run areas` rebuilds the area shapes. Run it whenever a pin
    moves into another area or a row's Area changes: shapes grow around
    their places, so a misfiled place drags a stray piece into its
    area's shape.
- **Before a deploy:** `npm test` and `npm run snapshot` are what
  Actions runs. The tests fail on a place outside its region's map box,
  and on research wording in notes or hours. Growing a map box
  re-downloads every device's maps (adding-places.md, "Pitfalls").

**First step:** the Tokyo audit pass, or Jerry's 15 Tokyo decisions
with `/audit`.
