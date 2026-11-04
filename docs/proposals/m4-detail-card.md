# M4: Detail card

Status: **implemented, awaiting phone acceptance** (approved and built
2026-11-04). Checked in a desktop browser at phone width except where only
a phone can; see Results.

## Goal

The selected place's card, filling the container M3 built: every field
from the sheet, laid out so the half-height panel shows what you need on
a street corner and full height shows the rest, with Directions, Copy,
Share and the place's link as actions. Generic across layers, so tea,
pastry and the rest get a complete card the day their sheet exists.

## Done when

- [x] At half height: ★ and name, layer and neighborhood, address with an
      "approximate" marker when the sheet had `~`, hours text (or "Hours
      unknown"), an **Open / Closed** status when the sheet has OSM hours,
      the row chips, and the action buttons.
- [x] The status is evaluated in Asia/Tokyo time wherever the phone is: a
      test with a non-JST process time zone proves it, and the brief's
      examples (hours past midnight, `We[3] off`) are covered.
- [x] At full height, below those: notes, every facet as label and values,
      last-verified date or an "unverified" badge, and any extra sheet
      columns as label and value.
- [x] Copy puts `Name` + newline + `Address` on the clipboard and shows a
      brief "Copied" toast; with no address it copies the name.
- [ ] Share opens the iOS share sheet with the place's name and a link to
      it, no filter state; where the share API is missing (desktop), it
      copies the link instead.
- [x] Pasting such a link, or a bare place id, into the app's search
      field selects that place (switching region if needed) and clears the
      field.
- [x] Link opens the official site or Instagram in the browser, labelled by
      which it is.
- [x] Directions opens Google Maps in transit mode (already in M3).
- [x] A shared link to a Kyoto place opens in Kyoto, not the remembered
      region.
- [x] `npm test` covers the field model and the link builders.

## Design

### Field model (`src/ui/detail-fields.ts`, pure, tested)

The card is rendered from a list of sections built by a pure function, so
what shows and in what order is testable without a DOM:

```ts
interface DetailSection { title?: string; rows: DetailRow[] }
interface DetailRow { label: string; value: string; flag?: "approximate" | "unverified" | "unknown" }

detailFields(place, layer): { essentials: DetailRow[]; details: DetailSection[] }
```

- **essentials** (half height): address (+ approximate flag), hours (or
  "Hours unknown" flagged unknown) with the open/closed status beside it
  when OSM hours exist, then the layer's `rowFacets` as chips.
- **details** (full height): Notes; a "Details" section with every facet
  of the layer as label and joined values (blank ones say "Unknown"); an
  "Also in the sheet" section for `extra` columns; a "Verified" row with
  the date, or an unverified flag when blank.

Blank core fields are omitted, not shown as empty rows, except hours and
verification, which are worth saying "unknown" about.

### Open / Closed (`src/hours/open.ts`, pure, tested)

Pulled forward from M5, which keeps the filter and the "open at…" picker.
The card shows one of:

- **Open · until 19:00** / **Closed · opens 08:00** / **Closed today ·
  opens Tue 08:00**, from the `Hours (OSM)` cell via the `opening_hours`
  package (the reference parser for that syntax).
- Nothing when the cell is blank; the hours text alone says "Hours
  unknown" then.
- **Hours unparsable** when the cell doesn't parse, so a bad row is
  visible rather than silently closed.

The brief's first gotcha applies: `opening_hours` reads wall-clock time
from the JS Date's *local* getters, so on a phone in California it would
evaluate California time. `tokyoNow(now = new Date())` builds a Date
whose local fields equal Tokyo's wall clock (via `Intl.DateTimeFormat`
with `timeZone: "Asia/Tokyo"`), and every evaluation goes through it. The
same trick converts the "next change" Date back for display. Tests run
the evaluator with a fixed instant and assert the same answer under
`TZ=America/Los_Angeles`, and cover Fuglen's `We-Su 07:00-01:00` at
00:30 and the `We[3] off` closure.

The package pulls in i18next and suncalc (sunrise/sunset rules), a few
hundred kB minified; that's the price of not writing an opening-hours
parser. It's loaded lazily on first card open so the map isn't slower to
start.

### Actions

| Button | What it does | Notes |
| --- | --- | --- |
| Directions | `directionsUrl(place)` in a new tab | From M3. Primary style. |
| Copy | `navigator.clipboard.writeText(copyText(place))`, toast "Copied" | Must run synchronously inside the tap handler: iOS refuses clipboard writes after an `await`. The copied address has the `~` stripped; the UI shows the approximate marker instead. |
| Share | `navigator.share({ title, text, url })` with `shareUrl(place)`; fallback copies the URL, toast "Link copied" | The URL is `/?r=<region>&s=<id>`, never the filter state (decided). The text includes the name so it's searchable in the app. |
| Website / Instagram | opens `place.link` in a new tab | Label from the hostname: Instagram for instagram.com, otherwise Website. Hidden when there's no link. |

### Receiving a shared link

iOS opens links in the browser, never in an installed web app, so a
"meet here" link from Messages lands in Safari or Chrome with a fresh
copy of the site: it works, but it's not the app with the cached data
and the group's settings. Two ways in:

- **Paste into search.** The search field recognises a pasted link to
  this site with an `s=` parameter, or a bare place id
  (`tokyo-coffee:bear-pond-espresso`), and selects that place, switching
  region if needed, then clears itself. Recognition is a pure, tested
  function (`parseSharedLink(text)`), applied on paste and on input.
- **Search by name.** The share text carries the place name as well as
  the link, so the recipient can also just type the name.

The share text is: `<name>` newline `<link>`, nothing about filters.

### Startup from a shared link

`initialState` currently treats a URL with only `s=` as "no filter
params" and uses the remembered region. With `r=` in every share link
that's correct, but a hand-trimmed link with `s=` alone for a Kyoto place
would open in Tokyo and find nothing. M4 makes the startup path look the
place up by id across regions once data arrives and switch region if
needed, so any `s=` link works.

### Toast (`src/ui/toast.ts`)

A small fixed label above the panel that fades after 1.5 s. Used by Copy
and Share; later by anything else that needs a one-line confirmation.

### Card (`src/ui/detail.ts`)

Rewritten from the M3 placeholder: head (back, ★, name), meta line,
actions row, essentials, then the detail sections. Chips reuse `tag`.
The strip at strip height keeps name plus Directions as now.

## Files

```
src/ui/detail-fields.ts       new, pure
src/ui/detail-fields.test.ts  new
src/ui/links.ts               + copyText, shareUrl, linkLabel, parseSharedLink
src/ui/links.test.ts          new
src/ui/header.ts              search ingests a shared link
src/hours/open.ts             new: tokyoNow, openStatus(place, now)
src/hours/open.test.ts        new, run under a non-JST TZ too
package.json                  + opening_hours
src/ui/toast.ts               new
src/ui/detail.ts              the card
src/ui/app.ts                 handlers, startup region from a place id
src/style.css                 card and toast
```

One new dependency: `opening_hours` 3.15 (ships its own types).

## Order of work

1. Field model, link builders, tests.
2. Card layout from the model; actions wired (Directions, Link).
3. Toast; Copy and Share with their fallbacks. Deploy; phone check of the
   clipboard and share sheet, which only a real device can do.
4. Open/closed: Tokyo-time adapter, evaluator, tests under a non-JST TZ,
   status on the card. Deploy.
5. Shared-link startup across regions; link ingest in search; polish.

Step 1 is the pure piece if Jerry wants to write one.

## Out of scope

Bookmarks (M4b, which adds a button to this card), the "open now" filter
and the "open at…" picker (M5, on top of M4's evaluator), editing
anything.

## Open questions

- **Facets at half height**: chips for `rowFacets` only (proposed), with
  the full labelled list at full height.
- **Link label**: Instagram vs Website by hostname (proposed); or always
  "Link".

## Diff size

About 10 files, roughly 600 lines, a third of it tests.

## Results

Built 2026-11-04. 122 tests (23 new: links, field model, open status).
The hours parser is a lazily loaded 714 kB chunk (116 kB gzipped); the
main bundle grew 40 kB.

Verified in the browser pane at 375×812 against the production build:

- Glitch Jimbocho at Thursday 06:45 Tokyo time: "Closed · opens 08:00";
  Fuglen Tokyo: "Closed · opens 07:00"; both from the sheet's OSM hours.
- Card: head with ★ and name, layer · neighborhood, Directions / Copy /
  Share (+ Website for Fuglen, labelled from the hostname), address,
  hours text with the status beside it, the row chips, then Notes,
  Details (all six facets), Verified.
- Pasting `https://japan.garbage.house/?r=tokyo&s=…` or the bare id
  `tokyo-coffee:onibus-coffee-jiyugaoka` into search opens that place and
  clears the field.
- Copy: a real click in the pane writes the clipboard and toasts
  "Copied"; a script-driven click is not a user gesture, is refused, and
  toasts "Couldn't copy", so both paths are exercised. Share has no API
  in the desktop pane and falls back to copying the link.

For the phone pass:

- Copy puts name + address on the clipboard (paste into Notes to check).
- Share opens the iOS sheet with the name and the link.
- A link pasted into search inside the installed app opens the place.
- The card at half height fits the street-corner set without scrolling.

Decisions made while building:

- `openStatus` loads the parser on first use; the status fills in a beat
  after the card appears, guarded by a render token so a slow lookup never
  overwrites a newer card.
- A sheet's unparsable hours show "Hours unparsable" in muted text rather
  than reading as closed.
- `parseSharedLink` only accepts links to this site's host, so a pasted
  link to anything else is treated as search text.
- A `?s=` link without `r=` follows the place to its region on load.
