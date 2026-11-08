# M8: Atlas styling polish

Status: **proposed** (2026-11-08), waiting for a go-ahead. Written to be
picked up cold: everything needed is in this file and `src/map/style.ts`.

## Goal

Requirement 7: a simple atlas. Roads, rail and subway lines, stations,
water and parks, and our pins as the only points of interest. Today the
style is Protomaps' full basemap with two layers removed (buildings,
address labels) and the POI layer filtered to stations, ferry terminals
and aerodromes. That is close, and it still carries a lot the trip does
not need: landuse tints for hospitals, schools, industry and zoos,
one-way arrows, road shields, minor road labels, country and region
boundaries, ocean and island labels. Pins compete with all of it.

## What the style produces today

`atlasLayers()` runs `@protomaps/basemaps`' layer list through two rules.
The list, in draw order (fills, then lines, then symbols):

- fills: background, earth, landcover, landuse (park, urban green,
  hospital, industrial, school, beach, zoo, aerodrome, runway,
  pedestrian, pier), water, buildings (dropped)
- lines: tunnels, roads by class with casings, rail, boundaries, bridges,
  runways and taxiways, streams and rivers, piers
- symbols: address labels (dropped), waterway labels, one-way arrows,
  minor and major road labels, shields, ocean, island and lake labels,
  POIs (filtered), place labels (subplace, locality, region, country)

## Rules (recommended)

Keep the mechanism, extend the lists, add a third rule for paint. All in
`src/map/style.ts`, pure, with `style.test.ts` asserting the layer set.

1. **Drop**: `landuse_hospital`, `landuse_industrial`, `landuse_school`,
   `landuse_zoo`, `boundaries`, `boundaries_country`, `roads_oneway`,
   `roads_shields`, `roads_labels_minor`, `water_label_ocean`,
   `earth_label_islands`, `places_country`, `places_region`. Keep
   `places_locality` and `places_subplace` (ward and district names are
   how the group orients) and `roads_labels_major`.
2. **Keep and calm**: landcover and the remaining landuse fills at lower
   opacity so parks read as parks but nothing else draws the eye; road
   casings one notch thinner at zoom 14 and below; `roads_minor_service`
   hidden below zoom 15.
3. **Rail and stations forward**: `roads_rail` above all road layers
   (move it after `roads_bridges_highway`), darker and a touch wider in
   both flavours, so the subway reads as the skeleton of the map; the
   `pois` layer keeps only `station` (ferry terminals and aerodromes are
   not where coffee is) with a larger station glyph and the name always
   on, in the device CJK font for Japanese.
4. **Pins pop**: the DOM pins already lift off with a shadow; the SDF
   pins get a slightly wider halo. Check both renderers against the
   calmed background in light and dark.
5. **Dark flavour** gets the same list; Protomaps' dark palette does most
   of the work, and the one thing to check is rail contrast.

The place to tune by eye is the pane at zooms 12, 14 and 16 around
Shibuya (dense) and Uji (sparse), light and dark, before and after.
Protomaps' layer ids are stable across the `@protomaps/basemaps` 5.x
line; the test pins the list so an upgrade that renames one fails loudly.

## Not in scope

- A different tile source or a custom extract schema; the Protomaps
  layers are enough once filtered.
- Per-region zoom ranges (Hakone may want them; it has no bbox yet).
- Label language switching; English with local fallback stays.

## Files

- `src/map/style.ts`: the three rule sets (drop, paint overrides by
  layer id, rail reorder), applied in `atlasLayers()`.
- `src/map/style.test.ts`: the kept and dropped ids, the rail position,
  the station-only POI filter.
- `src/map/pins-sdf.ts`: halo width.
- Docs: this file; CLAUDE.md milestone line.

Roughly 120 lines, one commit, half a day with the eye-tuning. Nothing
changes offline: the archives already hold every layer; the style only
decides what to draw.

## Done when

- [ ] At zoom 14 over Shibuya only roads, rail, stations, water, parks and
      our pins are visible; no shields, arrows, boundaries or building
      footprints, in both flavours.
- [ ] Station names render in Japanese in airplane mode (device font).
- [ ] Pins are the most prominent thing on the map at every zoom.
- [ ] `style.test.ts` names every kept and dropped layer.
