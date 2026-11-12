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
2. **Filter** by criteria: what (layer and kind), where (areas, Here,
   + Adjacent) and flags (bookmarked, open, nearby, key branches), on two
   pages in the strip, with search for anything specific (2026-11-09).
   The same filter state drives both list and map. See
   `docs/design/regions-layers-filters.md`.
2b. **Bookmark** places of interest on the device, and filter to just
   those.
3. Show **current location** (blue dot).
4. **Deep link into Google Maps** for directions.
5. **Copy name + address** to clipboard.
6. **Offline map**: no repeated tile downloads; must work with no signal.
7. **Simple "atlas" basemap**: roads, rail/subway lines, stations, water and
   parks only. **No third-party POIs** (shops, restaurants). Our pins are the
   only POIs.
8. **Multiple location types** (layers), each with its own schema, addable
   without code changes beyond config. Six so far (2026-11-09): drinks,
   sweets, food, music, shops, activities.
9. **Regions**: Tokyo, Kyoto, Osaka, Nara, Hakone, in one app (Osaka and
   Nara joined 2026-11-09 as day trips; Uji counts as Kyoto).
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

Each layer is one CSV file in the repo, `data/<layer-id>.csv`, the source
of truth (decided 2026-11-05, see `docs/proposals/data-in-repo.md`; the
layers began as Google Sheets Jerry edited by hand, and the original
**Tokyo Coffee Master** sheet in the Japan_2026 Drive folder is now a
read-only reference). The site is public, so **nothing private goes in
any data file**.

Workflow (`docs/design/adding-places.md`: research, a findings table
Jerry reviews, then the rows): Jerry says what to add or change; Claude edits the CSV, runs
the tests (which parse the real file), commits naming the places, pushes;
Actions validates it again (`npm run snapshot` fails on any parse
warning) and deploys. `npm run ids` prints the next free ID.
`npm run import -- <layer-id> [<csv url or file>]` normalises an external
CSV into the repo file (assigns missing IDs, moves a ★ prefix into Key,
fixes column order and quoting); with no source it round-trips the file.

**Subway lines** (2026-11-10, `docs/proposals/m8-transit.md`):
`public/transit/<region>.geojson`, every Tokyo and Kyoto subway line in
its official colour along its real route, with its stations, generated
by `npm run transit`.
- **The track** comes from the map's own zoom-15 tiles; the colours and
  letters from `src/config/transit.ts`.
- **Which lines stop where** comes from OpenStreetMap's route stop
  lists, fetched once from Overpass and cached in `.cache/transit/`.
- **Committed and cached offline**, like the area shapes.
- **Rerun it after a map change** (adding-places.md, "Changing a map
  box").
- **The map's Lines button** hides or shows lines one by one,
  remembered on the device.
- **Hidden on the Area page**, with the Lines button: the lines made
  that map too busy (2026-11-10).
- **They replace the basemap's rail and station names** in Tokyo and
  Kyoto; the station names there are ours.
- **Shared track and renamed platforms** are handled in the config and
  the build: the Mita runs on the Namboku's track to Meguro (`shares`,
  drawn dashed), and 新線新宿 is part of Shinjuku (`RENAMED`).
- **Stations are tappable** (2026-11-10): a card with the lines that
  stop there and Directions, opened like a place's (`station:` ids in
  the selection and the URL). Stations never join the list or search.
- **Station codes and first and last trains** come from ODPT, built by
  `npm run stations` into `public/transit/<region>.stations.json`, with
  each line's station order for the card's arrows.
  - Run it after `npm run transit`, and again before the trip, since
    the licence asks us to keep up with timetable changes.
  - Toei's data is public. Tokyo Metro's needs Jerry's developer token
    in the `ODPT_TOKEN` environment variable, never in the repo; until
    then its lines have no times and use OpenStreetMap's order.
  - The card credits the source and says ODPT isn't responsible for
    accuracy. Settings gives the repo's issues page as the app's
    contact.
  - Amenities (elevators, lockers, toilets, escalators) come next.
  - **Pick-up note:** `docs/research/stations-odpt-state.md` says
    what to do when the token arrives and what ODPT's guideline still
    asks (the fetch date on the card, a contact address).
- **The card's arrows step along one line.**
  - The card's header shows the station's line badges before its
    name; the followed one sits on a box tinted in its colour, the
    header takes the same tint, and the map's ring around the station
    takes that colour. The body's first line reads "Subway station ·
    門前仲町" (2026-11-11).
  - Stepping keeps the line through interchanges. Tapping a badge or a
    line's row switches it. A station tapped on the map starts on its
    first line.

**Area shapes** (2026-11-09): `public/areas/<region>.geojson`, one shape
per area chip, generated by `npm run areas` from e-Stat's 2020 census
blocks (downloaded once into .cache/estat) and committed. Here goes by
them, and the Area page's map draws them, each in a shade of its
section's hue (`src/config/area-colors.ts`; `areaSections[].hue` in
regions.ts). A new raw area or merge means rerunning it: follow
"Adding an area" in `docs/design/adding-places.md` (decide the areas in
one table, rebuild, review on the Area page; tests check the shapes,
the sections and the map box). See
`docs/proposals/filter-pages-and-area-map.md`.

The first layer is **drinks** (`data/drinks.csv`): coffee, tea and bars
in every region, one row each, with `Kind` saying which, `Region` saying
where and `Icon` picking the artwork (decided 2026-11-05, see
`docs/proposals/drinks-layer.md`). A layer is one location type; its
rows carry the region.

**Sweets, food, music, shops and activities** joined 2026-11-09 from
Jerry's trip list (`docs/design/regions-layers-filters.md`, "Layers"):
the same core columns, a `Kind` where the layer has kinds (Sweets: Pastry
· Wagashi · Ice; Music: Café · Shop · Concert; Shops: Kitchen · Baking ·
Games), and a **Type** facet saying what the place is ("Kakigori",
"Ramen; Tsukemen"), multi-valued from the layer's list. Food's kinds
(Ramen, Katsu, Donburi… 17 of them, 2026-11-10) come from its Type
instead of a Kind column: `FOOD_KINDS` in `src/config/layers.ts` groups
the types under each kind (`docs/proposals/food-kinds.md`). Places still
waiting for fitting pin art use the `question` icon. The list's research
gaps are in `docs/research/audit-queue.csv`.

**Auditing** (2026-11-10, `docs/design/auditing-places.md`): the goal is
every place scrubbed before the trip (the right shop, open, an exact
address with the pin at the door, known hours, a note in the
recommendation voice). `npm run audit` prints each region's scorecard
and what's next. Claude runs audit passes a region at a time, settling
what the evidence settles. `/audit` (`.claude/skills/audit/`) works
through what needs Jerry one place at a time, from
`docs/research/audit-decisions.md` and the queue.

### Drinks columns (one row per place)

| Column | Type | Notes |
| --- | --- | --- |
| ID | integer | Stable id, assigned by hand, unique within the sheet. Bookmarks and share links key on it, so it never changes. `npm run ids` prints problems and the next free one; the build fails on a blank, non-integer or repeated ID. |
| Name | string | The brand. An older ★ prefix still marks a key branch and is stripped for display. |
| Branch | string | Which branch, when the name alone is ambiguous ("Yakumo"). Shown muted after the name; searched. |
| Key | boolean | ★ or a checkbox (TRUE) = the key branch of a multi-branch brand, shown as a star. Blank = no. |
| Region | enum | Region id: tokyo · kyoto · osaka · nara · hakone. Required; a bad value fails the build. |
| Kind | enum | Coffee · Tea · Bar (the layer's `kinds`); several allowed, e.g. `Coffee; Bar`. Required: the build fails on a blank or unknown one. The category chips under Drinks on the Filters page, and under the card's name in the header. |
| Icon | enum | Pin artwork from the global icon enum (src/config/icons.ts): coffee · tea · bar. Blank = the layer default (coffee). |
| Latitude, Longitude | number | WGS84 decimal degrees |
| Area | enum | The raw area the place is in, as a visitor would name it (Shibuya, Ningyocho): one of its region's areas in `src/config/regions.ts`, in the ward its address names. The build fails on a blank or unknown one, or one in another ward than the address. Merges in config fold raw areas into the filter chips; see `docs/proposals/filters-and-areas.md`. |
| Format | enum | Stand · Café · Kissaten · Tasting bar · Bean shop |
| Roasting | enum | In-house · Guest roasters · Both |
| Food | enum | None · Light · Full menu |
| Linger | enum | Grab & go · Short stay · Settle in |
| Specialty | enum, multi | Light roast / Nordic · Pour-over · Espresso · Dark roast / Kissaten · Multi-roaster · Latte art · Food & sweets |
| Hours | string | Human-readable, may contain caveats |
| Hours (OSM) | string | OpenStreetMap opening_hours syntax, e.g. `Mo-Fr 08:00-19:00; Sa,Su 09:00-19:00; Tu off` |
| Reservation | enum | Required · Optional · No |
| Link | URL | Official site / Instagram |
| Address (JA) | string | Japanese address. **Leading `~` = approximate** (area-level only). Always names its ward (区) or city, which the build checks against the Area. |
| Notes | string | Free text |
| Last verified | date | YYYY-MM-DD; blank = hours unverified |
| Google rating, Google reviews, Rated on | number, integer, date | A dated snapshot of the Google Maps rating and review count, taken by hand from an aggregator that mirrors Google (no Places API key, decided 2026-11-05). Blank when none was reachable. Shown in the card's "Also in the sheet" section until there is UI for it. |

**Any enum field except Region, Area and Kind may be blank (unknown).**
Blank beats a guess. Format, Roasting, Food, Linger, Specialty and
Reservation are not filters (decided 2026-11-09,
`docs/proposals/filters-and-areas.md`): they show on the row and the card,
and search matches them. **Any enum cell may hold several values
separated by `;`.**

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
- The repo was recreated on 2026-11-05 after GitHub's storage for the
  original rejected every ref write for hours ("fatal error in commit_refs"
  from spokes-receive-pack; objects uploaded, the ref update failed). The
  original lives on as `jfeng94/japlanning-old` with its Pages site removed
  and can be deleted. The custom domain moved over without a DNS change,
  since the CNAME points at the account, not the repo.
- DNS is at Squarespace: a CNAME record for `japan` pointing at
  `jfeng94.github.io`, a `CNAME` file in the deployed site, then "Enforce
  HTTPS" in the Pages settings once the certificate issues (can take up to an
  hour).
- **The offline maps have their own site** (2026-11-10,
  `docs/proposals/maps-site.md`): the public repo `jfeng94/japlanning-maps`
  publishes them at <https://jfeng94.github.io/japlanning-maps/>, from this
  repo's map settings, by a workflow run by hand
  (`gh workflow run maps.yml -R jfeng94/japlanning-maps -f ref=<commit>`).
  The app's deploy checks that site has the maps its config expects
  (`npm run check-maps`) and fails otherwise. GitHub Pages lets other
  sites read its files (`Access-Control-Allow-Origin: *`) and serves byte
  ranges, but answers a preflight with 405; pmtiles' single-range requests
  need none.

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
   poorly. Done in M7 (2026-11-07): the archives live on the maps site
   (see Hosting), another origin, which the worker never sees; each
   region's archive is downloaded whole, by default automatically on
   an online launch when missing or outdated ("Download maps
   automatically" in Settings, else by hand in Settings → Offline), after
   checking the site's version file matches, kept as a Blob in IndexedDB
   under the region's id with a build/bbox sidecar, and read through a
   Blob-backed pmtiles Source registered under the archive's URL (which
   carries the version, `?v=`).
   `navigator.storage.persist()` is asked before the first download.
   WebKit's `storage.estimate()` does not count those Blobs; the app adds
   up its own usage.
4. **iOS storage eviction and partitioning.** WebKit may clear storage for
   sites that aren't used for a while; Home Screen web apps fare better. The
   installed app also has its own storage, separate from any browser tab. So:
   install to Home Screen, open **the installed app** once on Wi-Fi before the
   trip, and show an "offline data ready / last synced" indicator per region.
5. **Fonts/glyphs offline.** MapLibre needs glyph PBFs for labels. Done in
   M7: `npm run assets` mirrors the three Noto Sans stacks (Latin ranges
   0–1023) and the sprites into the site, pinned in
   `src/config/assets-lock.json`, and the worker precaches them. Japanese
   text uses `localIdeographFontFamily` (device CJK fonts); the airplane-mode
   pass checks station names.
6. **Directions deep link:**
   `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=transit`
   opens the Google Maps app on iOS if installed. Using coordinates avoids
   mis-matched place search; the trade-off is that Google shows a dropped pin
   rather than the business name.
7. **Clipboard:** `navigator.clipboard.writeText` needs HTTPS and a user
   gesture. Copy as `Name\nAddress`. If the address starts with `~`, flag it
   as approximate in the UI.
8. **GitHub Pages file limit** is 100 MB per file, on the maps site as
   anywhere. Keep each region's extract well under that by choosing a
   tight bounding box and a sensible max zoom (Tokyo is 65 MB).
9. **Node version.** The machine shipped with Node 14. Vite needs Node 20+.
   Use nvm-windows so the upgrade doesn't disturb anything else.
10. **Location in the installed app goes through Safari's settings in
   iOS.** A Home Screen app runs in Apple's web-app container, not in the
   browser that added it, so two Safari settings decide, even for an app
   added from Chrome. Either refuses at once with no prompt (error code
   1) while the same site in a Chrome tab works. Location Services →
   Safari Websites on Never refuses every web app. Settings → Apps →
   Safari → Location on Ask can keep refusing a site after an earlier
   "Don't Allow" without asking again; Allow fixes it (Jerry's phone,
   2026-11-10). The refusal is kept outside the app, so re-adding it
   doesn't help, and `navigator.permissions` can still say "prompt". The
   "blocked" toast opens Diagnostics, whose Location section lists the
   settings to check for the way the app is running and can test them
   (`src/geo/location-help.ts`).
11. **Protomaps keeps only about a week of daily builds.** The maps
   workflow copies each region's map from the maps site while the pinned
   build, zoom and bbox are unchanged (`npm run maps`), so the pin can be
   older than that. Changing any of the three extracts again: set `build`
   in `src/config/basemap.ts` to a current build in the same commit (the
   script names the newest when the pin is gone), then publish the maps
   before the app deploys ("Changing a map box" in
   `docs/design/adding-places.md`). Every region is then re-extracted and
   installed apps download about 115 MB of maps again. Re-extracting on
   every deploy broke the deploy on 2026-11-10.
12. **GitHub Pages sometimes stalls at "syncing_files".** The build
   passes, then `deploy-pages` waits on Pages until its 10-minute
   timeout, which can't be raised (a longer `timeout` is capped at 10
   minutes, with a warning). A healthy publish takes 8 to 40 seconds. It
   hit 2 deploys on 2026-11-09, around GitHub incidents with Actions
   and Pages, and 4 in a row on 2026-11-10 with none listed. The site was
   about 120 MB of maps, re-sent on every deploy; the maps now have their
   own site, deployed only when a map changes, so app deploys are about
   5 MB (`docs/proposals/maps-site.md`, done 2026-11-10). If it
   still stalls: push an empty commit ("Redeploy: …"); a re-run reuses the
   stalled deployment's id (the commit) and stalls again. Once
   (2026-11-10, a0f94d8) a push started no deploy at all, though it
   reached GitHub. `gh workflow run deploy.yml --ref main` started one.
   When watching a deploy, wait for the run whose commit is the one
   pushed: the latest run listed can still be the previous push's.

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
- **M6. Location.** Blue dot, a locate button that centres and locks (our
  own control, not MapLibre's), a Location on/off setting, sort list by
  distance.
- **M7. Offline.** PWA manifest, app-shell caching, per-region PMTiles
  download-and-store, self-hosted glyphs/sprites, storage-persist request,
  offline status indicator. **Acceptance:** airplane mode on the iPhone, cold
  launch from the Home Screen, map, pins, list and filters all work.
- **M8. Atlas styling polish.** Tune the basemap until only roads, rail and
  stations, water and parks remain, and make sure our pins pop. Part 2
  (2026-11-10): the subway lines in their colours, with a Lines toggle,
  and tappable stations with a card; the card's train times and
  amenities come next (`docs/proposals/m8-transit.md`).
- **M8b. Day timetable** (added 2026-11-10; details to settle in its
  proposal). A per-day view of the trip's fixed points, such as "check
  out of X by 11:00", "reservation at 19:00" or "Sunnie's flight lands".
  It behaves like the Google Calendar app's day view, which Jerry showed
  as a screenshot:
  - the date at the top, with all-day items in a band under it;
  - an hour grid below, with timed items as blocks spanning their
    duration;
  - a way to step between days, and a jump back to today.

  It opens on today's date (Tokyo time). Open questions for the
  proposal:
  - **Where the entries live.** The site is public, so a flight time
    with a name in a data file is public too. Options: first names only,
    like Lodging's Who, or kept off the public site.
  - **Whether an entry links to its place's card**, a reservation to
    its restaurant for example.
  - **How it relates to M10's trip.**
- **M9. Wide layout.** List beside map on iPad and desktop.
- **M10. Trip planner** (after the main milestones; icon in
  `src/ui/icons/trip.webp`). Each card gets "Add to trip" / "Remove from
  trip". A trip button in the header swaps the list for the trip's places
  in a re-orderable list (remove from there too); the map shows only those
  places with arrows along the route; a Directions button opens Google Maps
  with the stops in order. Maybe several named trips, saved on the device
  like bookmarks. Known limit: Google's directions URL takes waypoints for
  walking, cycling and driving but not transit, so a transit trip opens as
  a sequence of legs or as walking directions; to be decided then.

## Wishlist (not scheduled)

- **A separate theme layer** (Jerry, 2026-11-10), so the app can be
  re-skinned in one place. Today the look is spread around:
  - pin artwork and UI icons (`src/map/icons/`, `src/ui/icons/`, picked
    in `src/config/icons.ts` and imported where used);
  - colours (CSS tokens in `src/style.css`, layer and line colours in
    config, area hues);
  - map paint (`src/map/style.ts`, `src/map/transit-layers.ts`).

  The idea is one theme module that names every asset and colour, which
  the rest reads, so swapping the art (the icons are found images; see
  the README) or the palette is a single change.

- **One pin for places that share a spot** (Jerry, 2026-11-10). Shops in
  one building, and above all in station malls (Tokyo Station, Tokyu Food
  Show in Shibuya), stack their pins on top of each other, so only the top
  one can be tapped.
  - **The idea:** a combined pin for a stack that shows how many it
    holds. Tapping it opens a small widget listing them, and choosing one
    selects that place.
  - **To decide when it's picked up:** what counts as "the same spot" (a
    few metres? the same pixels at the current zoom?), and how the
    combined pin looks.
  - The research doc counts 17 spots holding 44 places (as of the
    import).

- **A "pin proxy"** (Jerry, 2026-11-11): a pin you drop on the map that
  stands in for your location, so the list's Nearest order and the
  distances on rows and cards are measured from it. For planning ahead
  (what's near the hotel, or near where we'll be after lunch) and for
  when the phone has no fix.
  - **Today** all of that reads the device's position
    (`docs/design/regions-layers-filters.md`, "Sort" and "Area"); while
    the pin is down, it would read the pin instead.
  - **To decide when it's picked up:**
    - how to drop and move it (a long press on the map, a button, a
      drag) and how to clear it;
    - how it looks next to the blue dot;
    - whether Nearby and Here follow it too, or only the order;
    - whether it can sit on a place or a station ("near this café");
    - whether it's remembered on the device or travels in a share link
      (Here and Nearby travel as themselves today, not as where the
      sender stood).

- **Images in the card.** A sheet column of Drive image references; a
  build step that downloads, resizes to ~800 px and converts to WebP under
  the site with a manifest per place; a thumbnail row on the card with an
  in-app lightbox (pinch, swipe, close) so nobody leaves the app to see a
  menu; in M7, viewed images cached as you go plus a "download all images"
  with a size estimate. Deferred 2026-11-04; roughly two to three days.

## Open questions

- Framework: vanilla TS (recommended to start), or something like
  Preact/Svelte if the UI grows?
- The 2026-11-09 layers (sweets, food, music, shops, activities) are a
  first cut from Jerry's trip list: are those the right splits and kinds?
  Lodging's schema is still to come.
- Does the iPad need the offline basemap, or is online-only fine there?
