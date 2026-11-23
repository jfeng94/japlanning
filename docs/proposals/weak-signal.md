# Weak signal: launch from the phone, refresh quietly

Status: **done** (2026-11-23). Jerry, after New York (2026-11-22): on
the subway the signal was weak but not gone, and the app loaded very
slowly although its maps and places were saved on the phone.

## What was slow

The maps, subway lines, fonts and sprites already came from the phone
(the stored map Blobs, the service worker's cache), and the places
showed the saved copy before the network one. One thing waited for the
network: **the page itself**. The service worker fetched it
network-first, with no time limit, and fell back to the saved page only
when that request failed. Weak signal doesn't fail fast; it stalls. And
iOS often closes a Home Screen app in the background, so reopening it
is a fresh launch.

Measured in a cloud session's headless Chromium, with the server
answering every request 20 s late after the app was installed ("How to
measure it again", below):

| | Page on screen | List on screen |
| --- | --- | --- |
| Before | 20.0 s | 20.5 s |
| After | 0.04 to 0.2 s | 0.4 to 0.6 s |

## What changed

1. **The page is cache-first** (`src/sw.js`). A launch reads the page
   from the worker's own cache, the one holding the hashed files it
   names; the network only when nothing is cached (a first visit).
   - **New versions** arrive as before: the browser checks `sw.js` in
     the background and the header's update button offers it; tapping
     it, or the next fresh launch, loads the new page. Checked in the
     same harness: a deploy swapped in on the server left the open app
     on the old page until the update was applied, then on the new one,
     with the old cache gone.
   - **Why this is safe now.** M7's first cut served the cached page
     first too, and broke (`m7-offline.md`, "Decisions made while
     building"): then the worker passed `/basemap/` straight to the
     network, map archives and their files under paths each deploy
     replaced, so an old page asked for files the server no longer had.
     Today the worker keeps every file the page names except `/data/`,
     whose paths never change and which the loader handles itself; and
     the page comes from the worker's own cache, not whichever cache
     matches first.
2. **Data refreshes are conditional** (`src/data/load.ts`,
   `src/data/store.ts`). The saved copy of each CSV keeps the server's
   ETag, and the refresh sends it as `If-None-Match`: an unchanged file
   is an empty 304 instead of the whole CSV (about 90 KB for the seven
   layers, gzipped). GitHub Pages answers 304 (checked 2026-11-23). Every
   deploy re-tags every file, so the same text under a new ETag also
   counts as unchanged.
3. **No redraw when nothing changed** (`src/ui/app.ts`). An unchanged
   refresh hands back the saved places array itself, so the app updates
   only the status line, and a slow refresh landing mid-browse doesn't
   redraw the list and pins under your thumb. Checked in the harness:
   the list's rows were the same elements before and after the refresh.

Tests: `src/data/load.test.ts`, "conditional refresh".

## Not done (smaller, optional)

- **Map downloads on weak signal.** After a map changes, the next
  launch with signal downloads it (40 to 65 MB), which on a weak
  connection hogs what bandwidth there is. It could wait until the data
  refresh came back quickly.
- **Location underground.** With no GPS fix, the blue dot and the
  Nearest order wait up to 10 s and give up. A position from the last
  minute or two (`maximumAge`) could stand in until a fix comes.

## How to measure it again

Build (`npm run build`), serve `dist/` from a small Node server that can
hold every request for N ms, and drive Chromium with Playwright: load
the app twice so the worker and the saved data are in place, turn the
delay on, reload, and time until the first `.place-row` appears. Block
the maps site (`--host-resolver-rules`) so the automatic map download
doesn't start.
