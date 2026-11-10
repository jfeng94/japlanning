# The offline maps on a site of their own

Status: **in progress** (approved 2026-11-10). Steps 1 and 2 done; step
3 is the iPhone check (Results, below).

## Why

Deploys keep failing on GitHub's side. Of the last 60, 52 went through,
and none since 09:30 on 10 November. The 8 failures:

| When | Cause | |
| --- | --- | --- |
| 8 Nov | GitHub returned 504 for the pmtiles tool's download | once |
| 9 Nov ×2, 10 Nov ×4 | Pages stuck at "syncing_files" until the 10-minute timeout | GitHub, likely aggravated by us |
| 10 Nov | The pinned Protomaps build had been deleted | ours; fixed (deploys copy the live maps) |

A stalled deploy shows no progress at all: successful ones publish in 8
to 40 seconds. GitHub's status page stays green, and GitHub publishes
no explanation. The stalls began as the site grew to 116 MB, of which
the five offline maps are 111 MB (Tokyo alone 65 MB). Pages replaces
the whole site on every deploy, so a one-line data fix re-sends all of
it. That's a correlation, not proof, but even if the stalls had another
cause, sending 20 times less on every deploy can only help, and makes
each one quicker.

Waiting longer isn't an option: `deploy-pages` caps its timeout at 10
minutes (2197b0e tried 30 and got a warning and a fourth stall in a
row). GitHub listed incidents with Actions and Pages near the two
stalls of 9 November, and none for the four of the 10th.

## Goal

The maps live on their own GitHub Pages site, deployed only when a map
changes, which is rare (a new build pin or a bigger map box). The app's
deploys carry the app and the data: about 5 MB. Nothing changes on the
phones: maps already downloaded stay, and nobody downloads 115 MB again.

## Done when

- [ ] The five maps are served from the maps site, byte for byte the
      ones live today.
- [ ] The app reads and downloads them from there. On the iPhone: a
      region not yet downloaded shows its map online, and downloads; the
      regions already downloaded stay "ready" without downloading again.
- [ ] A phone can't store a map under the wrong version (see "Keeping
      the two in step").
- [ ] The app's deploy no longer carries the maps, and it refuses to
      ship when the maps site doesn't have the maps its config expects.
- [ ] Changing a map box or the build pin is written down as a two-step
      job in `docs/design/adding-places.md`.

## Design

### The maps site

A second public repo, `jfeng94/japlanning-maps`, with GitHub Pages
deployed by Actions, served at `https://jfeng94.github.io/japlanning-maps/`
(your account's user site has no custom domain, so that's the address;
see Open questions for a subdomain instead).

It holds no code of its own beyond one workflow, run by hand
(`gh workflow run maps.yml -R jfeng94/japlanning-maps`). It checks out
this repo at a given commit, runs `npm run maps` (today's archive half
of `scripts/build-basemap.ts`), and publishes the archives with their
version files (`<region>.pmtiles.json`: build, max zoom, bbox). So the
map config (`src/config/basemap.ts`, the bboxes in `regions.ts`) stays
here, in one place.

`npm run maps` copies a region from the maps site when its version file
matches (as deploys do today from the app's site) and extracts it
otherwise. The very first run has nothing to copy from, so it also
tries today's address (`japan.garbage.house/basemap/`). The five maps
move over byte for byte, with no Protomaps download. That fallback goes
once the move is done.

### The app

- **Where it reads.** The archive's address becomes
  `https://jfeng94.github.io/japlanning-maps/<region>.pmtiles?v=<version>`,
  in `src/config/basemap.ts`. The `?v=` (build, zoom and bbox, short)
  gives each version its own address, so a map that changes under a
  running app is never mixed with the old one's cached index. (The same
  site lets pmtiles see the file's ETag and catch that; another site
  hides the ETag from it.)
- **Nothing is downloaded again.** Phones store each map under its
  region's name, not its address, and register it under whatever
  address the app now uses (`registerStoredBasemaps`). A stored map whose
  version matches stays "ready".
- **The service worker** already ignores requests to other sites, so
  nothing changes there; the `/basemap/` pass-through rule goes.
- **Glyphs and sprites** stay on the app's site: they're small and
  versioned with the style.

### Reading maps from another site: checked

On the live site today (2026-11-10):

- GitHub Pages answers every file with `Access-Control-Allow-Origin: *`,
  which lets a page on another site read it, and serves byte ranges
  (206) as pmtiles needs.
- It answers a browser's permission check (an `OPTIONS` "preflight")
  with 405. So only requests that need no preflight work. A full
  download needs none. A range request needs none when it asks for a
  single range, which is all pmtiles sends: the Fetch standard lists a
  single byte range as a safe header, and WebKit's bug for it (231174)
  is closed as fixed. Chrome 152 fetched a range of today's Nara map from
  `localhost` without trouble. Safari on the iPhone is the one to
  confirm, in step 3.

### Keeping the two in step

Today the app and its maps always deploy together. Split, the app could
expect a new map that the maps site doesn't have yet. That matters
because a phone labels a downloaded map with the version the *app*
expects, not with what the server sent. A phone would then store the
old map labelled as the new one, and keep it for good. Two guards:

1. **The phone checks first.** Before downloading, it fetches the
   region's version file from the maps site and goes ahead only if it
   matches. Otherwise: "This map isn't published yet", and automatic
   downloads try again on the next launch.
2. **The app's deploy checks too.** `npm run check-maps` fetches every
   version file and fails the deploy, saying which workflow to run,
   when one doesn't match the config. So a map change goes: commit the
   config, run the maps workflow, then the app deploys.

## Files

```
docs/proposals/maps-site.md            this
jfeng94/japlanning-maps                new repo: README, .github/workflows/maps.yml
src/config/basemap.ts                  the maps site's address; the version string
src/map/map.ts                         basemapUrl: the maps site, with ?v=
src/offline/basemap.ts, .test.ts       download checks the site's version file first
scripts/build-basemap.ts               split: `npm run assets` (glyphs, sprites) and `npm run maps`; copy source from config
scripts/check-maps.ts                  new: the deploy's version check
package.json                           the three scripts
.github/workflows/deploy.yml           assets and check-maps instead of basemap
src/sw.js                              drop the /basemap/ pass-through
CLAUDE.md                              Hosting, gotchas 3, 8, 11 and 12
docs/design/adding-places.md           changing a map box: two steps
docs/proposals/m7-offline.md           a note on the move
```

## Order of work

1. Create the maps repo and its workflow, turn on Pages, run it. Check
   the five files are byte-identical to today's (SHA-256).
2. Point the app at the maps site, with both guards; deploy. The app's
   site still carries the maps this once, in case of a quick revert.
3. On the iPhone: Settings → Offline, remove Hakone, view it online (the
   cross-site range requests), download it again. Every other region
   should stay "ready".
4. Stop sending the maps with the app: the deploy drops to about 5 MB.
   Remove the first-run fallback. Update the docs.

About 250 lines here, plus the new repo's workflow.

## Out of scope

- **GitHub Releases** for the files: neither the download link nor the
  file it redirects to carries `Access-Control-Allow-Origin` (checked
  2026-11-10), so the browser can't read them from the app's site.
- **Cloudflare Pages**: a 25 MB limit per file; Tokyo is 65 MB.
  **Cloudflare R2** would work, but means a new account and service to
  look after, for no gain over a second Pages site.
- **Keeping the maps in git**: the history would grow by 115 MB per map
  change.

## Open questions

- **The address.** `jfeng94.github.io/japlanning-maps` needs no DNS
  work (recommended). A subdomain such as `maps.japan.garbage.house`
  needs a CNAME record at Squarespace (yours to add) and a certificate
  wait. In exchange, the address no longer depends on how your GitHub
  account's sites are set up. Switching later costs one config line and
  no downloads.
- **Running the maps workflow.** By hand, by me, as a step of "changing
  a map box" (recommended: it's rare). It could run automatically from
  the app's deploy, but that needs a token you'd create and store as a
  secret.
- **Wait first?** If the stalls stop by themselves (GitHub's side
  recovering), this becomes an improvement rather than a fix. Smaller,
  faster deploys are worth having either way.

## Results (steps 1 and 2, 2026-11-10)

- **The maps site is up** at <https://jfeng94.github.io/japlanning-maps/>,
  published by `jfeng94/japlanning-maps` from b5d0d21. Its first run
  copied all five archives from the app's site (nothing from Protomaps),
  and each is byte-identical to the app site's (SHA-256 compared). Its
  publish took 3 minutes; healthy ones take seconds.
- **The app reads it** (`archiveUrl`, with `?v=`). In the pane: maps
  already stored stayed "ready" and drew with no request to the maps
  site; with Hakone's copy removed, the automatic download fetched the
  version file, then the archive, and stored the same 1.76 MB; a source
  with nothing stored drew 213 roads from 7 cross-site range requests.
  No cross-site errors.
- **The guards**: the download checks the version file (tested: missing,
  other build, other box, not JSON all refuse), and the deploy runs
  `npm run check-maps` before building.
- **Not done yet**: the iPhone check (step 3), then dropping the app's
  own copy of the maps (step 4).
