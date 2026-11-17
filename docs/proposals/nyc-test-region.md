# New York: a test region for the location features

Status: **proposed** (2026-11-16). Jerry flies to New York on
2026-11-18; this has to ship tomorrow to be tested there.

## Why

The location features (blue dot, locate, Nearest, distances, Nearby,
Here, open now, Directions) have only been tried from home, far from
every pin. A few days in New York with the installed app is a real
field test before Japan. It also shows what assumes Japan.

## Scope (Jerry, 2026-11-16)

- **Where:** mostly Manhattan and Flushing, with excursions (north
  Brooklyn is likely).
- **What:** coffee shops. Jerry's picks are Black Fox Coffee, SEY,
  Abraço and Arcane Estate, plus about 25 notable ones found by
  research. They go through the usual findings table before any row is
  written (`docs/design/adding-places.md`).
- **Visible to everyone.** No one else is testing the app right now,
  so New York is an ordinary region in the picker.
- **No subway lines.** Outside Tokyo and Kyoto the map keeps its own
  grey rail lines and station names, which is enough to get around.
  Colouring New York's lines would be a bigger job than Tokyo's, since
  most of its track carries several services, and it tests nothing
  about location. Google Maps does New York's transit directions.

## What changes

### 1. A map build per region

Our map build (Protomaps 3 Nov) is no longer published, and every
region shares the one pin (`BASEMAP.build`). A new region today would
mean a new pin, every Japan map extracted again, and every phone
downloading about 115 MB again (gotcha 11).

- **`RegionConfig.basemapBuild`**, optional, overrides `BASEMAP.build`
  for that region.
- Japan's regions keep 3 Nov, so the maps workflow copies them from the
  maps site unchanged and nobody downloads them again. New York pins a
  current build.
- `versionFor` takes the region instead of its bbox; the maps script
  extracts each region from its own build; `check-maps` follows.
- **The map:** `[-74.03, 40.67, -73.79, 40.88]` at zoom 15, about
  **40 MB**. That's all of Manhattan from Inwood to the Battery, north
  Brooklyn (Williamsburg, Bushwick, DUMBO), Long Island City, and east
  past Flushing (measured with the pmtiles CLI on 2026-11-16).
- The maps go out first (the maps workflow, run by hand), then the app,
  whose deploy checks the site has them.

### 2. A time zone per region

"Open now" always reads Tokyo time (gotcha 1), so a New York café would
show open or closed 14 hours off.

- **`RegionConfig.timeZone`**: `Asia/Tokyo` for Japan's five,
  `America/New_York` for New York.
- Open now, the card's open/closed line and the "open at" picker
  evaluate in the place's region's zone. `tokyoNow` and friends become
  `regionNow(zone)`; 17 uses.
- Tests run the evaluator for both zones with the machine in a third
  zone, as the Tokyo tests do now, and cover New York's daylight saving.

### 3. Areas: neighbourhoods, boroughs, ZIP codes

Areas assume Japanese addresses: each area has a ward (区), and the
build checks the ward the address names.

- **Areas are neighbourhoods** ("East Village", "Flushing"), with the
  borough as the ward ("Manhattan", "Queens", "Brooklyn").
- **The address check reads the ZIP code**, since a Queens address
  names its neighbourhood, not the borough: Manhattan 100–102, Brooklyn
  112, Queens 110, 111, 113, 114 and 116 (the first three digits).
  `wardFromAddress` tells a US address by its "NY 1xxxx" ending.
- **Area shapes** come from the city's own 2020 Neighborhood Tabulation
  Areas (NTAs, NYC Open Data), not Japan's census blocks. Each New York
  area names its NTAs in config (`nta: ["MN0203"]`), and `npm run areas`
  joins them, as a second source beside e-Stat. The shapes drive Here
  and the Area page.
- **Area sections** are the boroughs, each with a hue.
- **The address column** keeps its name, `Address (JA)`, and holds the
  English street address for New York's rows. Copy name + address works
  as is.

### 4. Credits

Settings adds NYC Open Data for the neighbourhood shapes. The map's
credit (OpenStreetMap, via Protomaps) is already there.

## What just works

The blue dot, the locate button, Nearest, the distances, Nearby,
Directions (coordinates, as now), bookmarks and offline maps take no
change. Station cards and the Lines button don't appear in a region
without our lines.

## The field test

Before leaving: open the installed app on Wi-Fi once, so New York's map
downloads (Settings → Offline shows it ready). Then, in New York:

- **Location:** the blue dot's accuracy on the street; the locate
  button centring and following while walking; the iOS location
  permission in the installed app (gotcha 10).
- **Nearest and distances:** does the list order match what's around
  you, and do the distances look right?
- **Here and + Adjacent:** standing in a neighbourhood, does Here pick
  it, and Adjacent its neighbours?
- **Nearby:** the radius filter while walking.
- **Open now:** against the shops' actual doors.
- **Directions:** the hand-off to Google Maps, transit and walking.
- **Offline:** airplane mode, cold launch from the Home Screen; and
  underground, where the signal drops.

Findings go in `docs/research/nyc-field-test.md`, as notes Jerry sends
during or after the trip.

## Files

- `src/data/types.ts` (`RegionId`, `basemapBuild`, `timeZone`, `nta`)
- `src/config/regions.ts` (New York; Japan's time zone)
- `src/config/basemap.ts`, `scripts/build-basemap.ts`,
  `scripts/check-maps.ts`, `src/offline/basemap.ts`
- `src/hours/open.ts` and its 4 callers, with tests
- `src/data/areas.ts` (ZIP to borough), `src/data/parse.ts`, with tests
- `scripts/build-areas.ts` (NTAs), `public/areas/nyc.geojson`
- `src/ui/settings-sheet.ts` (credit)
- `data/drinks.csv` (the rows, after Jerry reviews the findings)
- `CLAUDE.md` (regions, gotchas 1 and 11), `docs/design/adding-places.md`
  (a US address)

## Plan

- **Today:** this proposal and the coffee findings table, for Jerry's
  review.
- **Tomorrow:** the code changes, the areas, the rows, the maps
  workflow, then the app deploy. Jerry opens the installed app on Wi-Fi
  that evening.
- **After the trip:** decide whether New York stays.
