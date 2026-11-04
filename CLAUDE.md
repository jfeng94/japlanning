# Japlanning: project brief for Claude Code

A personal, offline-capable web app for browsing hand-researched locations
(coffee, tea, pastry, restaurants, lodging, points of interest) across Tokyo,
Kyoto and Hakone during a group trip. It replaces Google My Maps for this use
case. Served at https://japan.garbage.house.

Design docs live in `docs/design/`. Milestone proposals live in
`docs/proposals/`. Those are the source of truth for decisions; this file is
the brief and the working agreement.

## Working agreement

Jerry wants to be hands-on with this project. He's an experienced engineer
(C++/OOP background), newer to the modern web/JS ecosystem.

- **Propose before building.** For each milestone, write the proposal to
  `docs/proposals/`, outline the approach and the files you plan to touch,
  then wait for a go-ahead.
- **Prefer small, reviewable diffs** over large generated chunks. Explain
  non-obvious web-platform behavior (service workers, CORS, storage eviction,
  iOS WebKit quirks) when it comes up. Don't assume familiarity.
- When Jerry asks to write something himself, give guidance and review his
  work instead of writing it.
- Decisions marked **(recommended)** are starting points, not mandates. Raise
  trade-offs if you see a better path.
- Design decisions go in the repo, not in chat or external docs. Update the
  relevant doc in the same change that implements a decision.

## Requirements (from Jerry)

1. Browse pinned locations as a **list**.
2. **Filter** by criteria. The same filter state drives both list and map.
   See `docs/design/regions-layers-filters.md`.
2b. **Bookmark** places of interest on the device, and filter to just
   those.
3. Show **current location** (blue dot).
4. **Deep link into Google Maps** for directions.
5. **Copy name + address** to clipboard.
6. **Offline map**: no repeated tile downloads; must work with no signal.
7. **Simple "atlas" basemap**: roads, rail/subway lines, stations, water and
   parks only. **No third-party POIs** (shops, restaurants). Our pins are the
   only POIs.
8. **Multiple location types** (layers), each with its own schema. Only
   coffee is researched so far; the rest must be addable without code changes
   beyond config.
9. **Three regions**: Tokyo, Kyoto, Hakone, in one app.
10. **Group use**: several travellers install the same URL. Lodging is a
    shared quick reference, never private data.

## Devices

- **Primary target: iPhone, installed to the Home Screen from Chrome.** On
  iOS every browser is a skin over Apple's WebKit engine, so Chrome has the
  same capabilities and quirks as Safari. Since iOS 16.4, Chrome's share menu
  can "Add to Home Screen" and the result is a real standalone web app. Once
  installed, the app runs in Apple's standalone web-app container regardless
  of which browser installed it, with service workers, Cache Storage,
  IndexedDB, geolocation and clipboard. The installed app is the acceptance
  target. Offline behaviour in a plain Chrome tab is nice-to-have.
- **Android**: best effort. A correct manifest with maskable icons should be
  enough. Not tested unless someone reports a problem.
- **iPad and desktop**: supported via a wide layout (list beside map, one
  breakpoint around 768px). Build list and map as siblings from the start so
  this is CSS, not a rewrite. iPhone remains the acceptance device.
- No macOS/Xcode available, so this is a web app, not native.

## Data source

Each layer is backed by a Google Sheet that Jerry edits by hand, published to
the web as CSV. A published sheet is readable by anyone with the URL; that's
fine for this data, but **nothing private goes in any sheet**.

The first layer is coffee:

- Drive folder: Japan_2026
- Sheet: **Tokyo Coffee Master**, ID 1eQWY1mCVvzAQ6wcDyk9sC5WNtbyEgH8b-Mvs4AIApxA
- Published CSV: https://docs.google.com/spreadsheets/d/e/2PACX-1vSIp7NVV6JlTMCW2NDTF4cgozZ7zDwdh1YmXjrD82owzZBeAvN-4AN5UmQEJP1f5cdQLEVbOnlNwAs_/pub?output=csv

### Coffee columns (one row per shop)

| Column | Type | Notes |
| --- | --- | --- |
| Name | string | ★ prefix = key branch of a multi-branch brand. Render ★ as a visual flag and strip it for display/sorting if desired. |
| Latitude, Longitude | number | WGS84 decimal degrees |
| Neighborhood | enum | Shared across all layers in a region. Tokyo has 6 values, e.g. Central (Ginza / Jimbocho / Minato) |
| Format | enum | Stand · Café · Kissaten · Tasting bar · Bean shop |
| Roasting | enum | In-house · Guest roasters · Both |
| Food | enum | None · Light · Full menu |
| Linger | enum | Grab & go · Short stay · Settle in |
| Specialty | enum, multi | Light roast / Nordic · Pour-over · Espresso · Dark roast / Kissaten · Multi-roaster · Latte art · Food & sweets |
| Hours | string | Human-readable, may contain caveats |
| Hours (OSM) | string | OpenStreetMap opening_hours syntax, e.g. `Mo-Fr 08:00-19:00; Sa,Su 09:00-19:00; Tu off` |
| Reservation | enum | Required · Optional · No |
| Link | URL | Official site / Instagram |
| Address (JA) | string | Japanese address. **Leading `~` = approximate** (neighborhood-level only) |
| Notes | string | Free text |
| Last verified | date | YYYY-MM-DD; blank = hours unverified |

**Any enum field may be blank (unknown).** Filters treat blank as "unknown"
with an explicit include-unknowns toggle, never as a silent match or
non-match. **Any enum cell may hold several values separated by `;`.**

The loader tolerates new, missing and reordered columns (look up by header
name), since Jerry will keep editing the sheets and other layers have
different schemas.

## Architecture (recommended)

- **Static site on GitHub Pages** at a custom domain. HTTPS is required for
  geolocation, clipboard and service workers. No backend.
- **Vite + TypeScript**, no UI framework unless one is clearly warranted. Keep
  dependencies minimal.
- **MapLibre GL JS** for the map.
- **Protomaps basemap** delivered as one **PMTiles** file per region, styled
  with Protomaps' basemap layers with POI/label layers for shops removed. Keep
  rail lines, stations, major roads, water and parks.
- **CSV parsing** with PapaParse. Cache the last good copy of every layer
  locally so the app works offline and survives a failed fetch.
- **Open-now** via the opening_hours npm package (the reference OSM parser).
- **PWA** (manifest and service worker) for the app shell and offline
  behaviour.

### Why not Google Maps for the basemap?

Google's terms don't allow caching tiles for offline use, the JS API needs a
billing account, and its POI noise is what we're trying to avoid. Google Maps
is used only as the **directions hand-off**.

### Hosting and DNS

- GitHub repo: `jfeng94/japlanning`, public (GitHub Pages on a free account
  requires a public repo; the data is public anyway).
- Deploy with GitHub Actions to Pages.
- DNS is at Squarespace: a CNAME record for `japan` pointing at
  `jfeng94.github.io`, a `CNAME` file in the deployed site, then "Enforce
  HTTPS" in the Pages settings once the certificate issues (can take up to an
  hour).

## Known gotchas (verified or high-likelihood)

1. **Evaluate "open now" in Asia/Tokyo time, always.** opening_hours reads
   wall-clock time from the JS Date's *local* getters. If the device isn't in
   JST (e.g. planning from California), naive use gives wrong answers. We hit
   this when validating the data: a sandbox in UTC reported every shop closed
   at 10:00 JST. Build a Date whose local fields equal Tokyo wall time (or
   otherwise adapt) and unit-test it with a non-JST TZ.
2. **Hours past midnight** (e.g. Fuglen `We-Su 07:00-01:00`) and
   **nth-weekday closures** (`We[3] off`) are already in the data and parse
   correctly. Keep tests for them.
3. **PMTiles uses HTTP range requests**, which service-worker caching handles
   poorly. Preferred approach: download the whole .pmtiles once per region,
   store it as a Blob (Cache Storage or IndexedDB), and read it with the
   pmtiles library's file/blob source. Call `navigator.storage.persist()`.
4. **iOS storage eviction and partitioning.** WebKit may clear storage for
   sites that aren't used for a while; Home Screen web apps fare better. The
   installed app also has its own storage, separate from any browser tab. So:
   install to Home Screen, open **the installed app** once on Wi-Fi before the
   trip, and show an "offline data ready / last synced" indicator per region.
5. **Fonts/glyphs offline.** MapLibre needs glyph PBFs for labels. Self-host
   the few Latin ranges needed. For Japanese text, rely on MapLibre's
   `localIdeographFontFamily` (device CJK fonts) rather than shipping huge CJK
   glyph sets. Verify station names render offline.
6. **Directions deep link:**
   `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=transit`
   opens the Google Maps app on iOS if installed. Using coordinates avoids
   mis-matched place search; the trade-off is that Google shows a dropped pin
   rather than the business name.
7. **Clipboard:** `navigator.clipboard.writeText` needs HTTPS and a user
   gesture. Copy as `Name\nAddress`. If the address starts with `~`, flag it
   as approximate in the UI.
8. **GitHub Pages file limit** is 100 MB per file. Keep each region's extract
   well under that by choosing a tight bounding box and a sensible max zoom.
9. **Node version.** The machine shipped with Node 14. Vite needs Node 20+.
   Use nvm-windows so the upgrade doesn't disturb anything else.

## Basemap extracts (starting point)

- **Tokyo**: central Tokyo covering all current pins, with margin: roughly
  `--bbox=139.60,35.58,139.85,35.75`.
- **Kyoto** and **Hakone**: bboxes TBD once pins exist. Hakone is mountainous
  and sparse; it may want a different zoom range.

Try maxzoom around 15 and measure the file size; MapLibre can overzoom beyond
the max tile zoom. Use the pmtiles CLI's `extract` command against a current
Protomaps daily build. Look up the current build URL and CLI syntax rather
than trusting this note. Do a size experiment early (before M3) so we don't
build on a basemap we later have to shrink.

## Milestones

Each one should end with something Jerry can open on his phone. Each gets a
proposal in `docs/proposals/` before work starts.

- **M0. Skeleton and deploy.** Node upgrade, Vite + TS project, GitHub Pages
  deploy (Actions), custom domain, a page that loads on the iPhone over HTTPS
  and installs to the Home Screen from Chrome.
- **M1. Data layer.** Layer registry and generic loader: fetch each layer's
  CSV, parse into typed records keyed by header name, handle blanks and
  multi-value cells, cache the last good copy, fall back to the cache offline.
  Unit tests with the coffee sheet and a stub second layer.
- **M2. List and filters.** The filter-state module from the design doc, a
  list view with region and layer switching, text search and generated facet
  filters. Show ★ and key facts per row.
- **M3. Map.** MapLibre with an online basemap first (offline comes in M7),
  pins for filtered results coloured by layer, list↔map selection sync,
  ★ pins styled distinctly.
- **M4. Detail card.** All fields, link, Copy name + address, Directions
  button.
- **M4b. Bookmarks.** Mark places you're interested in, from the card and
  the list row, stored on the device (personal, not in the sheet; the
  group doesn't share them). A "Bookmarked only" shared filter shows just
  those on the map and in the list, with a marker on bookmarked pins.
- **M5. Open now.** The "open now" shared filter and "unknown hours"
  handling, on top of M4's Tokyo-time evaluator (the card's Open/Closed
  status and the unverified badge land in M4). Optional: an "open at…"
  time picker for planning ahead.
- **M6. Location.** Blue dot, recenter button, sort list by distance.
- **M7. Offline.** PWA manifest, app-shell caching, per-region PMTiles
  download-and-store, self-hosted glyphs/sprites, storage-persist request,
  offline status indicator. **Acceptance:** airplane mode on the iPhone, cold
  launch from the Home Screen, map, pins, list and filters all work.
- **M8. Atlas styling polish.** Tune the basemap until only roads, rail and
  stations, water and parks remain, and make sure our pins pop.
- **M9. Wide layout.** List beside map on iPad and desktop.

## Open questions

- Framework: vanilla TS (recommended to start), or something like
  Preact/Svelte if the UI grows?
- Unknown-hours behavior in the "open now" filter: hide, show greyed, or a
  toggle?
- Schemas for tea, pastry, restaurants, lodging and POIs: not researched yet.
- Does the iPad need the offline basemap, or is online-only fine there?
