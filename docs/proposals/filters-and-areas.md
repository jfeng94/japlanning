# Filters and areas

Status: **proposed** (2026-11-09), waiting for a go-ahead.

## Why

The filter sheet grows with every layer and every facet. Format,
Roasting, Food, Linger, Specialty and Reservation are six sections for
one layer, and their chips recount, grey out and (for Specialty) appear
and disappear as other chips are tapped. With food, shopping and
attractions coming, that is a menu to wade through, and the cascade
makes it hard to predict what a tap will do.

The neighborhoods have the opposite problem: six clusters per region
("Shibuya / Omotesando / Harajuku") that are too coarse to be useful on
the street and arbitrary at the edges.

Jerry's direction (2026-11-09): a short, stable sheet that sets the
macro filter (what, where, when), and the search box for anything
specific.

## The sheet, top to bottom

### 1. Flags (narrow the results)

- **Bookmarked**
- **Open now**, or **Open at** a day and time (the M5 pickers stay;
  weekday closures make the day matter)
- **Key branches**

Each one on narrows the results (AND). Places with unknown hours stay in
under Open now, sunk to the end of the list with the "?" marker, as
today; the "Include unknown hours" toggle goes.

### 2. Areas (where)

- **Here**: the area you are standing in. Shown when Location is on;
  tapping it with no fix yet starts locating, like the locate button.
  Follows you as you walk, re-evaluated with the 3 s position throttle.
- One chip per area in the region: nearest first when there is a fix,
  alphabetical otherwise.
- **Include nearby areas**: a switch under the chips that adds each
  selected area's neighbours (one hop in the adjacency graph). Pulled-in
  neighbours get a dotted outline so the result count is explainable,
  without becoming selected.

Selected areas are a union; none selected means everywhere.

### 3. Categories (what)

Layers become category headers, their kinds become the chips:

- **Drinks**: Coffee · Tea · Bar
- **Food**: Ramen · Yakitori · Tempura · … (when the food layer lands)
- **Shopping**, **Attractions**, **Lodging**: the same pattern

Every selected chip is a union: Coffee + Ramen shows all coffee and all
ramen. The header chip selects or clears all of its kinds. None selected
means everything.

### 4. Order

The Name · Distance pair stays as the last row; it goes with Here more
than with Settings.

### What leaves the sheet

Every facet section, the include-unknown toggles, the per-chip counts and
the "pick a single layer" note. The facets stay in the data, in the row
chips and in the card's Details; the search box now matches them (see
below), so "pour-over" or "kissaten" finds them in one step.

### The rule this sets

**Filters do not cascade.** Nothing in the sheet appears, disappears,
greys out or recounts because of another selection. The feedback is the
result count in the header; an empty result shows "Nothing matches" with
Clear filters, as today. "Here" depends on your position, not on other
chips, so it is the one chip whose state can change by itself.

## The algebra

```
shown = places in the region
  ∩ (no category chips ? all : ∪ selected (layer, kind))
  ∩ (no area chips and not Here ? all
       : area ∈ selected ∪ {here} ∪ (nearby ? their neighbours : ∅))
  ∩ every flag that is on
  ∩ text match
```

Text matches the name, branch, area, kind, notes, every facet value and
the Japanese address.

## Areas

**"Area", not neighborhood** (recommended). It is short, it is how
Japanese guides and signs talk (渋谷エリア), and it has no administrative
meaning. "District" in Tokyo English is used for wards (区) as well,
which are far coarser: Shibuya ward holds Shibuya, Harajuku, Ebisu,
Tomigaya and Hatagaya.

An area is a place name visitors use, sized so a few minutes' walk
covers it. Areas are defined per region in config with their
neighbours:

```ts
interface AreaConfig {
  label: string;          // "Shibuya"; also the value in the data's Area column
  adjacent: string[];     // labels; the graph must be symmetric
}
```

Only areas with places are defined; a new place in a new area adds the
area in the same commit (the adding-places workflow already lists
"anything the config lacks"). An area's centre is the centroid of its
places, computed at load, so there are no coordinates to maintain; "Here"
is the area with the nearest centre, provided you are inside the region's
bounding box and within 2 km of it. Near a border "Here" may pick the
other side; with Include nearby on, that stops mattering.

A test checks that the graph is symmetric and names only defined areas.
The build fails on a row whose Area is blank or not in its region's
list, the same as an unknown Region.

The draft for the current 74 places is in the appendix: 30 areas in
Tokyo, 7 in Kyoto, many with a single place today. That is the price of
specific areas; nearest-first ordering and Here keep the list short in
practice, and any pair that feels too fine can merge.

## Data and config changes

- `data/drinks.csv`: the **Neighborhood** column becomes **Area**, every
  row re-assigned from its Japanese address (town and chome map to an
  area). The assignments go through the usual findings table before they
  are written.
- `LayerConfig` gains `kinds: string[]`, read from each layer's **Kind**
  column, which becomes required (blank or unknown fails the build). Kind
  leaves `facets`; the card's meta line shows it ("Drinks · Coffee ·
  Shibuya · 1.2 km away").
- `RegionConfig.neighborhoods` becomes `areas: AreaConfig[]`.
- `FacetConfig.scopeBy` goes, with nothing left to scope.
- Filter state: `layers`, `neighborhoods`, `facets` and
  `includeUnknownHours` give way to `categories`, `areas`, `here` and
  `nearby`. The URL carries `c=` (categories), `a=` (areas), `here=1`,
  `nb=1`; old filter links stop applying, place links are unaffected.

## Steps, each deployable

1. **Areas.** Config with the adjacency graph, the Area column and its
   validation, the data migration (findings first), the area shown on
   rows and the card. The existing Neighborhood section shows the new
   areas until step 2 replaces it.
2. **The sheet.** New filter state, algebra and URL; the sheet and the
   strip's summary tags rebuilt as above; Here and Include nearby; the
   wider search; facet filtering removed.
3. **Cleanup and docs.** Dead code out (facet counts, scoping, unknown
   toggles); the design doc's filter model rewritten with the no-cascade
   rule; CLAUDE.md's requirement 2, column table and open questions
   updated.

Roughly 900 lines touched, about half of them deletions; the filter
tests are largely rewritten. One known effect: a phone whose first
launch after the deploy is offline reads its cached copy of the data
with the old column, so areas are blank until it next goes online.

## Open points

1. **Area** as the term (recommended) or District.
2. **Bar** or **Cocktails** for the third drinks kind. Bar covers sake,
   wine and whisky bars too; no bar rows exist yet, so either is free.
3. The **Order** row in the sheet (recommended) or only in Settings.
4. The **area draft** below: merges, splits, names, neighbours.

## Done when

- [ ] The sheet shows flags, areas and categories only; no chip changes
      because another was tapped.
- [ ] Here picks the right area on the phone in Tokyo (checkable by
      faking a position at home), and Include nearby adds the
      neighbours with dotted outlines.
- [ ] Coffee + Tea + Shibuya + nearby gives the union of both kinds
      across Shibuya and its neighbours.
- [ ] "pour-over" in search finds the pour-over places.
- [ ] Every row has an area; the build fails on a blank or unknown one.

## Appendix: draft areas

### Tokyo (61 places)

| Area | Places | Nearby |
| --- | --- | --- |
| Aoyama | Latte Art Mania | Shibuya, Omotesando, Azabudai |
| Asakusa | Fuglen, Hatoya | Kuramae, Oshiage |
| Azabudai | Ogawa Azabudai | Aoyama, Tamachi |
| Ebisu | Matcha Tokyo atre | Shibuya, Nakameguro |
| Ginza | Glitch, Turret, Cloud Club ×2, Atelier Matcha | Nihonbashi |
| Hanegi | Fuglen Hanegi Koen | Shimokitazawa |
| Harajuku | Cafe Reissue, Matcha Tokyo Harajuku | Shibuya, Omotesando, Yoyogi |
| Hatagaya | Sedai Hatagaya, nadoya no katte | Shimokitazawa, Yoyogi |
| Ichigaya | Passage Ichigaya | Shinjuku, Jimbocho |
| Jimbocho | Glitch Jimbocho | Ichigaya, Nihonbashi |
| Jiyugaoka | Onibus Jiyugaoka | Yakumo |
| Kinshicho | Coffee Elementary School | Oshiage, Kiyosumi |
| Kita-Shinjuku | Alternative Coffee Works | Shinjuku |
| Kiyosumi | Koffee Mameya Kakeru | Kinshicho, Nihonbashi |
| Kuramae | ARC, Coffee Wrights, Leaves | Asakusa, Nihonbashi |
| Nakameguro | Onibus ×2, Sidewalk, little cloud | Ebisu, Yutenji |
| Nihonbashi | Glitch Nihonbashi, Passage Nihombashi | Ginza, Jimbocho, Kuramae, Kiyosumi |
| Omotesando | Koffee Mameya, Higuma × Coffee Wrights, little cloud, Matcha Tokyo | Shibuya, Harajuku, Aoyama |
| Oshiage | Unlimited, Matcha Tokyo Skytree | Asakusa, Kinshicho |
| Sakurashinmachi | Ogawa Sakurashinmachi | Sangenjaya |
| Sangenjaya | Obscura ×3 | Shimokitazawa, Sakurashinmachi, Yutenji |
| Shibuya | Sedai, Obscura Front, About Life ×2, White Glass, Matcha Tokyo Miyashita | Harajuku, Omotesando, Aoyama, Ebisu, Tomigaya |
| Shimokitazawa | Bear Pond, Ogawa, Sidewalk Roasters | Sangenjaya, Hanegi, Hatagaya |
| Shinjuku | All Seasons, Matcha Tokyo NEWoMan | Yoyogi, Kita-Shinjuku, Ichigaya |
| Takanawa | Ogawa Takanawa | Tamachi |
| Tamachi | Passage Shiba | Takanawa, Azabudai |
| Tomigaya | Fuglen, Coffee Supreme, Little Nap Roasters, Hatoya Shibuya | Shibuya, Yoyogi |
| Yakumo | Onibus Yakumo | Yutenji, Jiyugaoka |
| Yoyogi | Little Nap Stand, Fuglen Sangubashi | Harajuku, Tomigaya, Hatagaya, Shinjuku |
| Yutenji | Sidewalk Yutenji | Nakameguro, Yakumo, Sangenjaya |

Candidates to merge if 30 feels like too many: Tamachi + Takanawa,
Yakumo + Jiyugaoka, Shinjuku + Kita-Shinjuku, Shimokitazawa + Hanegi.

### Kyoto (13 places)

| Area | Places | Nearby |
| --- | --- | --- |
| Arashiyama | Hatoya Arashiyama | none |
| Karasuma | Ogawa Sakaimachi Nishiki | Kawaramachi, Kyoto Station, Kitaoji |
| Kawaramachi | Ogawa Sanjo, Higuma × Coffee Wrights | Karasuma, Kiyomizu |
| Kitaoji | Fuglen Kyoto | Karasuma |
| Kiyomizu | Gokago, Hatoya Kiyomizu, Ogawa Kiyomizu | Kawaramachi |
| Kyoto Station | Hoho ×2, Ogawa ×2 | Karasuma |
| Uji | Hoho Uji | none |

Gion joins when it has a place. Arashiyama and Uji have no neighbours:
Include nearby adds nothing there, which is honest.
