# Filters and areas

Status: **proposed** (2026-11-09); open points decided the same day (see
Decisions); waiting for a go-ahead.

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

## Decisions (2026-11-09)

1. **Area** is the term: in the data, the sheet and the code.
2. **Bar** stays the third drinks kind.
3. **List order moves to the strip's footer** as a toggle; it leaves the
   sheet and Settings.
4. **Areas in the data are raw; merging is interpretation in code.** A
   place records the area it is actually in; a merge layer in config
   groups raw areas into the chips, revisited as places are added.

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

- **Here**, labelled with where that is ("Here · Shibuya"). Shown when
  Location is on; tapping it with no fix yet starts locating, like the
  locate button. Follows you as you walk, re-evaluated with the 3 s
  position throttle.
- One chip per area group in the region (see Areas below): nearest first
  when there is a fix, alphabetical otherwise.
- **Include nearby areas**: a switch under the chips that adds the
  neighbouring groups of everything selected. Pulled-in groups get a
  dotted outline so the result count is explainable, without becoming
  selected.

Selected areas are a union; none selected means everywhere.

### 3. Categories (what)

Layers become category headers, their kinds become the chips:

- **Drinks**: Coffee · Tea · Bar
- **Food**: Ramen · Yakitori · Tempura · … (when the food layer lands)
- **Shopping**, **Attractions**, **Lodging**: the same pattern

Every selected chip is a union: Coffee + Ramen shows all coffee and all
ramen. The header chip selects or clears all of its kinds. None selected
means everything.

### What leaves the sheet

Every facet section, the include-unknown toggles, the per-chip counts,
the "pick a single layer" note and the Sort row. The facets stay in the
data, in the row chips and in the card's Details; the search box now
matches them (see below), so "pour-over" or "kissaten" finds them in one
step.

### The rule this sets

**Filters do not cascade.** Nothing in the sheet appears, disappears,
greys out or recounts because of another selection. The feedback is the
result count in the header; an empty result shows "Nothing matches" with
Clear filters, as today. "Here" depends on your position, not on other
chips, so it is the one chip whose state can change by itself.

## The footer's order toggle

The footer's left slot is empty in list mode (Back lives there in card
mode). It gains a two-state toggle, labelled with the current order:
**A–Z** or **Nearest**; a tap switches. It writes the existing `sort`
setting, so the choice persists as now; the "List order" row in Settings
goes, and "Sort by distance when located" stays there. Choosing Nearest
with no fix starts locating and switches when the fix lands. Prev and
Next in card mode follow whichever order the list has. Text labels until
there is artwork for it.

## The algebra

```
shown = places in the region
  ∩ (no category chips ? all : ∪ selected (layer, kind))
  ∩ (no area chips and not Here ? all
       : area ∈ members(selected groups ∪ {here's group}
                        ∪ (nearby ? their neighbouring groups : ∅)))
  ∩ every flag that is on
  ∩ text match
```

Text matches the name, branch, raw area, area group, kind, notes, every
facet value and the Japanese address.

## Areas

"Area", not neighborhood: short, how Japanese guides and signs talk
(渋谷エリア), and free of administrative meaning. "District" in Tokyo
English is also used for wards (区), which are far coarser.

### Two layers

**Raw areas** are facts: the area a place is in, as a visitor would name
it, following its address. They are the values in the data's **Area**
column and the nodes of the adjacency graph, defined per region with
their neighbours. Geography does not change when the chips are
regrouped, so the graph lives here.

**Area groups** are interpretation: a merge layer that folds raw areas
into the chips. An unmerged raw area is its own group. Merges are named
explicitly and revisited as places are added; splitting one back apart
is a config edit with no data change.

```ts
interface AreaConfig {
  label: string;          // raw area, e.g. "Takanawa"; the data's Area value
  adjacent: string[];     // raw labels; the graph must be symmetric
}

interface AreaGroup {
  label: string;          // the chip, e.g. "Tamachi · Takanawa"
  areas: string[];        // raw labels it folds together
}

interface RegionConfig {
  areas: AreaConfig[];
  areaGroups?: AreaGroup[];
}
```

### Neighbours of a group

Contract each group into one node. Its neighbours are the union of its
members' neighbours, minus its own members, lifted to whole groups:

```
nearby(G) = { group(b) : a ∈ G, b ∈ adjacent(a), group(b) ≠ G }
```

That is one hop on the contracted graph, which answers the question of
how merging interacts with adjacency: a merged group is adjacent to
everything any member touches. It is deliberately not a traversal to
everything connected: Tokyo's graph is one connected component, so that
would select the whole city. Include nearby applies `nearby` to every
selected group (and to Here's group) and takes the union.

### Here

Each raw area's centre is the centroid of its places, computed at load,
so there are no coordinates to maintain. Here is the raw area with the
nearest centre, provided you are inside the region's bounding box and
within 2 km of it, mapped to its group. Near a border it may pick the
other side; with Include nearby on, that stops mattering. Chips sort by
the distance to their group's centre (the centroid of all member
places).

### What shows where

- Rows and the card show the **raw** area, the most specific fact.
- Chips, the strip's summary tags and the URL use **groups**. The URL's
  `a=` accepts raw labels too and maps them to their current group, so
  a link survives a later merge.

### Validation

- A test checks the raw graph is symmetric and names only defined raw
  areas, and that every raw area is in at most one group.
- The build fails on a row whose Area is blank or not a raw area of its
  region, the same as an unknown Region.
- Only raw areas with places are defined; a place in a new area adds the
  raw area (and, if wanted, its merge) in the same commit, which the
  adding-places workflow already covers under "anything the config
  lacks".

## Data and config changes

- `data/drinks.csv`: the **Neighborhood** column becomes **Area**, every
  row re-assigned to its raw area from its Japanese address (town and
  chome). The appendix is the draft assignment; it is reviewed before
  anything is written, as the findings table.
- `LayerConfig` gains `kinds: string[]`, read from each layer's **Kind**
  column, which becomes required (blank or unknown fails the build). Kind
  leaves `facets`; the card's meta line shows it ("Drinks · Coffee ·
  Shibuya · 1.2 km away").
- `RegionConfig.neighborhoods` becomes `areas` and `areaGroups`.
- `FacetConfig.scopeBy` goes, with nothing left to scope.
- Filter state: `layers`, `neighborhoods`, `facets` and
  `includeUnknownHours` give way to `categories`, `areas` (groups),
  `here` and `nearby`. The URL carries `c=` (categories), `a=` (areas),
  `here=1`, `nb=1`; old filter links stop applying, place links are
  unaffected.

## Steps, each deployable

1. **Areas.** Raw areas with their graph and the initial merges in
   config, the Area column and its validation, the data migration
   (findings first), the raw area on rows and the card. The existing
   Neighborhood section lists the groups until step 2 replaces it.
2. **The sheet and the footer.** New filter state, algebra and URL; the
   sheet and the summary tags rebuilt as above; Here and Include nearby;
   the order toggle in the footer; the wider search; facet filtering
   removed.
3. **Cleanup and docs.** Dead code out (facet counts, scoping, unknown
   toggles, the Settings order row); the design doc's filter model
   rewritten with the no-cascade rule and the two area layers;
   CLAUDE.md's requirement 2, column table and open questions updated.

Roughly 1,000 lines touched, about half of them deletions; the filter
tests are largely rewritten, with new ones for the group graph. One
known effect: a phone whose first launch after the deploy is offline
reads its cached copy of the data with the old column, so areas are
blank until it next goes online.

## Done when

- [ ] The sheet shows flags, areas and categories only; no chip changes
      because another was tapped.
- [ ] Here picks the right area on the phone in Tokyo (checkable by
      faking a position at home), and Include nearby adds the
      neighbouring groups with dotted outlines.
- [ ] Coffee + Tea + Shibuya + nearby gives the union of both kinds
      across Shibuya and its neighbours.
- [ ] Merging two raw areas in config changes the chips and the
      neighbours with no data edit.
- [ ] The footer toggle switches A–Z and Nearest, and Prev/Next follow.
- [ ] "pour-over" in search finds the pour-over places.
- [ ] Every row has a raw area; the build fails on a blank or unknown one.

## Appendix: draft raw areas

With merging available, the raw areas follow the address more literally
than the first draft did: Turret is in Tsukiji, Passage Nihombashi in
Ningyocho and Leaves in Honjo across the river from Kuramae, and merges
fold them back for the chips.

### Tokyo: 33 raw areas, 61 places

| Raw area | Places | Adjacent (raw) |
| --- | --- | --- |
| Aoyama | Latte Art Mania | Shibuya, Omotesando, Azabudai |
| Asakusa | Fuglen, Hatoya | Kuramae, Honjo, Oshiage |
| Azabudai | Ogawa Azabudai | Aoyama, Tamachi |
| Ebisu | Matcha Tokyo atre | Shibuya, Nakameguro |
| Ginza | Glitch, Cloud Club ×2, Atelier Matcha | Tsukiji, Nihonbashi |
| Hanegi | Fuglen Hanegi Koen | Shimokitazawa |
| Harajuku | Cafe Reissue, Matcha Tokyo Harajuku | Shibuya, Omotesando, Yoyogi |
| Hatagaya | Sedai Hatagaya, nadoya no katte | Shimokitazawa, Yoyogi |
| Honjo | Leaves | Kuramae, Asakusa, Oshiage |
| Ichigaya | Passage Ichigaya | Kita-Shinjuku, Shinjuku, Jimbocho |
| Jimbocho | Glitch Jimbocho | Ichigaya, Nihonbashi |
| Jiyugaoka | Onibus Jiyugaoka | Yakumo |
| Kinshicho | Coffee Elementary School | Oshiage, Kiyosumi |
| Kita-Shinjuku | Alternative Coffee Works | Shinjuku, Ichigaya |
| Kiyosumi | Koffee Mameya Kakeru | Kinshicho, Ningyocho |
| Kuramae | ARC, Coffee Wrights | Asakusa, Honjo, Ningyocho |
| Nakameguro | Onibus ×2, Sidewalk, little cloud | Ebisu, Yutenji |
| Nihonbashi | Glitch Nihonbashi | Ginza, Jimbocho, Ningyocho |
| Ningyocho | Passage Nihombashi | Nihonbashi, Kuramae, Kiyosumi |
| Omotesando | Koffee Mameya, Higuma × Coffee Wrights, little cloud, Matcha Tokyo | Shibuya, Harajuku, Aoyama |
| Oshiage | Unlimited, Matcha Tokyo Skytree | Asakusa, Honjo, Kinshicho |
| Sakurashinmachi | Ogawa Sakurashinmachi | Sangenjaya |
| Sangenjaya | Obscura ×3 | Shimokitazawa, Sakurashinmachi, Yutenji |
| Shibuya | Sedai, Obscura Front, About Life ×2, White Glass, Matcha Tokyo Miyashita | Harajuku, Omotesando, Aoyama, Ebisu, Tomigaya |
| Shimokitazawa | Bear Pond, Ogawa, Sidewalk Roasters | Sangenjaya, Hanegi, Hatagaya |
| Shinjuku | All Seasons, Matcha Tokyo NEWoMan | Yoyogi, Kita-Shinjuku, Ichigaya |
| Takanawa | Ogawa Takanawa | Tamachi |
| Tamachi | Passage Shiba | Takanawa, Azabudai |
| Tomigaya | Fuglen, Coffee Supreme, Little Nap Roasters, Hatoya Shibuya | Shibuya, Yoyogi |
| Tsukiji | Turret | Ginza |
| Yakumo | Onibus Yakumo | Yutenji, Jiyugaoka |
| Yoyogi | Little Nap Stand, Fuglen Sangubashi | Harajuku, Tomigaya, Hatagaya, Shinjuku |
| Yutenji | Sidewalk Yutenji | Nakameguro, Yakumo, Sangenjaya |

### Tokyo: initial merges (26 chips)

| Chip | Raw areas |
| --- | --- |
| Ginza | Ginza, Tsukiji |
| Nihonbashi | Nihonbashi, Ningyocho |
| Kuramae | Kuramae, Honjo |
| Shinjuku | Shinjuku, Kita-Shinjuku |
| Shimokitazawa | Shimokitazawa, Hanegi |
| Tamachi · Takanawa | Tamachi, Takanawa |
| Jiyugaoka · Yakumo | Jiyugaoka, Yakumo |

Every other raw area is its own chip. With these, "Kuramae + nearby"
reaches Asakusa, Oshiage and Nihonbashi through Honjo and Ningyocho, and
"Shimokitazawa + nearby" reaches Sangenjaya and Hatagaya.

### Kyoto: 7 raw areas, 13 places, no merges

| Raw area | Places | Adjacent (raw) |
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
