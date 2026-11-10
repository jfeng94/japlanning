# Auditing places

Status: **draft** (2026-11-10), for Jerry's review. How the places
already in the data get scrubbed before the trip, and how the work is
tracked. It continues `docs/proposals/content-pass.md`, whose Part 3
(settle hours and addresses) is this workflow. New places follow
`adding-places.md`, which ends where this begins.

## The goal: every place scrubbed

A place is **scrubbed** when all of these hold:

1. **It's the right shop.** There's no doubt it's the one the list
   meant: right city, right branch.
2. **It's open.** It hasn't closed or moved, as of the audit.
3. **It's where the pin says.** The address is exact (no `~`) and the
   pin is at the door, not on a station or a block.
4. **Its hours are known**, ideally read from the shop's own site or
   Instagram (a Last verified date). Some shops publish none; then the
   best other source, shown as unverified, is as good as it gets.
5. **Its note reads as a recommendation.** The data test enforces
   this already.

A place whose only gap is unverified hours is **ready**. That's enough
for the trip. Scrubbed is the aim where a shop publishes its hours.

## Where the state lives

| File | Holds |
| --- | --- |
| `data/<layer>.csv` | The truth: what the app shows. |
| `docs/research/audit-queue.csv` | One row per place with an open problem: priority, `;`-separated tags, and what was found. A place leaves when nothing's left. |
| `docs/research/audit-decisions.md` | Questions only Jerry can answer (is this the shop you meant? drop it?), one row per place. A row leaves when decided. |
| `docs/research/places-sources-2026-11-09.csv` | Where the research looked: confidence, hours source, URLs. Read it before searching again. |

`npm run audit` reads all four and prints the scorecard: per region,
how many places are scrubbed or ready and how many have each gap.
`--next N` lists what's next; `--place <id>` prints everything held on
one place.

## The order

The trip's stops in the order the group visits (Jerry, 2026-11-10):

1. **Tokyo.**
2. **Nara**, then **Uji**, on one day trip. Uji is the Kyoto region's
   Uji section, so it gets its own line on the scorecard.
3. **The rest of Kyoto.**
4. **Osaka** and **Hakone**, last until they have a place in the
   itinerary.

The stops are `TRIP` in `scripts/audit.ts`. Within a stop, the worst gap
first:

1. a question for Jerry;
2. not located (the pin is a station);
3. maybe not the right shop;
4. maybe closed or moved;
5. approximate address;
6. rough pin;
7. no hours;
8. sources disagree;
9. anything else in the queue.

Unverified hours come last, and only for places that publish hours.

## Two ways to work

### An audit pass: Claude, a region at a time

For a region's places with gaps, Claude researches in batches (helper
agents in parallel, as the notes rewrite did). Claude applies what the
evidence settles and queues what it doesn't.

Per place, one search and one or two pages, in this order of trust:

1. the shop's own site or Instagram;
2. Google Maps as search results show it;
3. Tabelog, Retty, Hot Pepper;
4. OpenStreetMap;
5. articles.

Searches run about 200 a turn across all helpers, so a pass of more
than 150 places takes several turns.

| Found | Claude does |
| --- | --- |
| Address on the official site, Instagram or Google | Writes it (dropping the `~`), geocodes it with GSI for the pin, checks the ward against the Area |
| The shop's object on OpenStreetMap, by name, near the pin | Moves the pin to it |
| Hours on the official site or Instagram | Writes them, with Last verified = today |
| Hours from Google, Tabelog or another listing | Writes them, unverified |
| Sources that disagree | Keeps the best in the row, records the rest in the queue |
| A move announced by the shop itself | Writes the new address, and says so in the report |
| Maybe closed, maybe another shop, a different city, a duplicate | **Asks**: a row in audit-decisions.md with the options and a recommendation |
| Nothing at all | Leaves the row; the queue says what was tried |

Claude never drops a place, renames one or changes its region or kind
without Jerry. One commit per batch names the places, and the scorecard
before and after goes in the message.

### A decision session: Jerry and Claude, one place at a time

`/audit` (the skill in `.claude/skills/audit/`) runs it:

1. **Pick.** The next place from `npm run audit -- --next 1`, or the one
   Jerry names. A region can be named: `/audit kyoto`.
2. **Research first.** Claude looks the place up before asking, so the
   question comes with what's known, the sources and a recommendation.
   When research settles everything without Jerry, Claude applies it,
   says so in a line, and goes on to the next place.
3. **Ask one thing.** A short card: the place, what's uncertain, what
   was found, the options with the recommended one first. One question
   per turn.
4. **Apply.** The row, the queue (tags settled come off; the place
   leaves when none are left) and the decisions file. Tests run, then
   one commit per place: `Audit: <name>: <what changed>`.
5. **Next**, with the region's scorecard line, until Jerry stops.
   Commits push when the session ends, since every push deploys.

A dropped place is deleted from its data file. Its ID is never reused,
and git history keeps the row.

## Tools

- **GSI geocoder:** `msearch.gsi.go.jp/address-search/AddressSearch?q=`,
  no key. Cut the address after its last block number.
- **Nominatim:** finds one shop by name near a point. One request a
  second, with the generic user agent.
- **OpenStreetMap check** (to build, from content-pass.md Part 3):
  matches every place to a named OSM object nearby, for door pins and
  opening hours.
- On Windows, use Node's `fetch` for Japanese text, not curl
  (`places-research-state.md`, "What worked").

## Before the trip

About a week before leaving, a last pass over the places that matter
most: the Key branches and any Jerry names. It re-reads their hours, so
the Last verified dates are fresh, and checks that nothing has closed.
