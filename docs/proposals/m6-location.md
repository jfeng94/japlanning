# M6: Location

Status: **built** (2026-11-04), waiting for the phone pass.

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
