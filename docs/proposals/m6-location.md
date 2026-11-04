# M6: Location

Status: **proposed** (2026-11-04). Waiting for go-ahead.

## Goal

Where am I, and what's close. A blue dot on the map with a button that
centres on it and follows, distances on list rows and the card, and a
sort by distance. Nothing is requested until the button is tapped, so
the permission prompt is yours to trigger.

## Done when

- [ ] A locate button in the map's corner (under fit-to-results) asks for
      permission on first tap, then shows a blue dot with an accuracy ring
      and centres the map on it. A second tap toggles following, which a
      pan turns off.
- [ ] Denied permission or no fix within a few seconds shows a toast, not
      a silent nothing.
- [ ] Once a position is known, each list row shows its distance ("350 m",
      "1.2 km") after the neighborhood, and the card shows it in the meta
      line.
- [ ] A sort control (Name / Distance) in the filter sheet; Distance is
      offered once a position exists and becomes the default the first
      time one arrives. The choice is remembered on the device.
- [ ] The dot and distances update as the phone moves, without re-sorting
      the list under your thumb more than once every few seconds.
- [ ] `npm test` covers the distance maths, formatting and the sort.

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

A `sort: "name" | "distance"` preference, stored with the other settings
(`src/config/settings.ts`), shown as a Name / Distance pair in the filter
sheet above the Flags section. Distance is disabled until a fix exists.
The first fix flips the sort to distance once, unless the user had set
Name themselves after that (the setting records "user chose"). The strip
summary shows "by distance" so it's visible why the list order changed.

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
src/ui/settings-sheet.ts              (no change; sort lives in the filter sheet)
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

- **Distance sort becomes the default on first fix** (proposed) vs stays on
  Name until chosen. Default-on matches "what's close" being the reason
  to locate at all.
- **Distance text on rows always, or only when sorted by distance**
  (proposed: always, once known; it's one short number).

## Diff size

About 10 files, roughly 350 lines, a quarter tests.

## Results

(filled in after acceptance)
