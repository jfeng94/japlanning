# Directions to the business, not a dropped pin

Status: **proposed** (2026-11-11). Waiting on Jerry's Google Cloud
project and API key; nothing is built yet.

## Why

The card's Directions button sends our coordinates (CLAUDE.md, gotcha
6), so Google Maps opens on a dropped pin rather than the business.
Jerry would rather it open the place itself, with its name, hours and
reviews in Google.

## How Google's link takes a place

- Google's directions link (Maps URLs) takes a **`destination_place_id`**
  next to `destination`, which stays required. Google's docs call a
  place ID the surest way to link to the right place.
- Links need **no API key**. Only looking the IDs up does.
- The docs don't say which wins in a directions link when both are
  given. In a search link the place ID wins and the query is the
  fallback. The iPhone test (below) settles it for directions.

## Getting the IDs: the Places API, once, by script

The **Places API (New) Text Search**, run by a script over every place
(about 440; 147 of them have only an area-level `~` address):

- **`npm run placeids`** (`scripts/build-place-ids.ts`, new). For each row
  without a Place ID, it searches `<Name> <Branch> <Address (JA)>`,
  biased to a small circle around our pin. Responses are cached in
  `.cache/place-ids/` (gitignored), so a rerun asks only for new rows.
- **Cost.** A search that returns only IDs is billed under "Text Search
  Essentials (IDs Only)", which Google's price list shows as unlimited
  at no charge. Asking for Google's name, location and address too, to
  check each match, moves it to a paid tier with a free monthly
  allowance. Check that tier's cap on the pricing page before the first
  run; 440 requests should fit well inside it.
- **Review.** The script writes a findings table (our name, Google's
  name, Google's address, the distance between the two pins) and flags
  any match more than about 100 m away or with a different name. Jerry
  reviews it, as in `docs/design/adding-places.md` (findings table,
  review, then rows). Accepted IDs go into a new **`Place ID`** column
  in each layer's CSV. The loader already tolerates new columns.
- **No match** leaves the cell blank, and that place's link keeps the
  coordinates, as today.
- **A possible bonus**, off by default: Google's location could suggest
  a better pin where ours is far off, for the audit's "pin at the door"
  (`docs/design/auditing-places.md`).

## The link

`directionsUrl` (`src/ui/links.ts`), when the place has an ID:

```
https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&destination_place_id=<id>&travelmode=transit
```

Without one, it stays as it is now. `Place` gains `placeId?: string`,
read from the column. Tests go in `src/ui/links.test.ts`. Whether
`destination` should be our coordinates or the place's name is for the
iPhone test to decide.

## Setup (Jerry)

Claude can't create the account or handle the key, so these steps are
Jerry's:

1. **Create a project** in the Google Cloud console
   (console.cloud.google.com), named e.g. "japlanning".
2. **Link a billing account.** Google asks for one to switch on any Maps
   API, even when the requests are free. A budget alert at $1 is a
   cheap safety net.
3. **Enable "Places API (New)"** in APIs & Services.
4. **Create an API key** (Credentials) and restrict it to Places API
   (New) only. Optionally cap the API's requests per day under Quotas
   (1,000 is plenty).
5. **Keep the key out of the repo and the chat.** Store it the way the
   ODPT token is stored, then restart the Claude app so its shells see
   it:
   ```powershell
   [Environment]::SetEnvironmentVariable("GOOGLE_MAPS_KEY", "<key>", "User")
   ```
   The script reads `GOOGLE_MAPS_KEY` and never prints a request that
   carries it.

## Before building: test one link on the iPhone

Google's docs say the link opens in the Google Maps app on iOS, but not
whether the app uses the place ID. So first:

1. Claude looks up one place's ID by hand (Google's Place ID Finder
   page), e.g. Covert Coffee.
2. Claude sends two test links: one with our coordinates as
   `destination`, one with the name, both with the ID.
3. Jerry taps them on the iPhone with the Google Maps app installed.
   Does it open on the business?

If the app ignores the ID, the fallback is Google's search link
(`/maps/search/?api=1&query=…&query_place_id=…`). It opens the
business's page, one tap from Directions.

## Keeping them fresh

- Google allows storing place IDs and recommends refreshing those older
  than 12 months.
- A refresh that asks only for the ID is listed as unlimited at no
  charge (Place Details Essentials, IDs Only).
- Rerun before the trip, like `npm run stations`. An ID Google no longer
  knows (a closed shop) comes back blank, and the link falls back to
  coordinates.
- New places get their ID as part of adding them: a line in
  `docs/design/adding-places.md`.

## Alternatives considered

- **The name and Japanese address as text, no IDs.** No setup, but
  Google runs a search, which can land on another branch of a chain.
  Avoiding that is why the link uses coordinates now. The 147 `~`
  addresses would stay pins.
- **By hand**, with the Place ID Finder page: about 440 lookups. Not
  worth it.
- This revisits "no Places API key" (2026-11-05, the Google rating
  columns) for IDs only. The ratings stay a hand-taken snapshot; their
  fields are in a pricier tier.

## Files

- `scripts/build-place-ids.ts` (new) and `package.json` (`placeids`)
- `data/*.csv`: a `Place ID` column
- The loader and `Place` type: `placeId`
- `src/ui/links.ts`, `src/ui/links.test.ts`
- `CLAUDE.md` (gotcha 6, the column table) and
  `docs/design/adding-places.md`

## Sources

- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started),
  read 2026-11-11
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing),
  read 2026-11-11
- [Places SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details/places)
- [Place IDs](https://developers.google.com/places/web-service/place-id)
