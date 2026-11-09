# Adding places

Status: **agreed** (2026-11-05). The workflow for turning a name on a
list into a row in `data/<layer>.csv`. Jerry supplies candidates, Claude
researches and writes; nothing is written before Jerry has seen the
findings.

## 1. Intake

Jerry gives names with whatever hints he has: an area, a kind, "multiple
locations", a friend's note. Claude normalises them into a candidate
list (given name, hint, guessed region and kind) and repeats it back only
if something is ambiguous enough to stop the research.

## 2. Research, per candidate

- **Identity.** The official site or Instagram, and which shop exactly.
  For a brand with several branches the hint decides; without a hint,
  list the branches in the findings and ask. Name = the brand, Branch =
  the shop, as in the column conventions.
- **Position.** Coordinates from the official address, cross-checked on
  OpenStreetMap or Google Maps, and inside the region's bounding box.
  The Japanese address from the official source; a `~` prefix when only
  the area is known.
- **Area.** The raw area the place is in, as a visitor would name it,
  following the address; the ward in the address must be the area's
  (the build checks). A place in a new area adds that raw area to the
  region's config with its ward and neighbours, and a merge if it should
  share a chip (docs/proposals/filters-and-areas.md).
- **Hours.** Human-readable plus OSM syntax. `Last verified` is today
  only when the hours were read from the official source; hours from a
  third party go in without a date, so the app shows them as unverified.
- **Kind** always: it is required, and it files the place under its
  category chip.
- **Facets.** Format, Food, Linger, Reservation, Specialty only when a
  source supports them; blank otherwise. Blank beats a guess: a wrong
  value misleads on the card and in search.
- **Notes.** Two or three lines in English: what it is known for, the
  order, practical tips (card only, queues, reservations). Nothing
  private, ever.
- **Icon** by Kind (coffee, tea, bar) unless Jerry wants a special one.
- **Key** only when Jerry says so, or the brand itself calls a branch
  its flagship.

Sources, in order of trust: the official site, the official Instagram,
Google Maps or Tabelog listings, travel write-ups. Coordinates and hours
are never inferred; if no source gives them, the cell stays blank and the
findings say so.

## 3. Findings (the gate)

One table, one row per candidate: name and branch, region and
area, coordinates, hours and whether verified, the facets found,
a one-line note, source links, a confidence (high: official source for
identity, position and hours; medium: one of those from a third party;
low: identity uncertain), and open questions. Below it: anything the
config lacks (a new Specialty value, a new raw area with its neighbours
and merge, a region bounding box), since those go in the same commit.

Claude stops here. Jerry answers the questions, drops candidates, or
corrects facts. Nothing is written until he says go.

## 4. Write

- Append the rows to `data/<layer>.csv` with the next free IDs
  (`npm run ids`), in ID order; config additions in the same change.
- `npm test` and `npm run snapshot` green; `npm run import -- <layer>`
  round-trips the file to normalise quoting.
- One commit per batch, naming the places: "Data: add 5 tea shops
  (Ginza, Shibuya, Asakusa, Kyoto)". Push; Actions deploys.
- Report: the ids, the live link, and what was left blank and why.

## Rules that do not bend

- IDs are never reused, even for a deleted row.
- A row is never written from memory; every fact has a source in the
  findings.
- A region needs its bounding box before its first pins are considered
  done, so the map has a basemap there (a follow-up, not a blocker: pins
  render on a plain background until then).
