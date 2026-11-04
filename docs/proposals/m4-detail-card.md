# M4: Detail card

Status: **proposed** (2026-11-04). Waiting for go-ahead.

## Goal

The selected place's card, filling the container M3 built: every field
from the sheet, laid out so the half-height panel shows what you need on
a street corner and full height shows the rest, with Directions, Copy,
Share and the place's link as actions. Generic across layers, so tea,
pastry and the rest get a complete card the day their sheet exists.

## Done when

- [ ] At half height: ★ and name, layer and neighborhood, address with an
      "approximate" marker when the sheet had `~`, hours text (or "Hours
      unknown"), the row chips, and the action buttons.
- [ ] At full height, below those: notes, every facet as label and values,
      last-verified date or an "unverified" badge, and any extra sheet
      columns as label and value.
- [ ] Copy puts `Name` + newline + `Address` on the clipboard and shows a
      brief "Copied" toast; with no address it copies the name.
- [ ] Share opens the iOS share sheet with a link straight to the place;
      where the share API is missing (desktop), it copies the link instead.
- [ ] Link opens the official site or Instagram in the browser, labelled by
      which it is.
- [ ] Directions opens Google Maps in transit mode (already in M3).
- [ ] A shared link to a Kyoto place opens in Kyoto, not the remembered
      region.
- [ ] `npm test` covers the field model and the link builders.

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
  "Hours unknown" flagged unknown), then the layer's `rowFacets` as chips.
- **details** (full height): Notes; a "Details" section with every facet
  of the layer as label and joined values (blank ones say "Unknown"); an
  "Also in the sheet" section for `extra` columns; a "Verified" row with
  the date, or an unverified flag when blank.

Blank core fields are omitted, not shown as empty rows, except hours and
verification, which are worth saying "unknown" about.

### Actions

| Button | What it does | Notes |
| --- | --- | --- |
| Directions | `directionsUrl(place)` in a new tab | From M3. Primary style. |
| Copy | `navigator.clipboard.writeText(copyText(place))`, toast "Copied" | Must run synchronously inside the tap handler: iOS refuses clipboard writes after an `await`. The copied address has the `~` stripped; the UI shows the approximate marker instead. |
| Share | `navigator.share({ title, text, url })` with `shareUrl(place)`; fallback copies the URL, toast "Link copied" | The URL is `/?r=<region>&s=<id>`, filters not included, so the recipient sees the place, not your filter state. |
| Website / Instagram | opens `place.link` in a new tab | Label from the hostname: Instagram for instagram.com, otherwise Website. Hidden when there's no link. |

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
src/ui/links.ts               + copyText, shareUrl, linkLabel
src/ui/links.test.ts          new
src/ui/toast.ts               new
src/ui/detail.ts              the card
src/ui/app.ts                 handlers, startup region from a place id
src/style.css                 card and toast
```

No new dependencies.

## Order of work

1. Field model, link builders, tests.
2. Card layout from the model; actions wired (Directions, Link).
3. Toast; Copy and Share with their fallbacks. Deploy; phone check of the
   clipboard and share sheet, which only a real device can do.
4. Shared-link startup across regions; polish.

Step 1 is the pure piece if Jerry wants to write one.

## Out of scope

Bookmarks (M4b, which adds a button to this card), open-now evaluation
(M5; hours show as the sheet's text until then), editing anything.

## Open questions

- **Facets at half height**: chips for `rowFacets` only (proposed), with
  the full labelled list at full height.
- **Share includes filters?** Proposed no: a shared place is a place.
- **Link label**: Instagram vs Website by hostname (proposed); or always
  "Link".

## Diff size

About 7 files, roughly 450 lines, a third of it tests.

## Results

(filled in after acceptance)
