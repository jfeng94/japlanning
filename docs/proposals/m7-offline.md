# M7: Offline

Status: **built** (2026-11-07), waiting for the phone pass (airplane mode).

## Goal

Airplane mode on the iPhone, cold launch from the Home Screen: map, pins,
list, filters and cards all work. Nothing is downloaded twice, and the app
says what is on the device and how old it is.

## What is already there

- The manifest, icons and iOS install metadata (M0); the app installs and
  runs standalone.
- The data loader's three tiers (network, IndexedDB cache, bundled copy):
  the list works offline today as long as the page itself loads.
- The basemap as one PMTiles file per region on the site, read by HTTP
  range requests (Tokyo 52 MB, Kyoto 27 MB).

What is missing is the page itself offline (the app shell), the basemap
offline, the map's fonts and sprites offline, and any way to see what the
device holds.

## Three pieces

### 1. App shell: a service worker

A service worker is a script the browser keeps after the page is gone. It
sits between the page and the network, so it can answer requests from a
cache when there is no signal. Ours does one thing: on install it fetches
every file of the built site and stores them in Cache Storage; on a
request for one of those files it answers from the cache first. A new
deploy produces a new worker (the file list changes, since Vite hashes
asset names), which installs in the background; the app shows "Update
ready" and a tap reloads into it.

Two kinds of request pass straight through, by design:

- `/data/*.csv`: the loader already caches data in IndexedDB with its own
  freshness logic; a second cache would hide which copy is in use.
- `/basemap/*.pmtiles`: range requests, which Cache Storage handles badly
  (gotcha 3 in the brief). Piece 2 covers them.

**Hand-written, not a framework (recommended).** `public/sw.js` of about
80 lines plus `scripts/build-sw.ts`, which runs after `vite build` and
writes the list of built files and a version into it. The alternative is
`vite-plugin-pwa` (Workbox under the hood), which does the same with
more features and one more dependency; the brief says keep dependencies
minimal, and a worker short enough to read is worth more here than
Workbox's routing. If it grows past a screen, switch.

### 2. Basemap: download once per region, read from a Blob

The pmtiles library reads an archive through a `Source` with one method,
`getBytes(offset, length)`. Online that is `FetchSource` (range requests).
Offline it is `FileSource` over a Blob stored in IndexedDB, which the
library ships. So:

- An **Offline** section in Settings lists each region with a bbox: its
  size, and one of "not on this device", "downloading 37%", "ready, built
  20261103", "update available". Download fetches the whole file with a
  progress stream and stores it as a Blob in the existing IndexedDB
  database with a sidecar record (build, bbox, byte size, date). Delete
  removes both.
- On launch, and when a region's blob lands, the map's `pmtiles://`
  protocol is given a `PMTiles(new FileSource(blob))` for that region's
  URL. The style is unchanged; only the source behind the URL swaps.
- "Update available" compares the sidecar's build and bbox to the config
  (`BASEMAP.build`, the region's bbox); a new extract in a deploy shows up
  as an update, never silently replaces 50 MB over cellular.
- Before the first download the app calls `navigator.storage.persist()`,
  which asks the browser not to evict our storage under pressure. iOS
  grants it to installed apps; a browser tab may say no, and the section
  says which it got.

### 3. Fonts and sprites: self-hosted

MapLibre fetches glyph files per font and per 256-character range as
labels need them, and one sprite sheet per style flavour, today from
Protomaps' GitHub Pages. Offline they must come from us. The basemap
build step gains a download of the three Noto Sans stacks the style uses
(Regular, Medium, Italic) for the Latin ranges 0 to 1023, and the light
and dark sprites, into `public/fonts` and `public/sprites`, pinned like
the pmtiles CLI. The style's glyph and sprite URLs point at the site, and
the worker precaches them. Japanese labels keep coming from the device's
own fonts (`localIdeographFontFamily`), so no CJK glyphs ship; the phone
pass checks that station names still render in airplane mode.

## Indicator

Settings gains the Offline section above, plus one line for the app
shell ("app cached, version abc123, updated 2026-11-07") and one for the
data ("57 places, synced 2026-11-07 09:14", from the loader's cache
record). The Diagnostics sheet keeps its device capabilities list and
adds the storage estimate (`navigator.storage.estimate()`: used and
quota).

## Files

- `public/sw.js` (new), `scripts/build-sw.ts` (new), the `build` npm
  script runs it after Vite; `src/main.ts` registers the worker and wires
  the update toast; `src/ui/settings-sheet.ts` "reload from scratch"
  already unregisters it.
- `src/map/offline-basemap.ts` (new): download with progress, store,
  delete, status; `src/map/map.ts`: hand the protocol a `FileSource`
  when a blob exists; `src/data/store.ts`: a Blob-capable store beside
  the text store (same database, second object store).
- `scripts/build-basemap.ts`: fetch fonts and sprites; `src/map/style.ts`:
  local glyph and sprite URLs.
- `src/ui/settings-sheet.ts`: the Offline section; `src/ui/diagnostics.ts`:
  storage estimate.
- Tests: the sidecar comparison (update available or not), the
  precache list builder, a `FileSource` round trip over a Blob with a
  real small archive.
- Docs: this file; CLAUDE.md gotcha 3 and 5 marked as done; the design
  doc's regions section (offline per region).

About 10 files, roughly 500 lines, in four steps that each deploy on
their own: fonts and sprites; the worker; the basemap download; the
Settings section and indicator.

## Trade-offs and limits

- **Storage size.** Tokyo plus Kyoto is about 80 MB in IndexedDB. Safari
  allows it; the storage estimate in Diagnostics shows headroom. Hakone
  joins when it has a bbox.
- **iOS eviction.** WebKit may clear storage for sites unused for seven
  days in a browser tab; installed apps with persisted storage are
  exempt in practice. The pre-trip step stays: open the installed app on
  Wi-Fi, download the regions, see "ready".
- **A plain browser tab** gets the same worker and the same downloads,
  in its own partition; the brief treats that as nice-to-have.
- **Updates over cellular.** The worker's precache is a few MB and
  updates itself; basemaps never re-download without a tap.
- **No background sync.** If the data file changes after the pre-trip
  sync, the next online launch picks it up through the loader's network
  tier, as today.

## Done when

- [ ] Airplane mode, cold launch from the Home Screen: map with roads,
      rail and station names, pins, list, filters, cards, bookmarks.
- [ ] A region downloads once with a progress figure and reads from the
      device afterwards; Delete frees it; a new build shows as an update.
- [ ] A new deploy shows "Update ready" and a tap reloads into it.
- [ ] Settings says what the device holds and when it was synced.

## Results (2026-11-07)

Built in four commits, one per piece. 168 tests (7 new: the precache
list rules, the sidecar comparison, a Blob source range read, and the
protocol registration).

Verified in the browser pane against the built site:

- The style loads its sprite and glyphs from the site; nothing is
  requested from the Protomaps host.
- The worker registers on a built site only, precaches 55 files (4.2 MB)
  including the page at "/", and leaves data and basemap paths alone. A
  new build installs beside the old one, the "Update ready" toast
  appears, a tap activates it, the page reloads on it and the old cache
  is deleted.
- Settings → Offline shows the app build, the places count with the sync
  time, the persistence state, and one row per region with its size
  from a HEAD request. Kyoto downloaded (27 MB) with a progress figure
  and reads "ready"; switching to Kyoto afterwards made no network
  request for its archive, so tiles came from the Blob.

Decisions made while building:

- **Navigations are network-first**, with the cached page as the offline
  fallback. The first cut served the cached page first, and an older
  worker then pointed at hashed assets a newer deploy had removed; a
  stale shell is a worse failure than one extra request online.
- **The worker's version** hashes the precached files and the worker's
  own source, so a change to either produces a new worker and nothing
  else does.
- **The map starts with an empty style** and sets the real one after the
  stored archives are registered, a few milliseconds of IndexedDB, so an
  offline launch never asks the network for tiles it has.
- **Mirrored assets are pinned** by SHA-256 in src/config/assets-lock.json
  and verified on every build; PIN_ASSETS=1 rewrites the lock after a
  deliberate change.

For the phone pass: install fresh (the worker needs one online launch),
download Tokyo in Settings, then airplane mode and a cold launch from the
Home Screen: roads, rail, station names in Japanese, pins, list, filters,
cards and bookmarks. Also: the persistence line after the first download
(installed apps should get "persisted"), and the update toast after the
next deploy.

### Addendum (2026-11-08): automatic downloads, the usage figure

The phone pass passed. Two changes after it, both from Jerry:

- **Downloads start by themselves.** On an online launch, once the data
  is in, any region whose archive is missing or outdated downloads in the
  background, current region first, one at a time, through one download
  manager that the Settings buttons share. Manual was only ever a guard
  against cellular surprises, and iOS gives no way to tell Wi-Fi from
  cellular; a setting, "Download maps automatically" (default on), is
  the opt-out. "Outdated" is the existing sidecar check, so a re-download
  happens only when the Protomaps build or a bbox changes in config.
- **The storage figure is ours.** WebKit's `storage.estimate()` reported
  5 MB with 75 MB of archives stored: it leaves IndexedDB Blobs out. The
  Offline section and Diagnostics now show what the app adds up itself
  (archive bytes from the sidecars plus the worker's cache), with the
  browser's estimate kept as a second line, labelled.

### Addendum (2026-11-09): the update as a button

The "Update ready" toast interrupted whatever Jerry was doing. A waiting
update now shows as a button with a blue up arrow, beside Settings in the
header, and nowhere else. It stays until tapped. The tap tells the new
worker to take over and the page reloads on it, as the toast's tap did.

### Addendum (2026-11-10): the maps moved to their own site

The archives are no longer part of the app's site: they're published at
<https://jfeng94.github.io/japlanning-maps/> by the `jfeng94/japlanning-maps`
repo, from this repo's map settings, so the app's deploys don't re-send
110 MB each time (`docs/proposals/maps-site.md`). Stored maps are kept by
region, not by address, so nothing was downloaded again. A download now
first checks the site's version file for the archive, and the app's
deploy checks the site has the maps its config expects. The service
worker never sees the archives (they're on another origin).
