# Directions to the business, not a dropped pin

Status: **done** (proposed 2026-11-11, built 2026-11-18). Jerry's key
is set on his PC and in the cloud environment, and the iPhone test has
run (below): the app takes the ID next to the place's name, not next to
coordinates. The button opens the place's page rather than directions,
so the link with an ID is the search link. 486 of 512 places have an
ID; new places get one as they're added (`adding-places.md`, "Write").

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

- **`npm run placeids`** (`scripts/build-place-ids.ts`, built
  2026-11-18). For each row without a Place ID, it searches `<Name>
  <Address (JA)>`, biased to a circle around our pin (300 m, or 1.5 km
  for a `~` address, which adds the branch). The branch stays out of
  exact queries: Covert Coffee's "Shinjuku 3-chome (Musashino Bldg
  B1F)" made Google return its other two branches and miss the shop.
  Friends' homes are never searched. Responses are cached in
  `.cache/place-ids/` (gitignored) for 30 days, so a rerun asks only
  for new rows.
- **Picking the listing.** Of up to five answers, the nearest whose name
  matches ours, preferring one at our address: our first two address
  numbers (3-27 of 新宿3-27-10, or 232 7 of "232 7th Ave") in a row in
  Google's. Generic words (Hotel, Coffee, Bar…) needn't match, so
  "Wayfarer Hotel" is WAYFARER Kyoto Shijo. Tests:
  `scripts/build-place-ids.test.ts`.
- **Cost.** A search that returns only IDs is billed under "Text Search
  Essentials (IDs Only)", which Google's price list shows as unlimited
  at no charge. Asking for Google's name, location, address and status
  too, to check each match, is Text Search Pro: 5,000 free calls a
  month (pricing page, read 2026-11-18), and a run is about 510.
- **Review.** The findings flag each match whose name or address
  differs, that is over 100 m from our pin, that has a second listing
  nearby, that Google says is closed, or whose address of ours is
  approximate. Accepted without review (`autoAccept`): name and address
  match, not closed for good, within 500 m. Claude judges the rest on
  the evidence (a Japanese-script name like 長寿庵 蕎匠 for Choju-an
  Kyosho, a translation like Human Beings Everybody Noodles) and leaves
  doubtful ones blank. `npm run placeids -- --apply` writes the
  accepted IDs, then `npm run import` per layer normalises the files.
  The first run (2026-11-18): 512 places, 486 accepted, 15 without a
  reliable match, 11 that Google says closed for good. Jerry reviews the flagged ones,
  as in `docs/design/adding-places.md` (findings, review, then rows).
  Accepted IDs go into a new **`Place ID`** column in each layer's CSV.
  The loader already tolerates new columns.
- **Google's terms** let us store place IDs, but not its names,
  addresses or (beyond 30 days) coordinates. So the findings, which
  show them, stay in `.cache/place-ids/findings.csv` and the chat, never
  the repo; only the IDs are committed.
- **No match** leaves the cell blank, and that place's link keeps the
  coordinates, as today.
- **A possible bonus**, off by default: Google's location could suggest
  a better pin where ours is far off, for the audit's "pin at the door"
  (`docs/design/auditing-places.md`).

## The link

`googleMapsUrl` (`src/ui/links.ts`, named `directionsUrl` until
2026-11-18). Jerry wants the button to open the place's page, not
directions, since Directions is one tap from there (2026-11-18). So
today, with no IDs, it opens a dropped pin's page:

```
https://www.google.com/maps/search/?api=1&query=<lat>,<lng>
```

When the place has an ID, the name goes in `query`, since the app
ignores an ID next to coordinates (the test below):

```
https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<id>
```

`Place` gains `placeId?: string`, read from the column. Tests go in
`src/ui/links.test.ts`.

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
6. **For cloud sessions** (done 2026-11-18): the same key as a network
   secret on the cloud environment, so the PC isn't needed on the trip.
   In the environment's settings, Add secret: the API-key type, allowed
   website `places.googleapis.com`, header `X-Goog-Api-Key`, no
   prefix. The cloud's proxy adds the header to every request to that
   host; the key never reaches the session. Claude's own "save a key"
   form can't do it, since it only sends `Authorization: Bearer`. The
   script then runs without `GOOGLE_MAPS_KEY` and sends no key itself.

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

**Result (2026-11-18, in New York, from a cloud session).** The ID came
from the Places API, not the Finder page, for Warabimochi Kamakura
Chelsea (sweets 91), so the directions could be followed there; Covert
Coffee's lookup worked too. Google has two listings for that shop at
the same address; the one Jerry's share link names was used.
- Coordinates plus ID, in a directions link: **a dropped pin.** The app
  ignores the ID next to coordinates.
- The name plus the ID, in a directions link: **the shop.**
- The name plus the ID, in the search link: **the shop's page.**
- Jerry then chose the page over directions, so the link becomes the
  search link with the name and the ID (above). The script's findings
  table will have to settle shops with two listings.

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
