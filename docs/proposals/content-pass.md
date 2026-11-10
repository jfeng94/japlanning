# Content pass: notes, hours and addresses

Status: **accepted** (2026-11-10). Parts 1 and 2 are done; Parts 3 and 4
are next. See "Results" at the end.

## Why

Jerry's rules for what a card says:

1. **Notes read like a friend's recommendation**: definitive, not a
   work log of updates and unverified findings.
2. **Hours that aren't verified still go in the Hours row**, with an
   "unverified" badge, rather than being left out or hedged in prose.
3. **An unsure location shows as the Address row's "approximate"
   badge**, which the card already has.

The 2026-11-09 import broke the first rule. It wrote the research into
the notes. Of 436 notes, 187 carry research wording, all but one from
that import (food 77, sweets 56, shops 25, drinks 20, music 7,
activities 2):

| In the notes | Rows | Example |
| --- | --- | --- |
| An "Update: …" tail | 155 | "Update: Tabelog says 11:00–18:00 (line says 12:00–17:30) … verify hours." |
| Where the pin is | 58 | "Location approximate: pinned near 清水五条 station until the shop is found." |
| "(unverified)" and similar | 29 | "Open about 8:30–18:00 daily (unverified)." |
| Hours, as a time range | 51 | 19 of them have no Hours in the row; 32 repeat it, sometimes differently. |

The fields have their own gaps. Of 436 places:

- **Hours:** 77 verified, 188 unverified, 171 unknown.
- **Addresses:** 288 exact and 148 approximate (`~`). 58 of the
  approximate ones are pinned on a station because the shop wasn't
  found.

## Where each kind of information goes

| What | Where | The card shows |
| --- | --- | --- |
| What it is, why go, what to order; practical tips (cash only, queues, booking, seats) | **Notes**, 2–3 sentences, present tense, no hedging | The notes |
| Hours from the shop's own site or Instagram | **Hours**, **Hours (OSM)**, **Last verified** = the date read | Hours, no badge |
| Hours from anywhere else (Google, Tabelog, a listing, an article) | **Hours**, **Hours (OSM)**; Last verified blank | Hours with **unverified** |
| No hours found | Hours blank | "Hours unknown" |
| An address that stops short of the street number, or a pin not at the door | **Address (JA)** with a leading `~` | Address with **approximate** |
| Sources, conflicts between them, what's left to check | `docs/research/` (the follow-up list, the sources CSV) | Nothing |
| Doubt about the place itself (maybe closed, maybe not the shop the list meant) | A question in the findings table for Jerry | Nothing until it's settled |

Notes never carry hours, addresses, sources, dates of research, or
doubt. When the research disagrees with itself, the field takes the
best source (official, then Google, then Tabelog, then the rest), and
the disagreement goes to the follow-up list.

## Part 1: the card

- **The Hours row carries the badge.** "unverified" sits beside hours
  that have no Last verified date, as "approximate" sits beside an
  address. Today the badge is at the bottom of the card, in a
  "Verified" section.
- **The "Verified" section goes.** The badge says it. A verified place
  shows its date under Details instead ("Hours checked 2026-11-04"), so
  the date is still there to judge how fresh it is.
- **A check on the data's notes.** A test over every data file fails
  on research wording in Notes ("Update:", "(unverified)", "Tabelog
  says", "pinned near", "verify", "No matching result"). It lands after
  Part 2 has cleaned the notes, and keeps future rows in the voice.

Small: `src/ui/detail-fields.ts` and its test, one test in
`src/data/parse.test.ts`.

## Part 2: rewrite the 187 notes

For each row:

1. **Hours in the notes move to the fields**, by judgment, not a
   script. Weekenders Coffee's notes give the hours of the shop it moved
   out of, so they don't go in.
2. **Each "Update:" is settled:**
   - a fact that settles a field goes into the field: an address, a
     closing day, a reservation rule;
   - a conflict puts the best source in the field and the rest in the
     follow-up list. Brewman Tokyo's notes say 12:00–17:30, while its
     Hours already hold Tabelog's 11:00–18:00;
   - an open question goes to the follow-up list (most are already
     there).
3. **What's left is rewritten as a recommendation.** The specifics that
   help (the order, the price, the seats, cash only, booking) stay.
4. **Doubts about identity aren't written away.** Acid Coffee was on the
   list as Kyoto, and only a Tokyo shop exists. Places like that go
   into a findings table for Jerry: keep, move, or drop.

Example, Brewman Tokyo:

> **Before:** Run by 2022 Japan Brewers Cup champion Hikaru Ono. 10+
> beans from light to dark, each brewed on different gear (e.g., cloth
> filter for dark roasts), plus guest roasters. Open 12:00–17:30, closed
> Tuesdays, Wednesdays and Thursdays. Update: Tabelog says 11:00–18:00
> (line says 12:00–17:30); closed days match. No official source
> reached; verify hours.
>
> **After:** Run by 2022 Japan Brewers Cup champion Hikaru Ono. Choose
> from ten-plus beans, light to dark, each brewed on the gear that suits
> it (cloth filter for the dark roasts), plus guest roasters.
>
> Hours stay "11:00–18:00; closed Tue–Thu" with the unverified badge.
> The follow-up list notes the list's 12:00–17:30.

**Review.** Ten rewritten notes come first, across layers, for Jerry to
approve the voice. Then one commit per layer, with the diff to skim and
the findings table for anything that needs a decision.

## Part 3: settle hours and addresses

Settling the 148 approximate addresses and 359 unverified or unknown
hours is research, not editing. It is worth doing in the order the trip
needs it:

1. **By region, in the order the group visits.**
2. **Within a region:**
   - places pinned on a station (they put you in the wrong spot);
   - other approximate addresses;
   - no hours;
   - unverified hours.

The follow-up list (`docs/research/places-followup-2026-11-09.csv`)
already sorts by much of this. Each place settled leaves it, in the same
commit.

**Sources, best first:**

1. the shop's own site or Instagram (the only ones that earn a Last
   verified date);
2. Google Maps as it shows in search results;
3. Tabelog, Retty, Hot Pepper;
4. OpenStreetMap;
5. articles and blogs.

The search budget is about 200 searches a turn, so plan for one search
and one page per place.

**A new, free source: an OpenStreetMap cross-check.** A script
(`npm run osm-check`) asks Overpass once per region for named shops,
cafés and restaurants, and caches the answer. It matches each of our
places by name within a few hundred metres of its pin, then reports:

- `opening_hours` where we have none or differ (unverified hours, ready
  to paste in OSM syntax);
- the object's coordinates, to move station and block pins to the door.

It is repeatable, works for future places too, and its data is
ODbL-licensed, which our OpenStreetMap credit already covers. Coverage
will be partial: good for Tokyo cafés, thinner for small Kyoto shops.

**Considered, not proposed: Google's Places API.** It would settle most
of this (hours, address, whether a place is still open). But its terms
don't allow storing what it returns, and we decided against a key on
2026-11-05.

**Jerry can unblock the "not located" places fastest.** Where each list
entry came from (an Instagram post, an article) often names the shop
exactly. The findings table asks.

**Closed places.** A place confirmed closed is removed, after the
findings table says so; its ID is never reused.

**Before the trip.** Hours drift. About a week before leaving, the Key
places and any Jerry names get a re-check, and Last verified dates move
up.

## Part 4: future places

`docs/design/adding-places.md` gets:

- the table above, as the rule for each column;
- the notes style: what to write, and the words that don't belong;
- the OSM check as a research step;
- the findings table back as the gate for the batch (it was waived for
  2026-11-09's import, which is how research reached the notes).

The test from Part 1 holds new rows to it.

## Files

```
Part 1  src/ui/detail-fields.ts, detail-fields.test.ts; src/data/parse.test.ts (notes check)
Part 2  data/*.csv (notes, and hours where settled); docs/research/places-followup-2026-11-09.csv
Part 3  scripts/osm-check.ts, package.json; data/*.csv; the follow-up list
Part 4  docs/design/adding-places.md; CLAUDE.md's workflow line
```

## Questions for Jerry

1. **Pins not at the door.** The card badges the address, but a pin on
   a station still looks like the shop on the map. Draw approximate pins
   differently (faded, or with a dashed ring), or is the card enough?
2. **Order.** Part 1 and a 10-note sample first, then Part 2 by layer,
   then Part 3 region by region: which region does the group visit
   first?
3. **Closed places:** remove them (recommended), or keep them marked
   closed?

## Results

**Part 1** (2026-11-10): the Hours row carries the "unverified" badge,
and verified hours read normally. A verified place shows "Hours
checked <date>" at the end of Details.

**Part 2** (2026-11-10):

- **Rewritten:** 223 notes, and the hours of 112 places, in the voice
  Jerry approved on the ten-note sample
  (`docs/research/notes-sample-2026-11-10.md`). Hours moved from notes
  into the fields where the Hours cell was blank.
- **Settled:** nothing new was researched. Six helper agents rewrote
  from each row's own fields. A script checked every change (ids,
  wording, opening_hours syntax) and every new number and superlative
  against the old text, then applied them.
- **Hand-adjusted:** two places whose sources disagree on Mondays (Fuku
  Coffee, Bee's Knees) keep no OSM hours, so Open now treats them as
  unknown rather than open. Two branch names the agents added were
  undone. Two notes that require booking now say Reservation: Required.
- **Follow-up list:** gained the disagreements and open questions the
  notes used to carry, and lost its "no hours" tag where hours arrived
  (271 places now).
- **Questions for Jerry:** 30 places whose identity or status is in
  doubt are in `docs/research/findings-2026-11-10.md`.
- **Enforced:** a test over every data file fails on research wording
  in a note or an Hours cell. `adding-places.md` states the voice.
