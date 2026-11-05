# M6: Location

Status: **built** (2026-11-04), phone pass done 2026-11-05; **revision proposed** below, waiting for a go-ahead.

## Goal

Where am I, and what's close. A blue dot on the map with a button that
centres on it and follows, distances on list rows and the card, and a
sort by distance. Nothing is requested until the button is tapped, so
the permission prompt is yours to trigger.

## Done when

- [x] A locate button in the map's corner (under fit-to-results) asks for
      permission on first tap, then shows a blue dot with an accuracy ring
      and centres the map on it. A second tap toggles following, which a
      pan turns off.
- [x] Denied permission or no fix within a few seconds shows a toast, not
      a silent nothing.
- [x] Once a position is known, each list row shows its distance ("350 m",
      "1.2 km") after the neighborhood, and the card shows it in the meta
      line.
- [x] A sort control (Name / Distance) in the filter sheet; Distance is
      offered once a position exists. A Settings toggle, "Sort by distance
      when located", off by default, makes the list switch to distance
      order on the first fix; on the trip it goes on, while planning it
      stays off. Both are remembered on the device.
- [ ] The dot and distances update as the phone moves, without re-sorting
      the list under your thumb more than once every few seconds. (Phone
      pass; the pane can't walk.)
- [x] `npm test` covers the distance maths, formatting and the sort.

## Design

### The dot and the button

MapLibre's `GeolocateControl` does the hard part: permission prompt,
`watchPosition`, the dot with an accuracy circle, the centre-and-follow
button states, and `geolocate` / `error` events. We add it in the
top-left stack under the fit button, restyle it to match, and listen to
its events for the position. Options: high accuracy on, `trackUserLocation`
on (follow mode), `showAccuracyCircle` on, and a 10 s timeout.

Why not our own: writing the dot layer and the watch loop is a day, and
the control's handling of follow-mode interruption by panning is the part
people get wrong.

### Position and distances (`src/geo/distance.ts`, pure, tested)

```ts
distanceM(a: {lat,lng}, b: {lat,lng}): number     // haversine, metres
formatDistance(m: number): string                 // "350 m", "1.2 km", "12 km"
sortByDistance(places, from): Place[]             // stable
```

The app keeps `position?: { lat, lng, accuracy, at }` from the control's
events, re-renders on each fix, and throttles list re-sorts to one every
3 s so rows don't jump while walking. Distances on rows come from the
last fix; the card's meta line gets "· 1.2 km away".

### Sort

Two settings in `src/config/settings.ts`:

- `sort: "name" | "distance"`: the current order, shown as a Name /
  Distance pair in the filter sheet above the Flags section (Distance
  disabled until a fix exists) and in the Settings sheet.
- `autoDistanceSort: boolean`, **off by default**: when on, the first fix
  of a session switches `sort` to distance. Off while planning from home,
  where distance to Tokyo means nothing; on during the trip. It lives in
  the Settings sheet as "Sort by distance when located".

The strip summary shows "by distance" so it's visible why the list order
changed.

### Offline and the installed app

Geolocation needs no network; GPS works in airplane mode, Wi-Fi
positioning does not. Permission is per origin and persists in the
installed app. The map's own tiles are M7's business; the dot renders
regardless.

### Files

```
src/geo/distance.ts, .test.ts         new
src/map/map.ts                        geolocate control, events, follow
src/config/settings.ts                sort preference
src/ui/settings-sheet.ts              sort and the auto-switch toggle
src/ui/filter-sheet.ts                Name / Distance
src/ui/filter-summary.ts              "by distance" tag
src/ui/list.ts                        distance on rows
src/ui/detail.ts                      distance in meta
src/ui/app.ts                         position, throttle, sort
src/style.css                         button restyle, distance text
```

No new dependencies.

## Order of work

1. Distance maths, formatting, sort; tests.
2. Geolocate control wired in, position held in the app, toasts for
   denial/timeout. Deploy; phone check of the prompt and the dot.
3. Distances on rows and card; sort control and preference; throttle.
   Deploy.

## Out of scope

Heading/compass orientation of the dot, background location, "notify me
when near a bookmark", distance in the directions link (Google handles
that).

## Open questions

- **Distance text on rows always, or only when sorted by distance**
  (proposed: always, once known; it's one short number).

## Diff size

About 10 files, roughly 350 lines, a quarter tests.

## Results

Built 2026-11-04 in three commits, one per step. 137 tests (3 new:
haversine sanity across Tokyo, distance formatting, stable sort).

Verified in the browser pane at 375×812 with a mocked Geolocation API
(a fix at Jimbocho):

- Tap locate: dot with accuracy ring, map centres at zoom 16, button
  turns blue and filled (following). Every row shows "· 6.4 km" after
  its neighborhood; the card's meta line reads "Coffee · Central … ·
  0 m away".
- Filters → Sort → Distance: Glitch Jimbocho first at 0 m, then
  Nihonbashi 1.6 km, ARC 2.4 km; the strip shows a "by distance" tag;
  the choice is saved on the device.
- "Sort by distance when located" on, relaunch, tap locate: the list
  switches to distance order on the first fix and the Settings sheet
  shows both rows.
- Tap locate while following: control off, dot gone, distances gone,
  list back to name order (the saved preference stays "distance" and
  takes effect again on the next fix).
- Permission denied: toast "Location is off for this app. Allow it in
  the phone's Settings.", button greyed (MapLibre disables it until
  reload).
- Known limit: when permission was denied on an earlier visit, the
  button is greyed from launch (MapLibre asks the Permissions API before
  enabling it) and a tap on it does nothing, with no toast. The fix is in
  the phone's Settings; worth a line in Diagnostics if it bites.

For the phone pass:

- The real permission prompt, inside the installed app, and that it is
  remembered.
- The dot and distances updating while walking; the list shouldn't
  re-sort more often than every 3 s.
- The button artwork on the dark theme (it's a mask filled with the text
  colour, unlike MapLibre's fixed-colour image).

Decisions made while building:

- The fit button became a MapLibre control so both buttons sit in the
  map's own top-left stack with its spacing; no more hand-placed
  absolute positioning.
- The control's button cycle is MapLibre's: off → follow; a pan drops to
  "watching, not following" (hollow blue icon); a tap there follows
  again; a tap while following turns it off. The proposal said "a
  second tap toggles following", which this is, with one more state.
- The `sort` preference lives in the Settings store (localStorage, URL
  override `sort=distance`), not in filter state or the share URL: a
  shared link shouldn't change a friend's list order.
- A timeout toast fires only for the first attempt; after one success
  MapLibre ignores later timeouts (the dot just goes stale/grey).
- With distance order chosen but no fix, the Sort section shows Name
  pressed and "Distance · locate first" disabled, so the sheet always
  says what the list is actually doing.

### Phone pass (2026-11-05, installed app on the iPhone)

- Dot, distances, Distance sort, following and the Settings rows all
  work and feel natural.
- A prompt appeared once more after a force-close and relaunch, but not
  on a second try, so the grant is remembered; the extra prompt was
  probably one of iOS's follow-ups (precise location, or while-in-use
  versus always) rather than the site permission again. Worth watching,
  but not a bug of ours. The app still never requests location on its
  own (rule 3 below), so if a prompt does recur it comes on a tap.
- Jerry's verdict on the control: turning location on and off is a rare
  action and does not belong on a map button. Hence the revision below.

## Revision: location as a setting, locate as centre/lock (proposed 2026-11-05)

### What changes

1. **"Location" is an on/off toggle in Settings** (`location`, default
   on, see trade-offs; a device preference like `sort`). Off stops any watch, drops the
   position (distances gone, list back to name order) and hides the
   locate button. On shows the button.
2. **The locate button only centres and locks.** No off state. Tap:
   centre the map on the position and lock (follow). Tap while locked, or
   pan: unlock, dot stays. While there is no fix yet, the first tap starts
   the watch (the prompt comes here) and centres once the fix lands.
3. **When the toggle is on, the watch starts by itself only if the
   browser already reports permission as granted** (Permissions API,
   which iOS 16+ supports). After an earlier grant the dot is there at
   launch; otherwise it waits for a tap and the prompt comes when you ask
   for it. Never prompt unasked.
4. The denied case becomes simpler: the button stays visible; a tap gets
   the "Location is off for this app" toast and nothing else, every time.
   The greyed-from-launch limit above goes away.

### How

Replace MapLibre's GeolocateControl with our own small control rather
than bending its state machine (its tap cycle ends in OFF, and that is a
private field). Three pieces:

- `src/geo/locate.ts`: a watch wrapper over `navigator.geolocation`:
  `start()` / `stop()`, callbacks for position and error, the
  Permissions-API query, and a `timeout` rule (toast on the first attempt
  only, as now). Unit-tested with a fake geolocation object.
- `src/map/locate-control.ts`: an IControl with the button (idle / locked
  / waiting / error classes, same mask icon), a dot marker and an
  accuracy ring (a circle layer whose pixel radius follows zoom). Lock
  follows new fixes with `easeTo`; a `dragstart` or `zoomstart` from the
  user unlocks.
- `src/ui/app.ts` wiring: start the watch on launch iff `location` is on
  and permission is granted; on the toggle flipping, start or stop and
  show or hide the button; on a tap with no watch, start it. Position
  handling, throttle and sorting stay as they are.

Also: `settings.ts` (`location` key, URL override `location=1`),
`settings-sheet.ts` (the toggle, first in the list), `style.css` (drop the
MapLibre overrides, style our button and dot), `map.ts` (no
GeolocateControl import). Docs: this file, the design doc's Sort section,
CLAUDE.md's M6 line.

About 8 files, roughly 300 lines, a third of it the control replacing
MapLibre's, with tests for the watch wrapper. Deleting the MapLibre
control's CSS overrides pays back some of it.

### Trade-offs

- Default off means a new traveller has to find the toggle before the
  button appears. Default on would put the button there from the first
  launch, with no prompt until it is tapped. Recommended: **on**, since
  nothing happens until a tap anyway; the toggle is there for people who
  never want it. (Jerry's wireframe did not say; this is the one open
  point.)
- Writing our own control means owning the dot and ring. They are
  simple, and it removes the private-field check and the CSS fights with
  MapLibre's control.
