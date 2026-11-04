# M5: Open now

Status: **done** (accepted on the phone 2026-11-04).

## Goal

Filter the list and map to places that are open, in Tokyo time, with a
clear line on what happens to places whose hours aren't known. An "open
at…" picker answers "what's open Tuesday at 10?" for planning. Built on
M4's evaluator; no new parsing.

## Done when

- [x] "Open now" in the filter sheet's Flags section narrows list and map
      to places whose OSM hours say open at the current Tokyo time, with a
      count. It appears in the strip summary and the URL (`open=1`).
- [x] Places with no OSM hours are not silently dropped: an "include
      unknown hours (n)" checkbox under the chip, default on, like the
      facets' include-unknown. Off, they're hidden. Unparsable hours count
      as unknown.
- [x] Layers without hours (`hasHours: false`, e.g. lodging) are untouched
      by the filter and their rows show a small "no hours" mark while it's
      on.
- [x] The status refreshes on its own: once a minute while the filter is on
      and when the app comes back to the foreground, so a list left open
      across 19:00 updates.
- [x] "Open at…": a day-and-time picker in the sheet evaluates at that
      Tokyo time instead of now; the card's status, the strip tag ("Open
      Tue 10:00") and the URL (`at=2026-11-10T10:00`) follow it. Clear
      returns to now.
- [x] `npm test` covers the evaluation over a set of places, the filter
      with the three outcomes (open, closed, unknown), the unknown toggle,
      and the URL round trip including `at=`.

## Design

### Evaluation (`src/hours/evaluate-all.ts`, pure once the parser is loaded)

```ts
type HoursState = "open" | "closed" | "unknown";   // unknown = blank or unparsable
evaluateAll(places: Place[], at: Date): Map<placeId, HoursState>
```

One parser instance per distinct hours string, cached, so 39 (or 300)
places are a few milliseconds. The parser is M4's lazy import; turning
the filter on for the first time awaits it (a beat, once).

### Filter state

`openNow` already exists in `FilterState` and the URL. M5 adds:

```ts
includeUnknownHours: boolean;   // default true; URL hu=0 when off
openAt?: string;                // "YYYY-MM-DDTHH:MM" Tokyo wall clock; URL at=
```

The evaluation result lives outside the filter state, like bookmarks,
and is passed in: `applyFilters(places, state, { hours: Map })`. Rules
when `openNow` is on:

- Layer has `hasHours: false` → the row passes untouched.
- State `open` → passes. `closed` → hidden.
- `unknown` → passes iff `includeUnknownHours`.
- No map given (parser still loading) → everything passes, so the list
  never blanks while the parser arrives.

Counts for the chip come from the same map: open / unknown among the
otherwise-filtered rows, the same "what if I picked this" convention.

### Time

"Now" is `tokyoNow()`; "open at" is a Tokyo wall-clock string turned
into the same kind of Date. The app holds a `hoursAt` (now or the
picked time) and a `hoursMap`; both the filter and the card read from
them, so the card's "Open · until 19:00" and the filter never disagree.

Refresh: a 60 s interval while `openNow` is on (cleared when off), plus
`visibilitychange` → recompute, since the installed app sleeps and a
stale interval would otherwise show yesterday's answer.

### UI

- **Filter sheet, Flags**: "Open now" chip with the open count; under it,
  when on, "Include unknown hours (n)" checkbox, and an "Open at…" row
  with native `<input type="date">` and `<input type="time">` (the phone's
  own pickers, no library) and a Clear. The chip label becomes "Open at
  Tue 10:00" while a time is set.
- **Strip summary**: "Open now" / "Open Tue 10:00" tag.
- **List rows**: with the filter on, a muted "no hours" mark on rows from
  layers without hours, and "hours unknown" on unknown rows that are
  included, so the reader can tell why a row is there.
- **Card**: unchanged in shape; its status is evaluated at `hoursAt`, so
  with "open at" set it reads e.g. "Open at Tue 10:00 · until 19:00".

### Files

```
src/hours/evaluate-all.ts, .test.ts     new
src/hours/open.ts                       evaluate at an arbitrary time; label for "open at"
src/filter/state.ts, url.ts, apply.ts   includeUnknownHours, openAt, hours option; tests
src/ui/filter-sheet.ts                  chip, checkbox, pickers
src/ui/filter-summary.ts                tag
src/ui/list.ts                          marks
src/ui/detail.ts                        status at hoursAt
src/ui/app.ts                           hoursAt, hoursMap, refresh timer
docs/design/regions-layers-filters.md   the open-now rules
```

No new dependencies.

## Order of work

1. `evaluateAll`, filter state and apply rules, URL; tests.
2. App wiring: evaluation map, refresh, the chip and unknown checkbox,
   strip tag, row marks. Deploy.
3. "Open at…" pickers, card status at that time. Deploy.

## Out of scope

Hours for layers that don't have them yet; holiday rules (`PH`) beyond
what the parser handles without a locale; showing "closes in 20 min"
warnings (easy later, same data).

## Open questions

- **Include unknown hours by default: on** (proposed), matching facets.
  The alternative, off, makes "open now" stricter but hides 18 of 39
  coffee rows today.
- **"Open at" granularity**: date + time pickers (proposed) vs a quicker
  "later today / tomorrow morning" set of presets. Pickers first; presets
  if the trip shows a pattern.

## Diff size

About 10 files, roughly 450 lines, a third tests.

## Results

Built 2026-11-04 in two commits. 134 tests (5 new: evaluateAll at now and
at a picked time, wall-clock round trip, the filter's three outcomes with
the unknown toggle and hour-less layers, counts, URL round trip).

Verified in the browser pane at 375×812, Tokyo time Thursday 08:46:

- Open now on: chip "Open now · 7", 25 places (7 open + 18 unknown), every
  unknown row marked "hours unknown", URL `?open=1`.
- Include unknown hours off: 7 places, URL `&hu=0`.
- Open at Tue 10:00 via the pickers: chip "Open Tue 10:00 · 18", strip
  tag "Open Tue 10:00", URL `&at=2026-11-10T10:00`; Glitch's card reads
  "Open at Tue 10:00 · until 19:00".

For the phone pass:

- The native date and time pickers inside the sheet.
- Leave the list open past a change of hours and see it update within a
  minute; background the app and return.
- No "no hours" layer exists yet (coffee has hours), so that mark is
  untested by hand; the unit test covers the rule.

Decisions made while building:

- Turning the filter on before the parser has loaded shows "Checking
  hours…" under the chip and passes everything until it arrives.
- A picked date without a time (or the reverse) is completed from
  Tokyo's current clock, so one tap on either picker is enough.
- `openAt` without `openNow` is kept in state and the URL but has no
  effect until the filter is on; Clear drops both.
