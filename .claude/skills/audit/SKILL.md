---
name: audit
description: Work through Japlanning's place audit with Jerry one place at a time. Pick the next place from the audit queue (or the one or region Jerry names), research it, then present one uncertainty with a recommendation; apply his answer, commit, and go on to the next. Use when Jerry says "audit", "/audit", "next place", "let's scrub places", or names a place or region to audit.
---

# Audit session: one place at a time

The workflow is `docs/design/auditing-places.md`; read it first if it
isn't in context. The goal is every place scrubbed before the trip. This
session clears the gaps that need Jerry, one place per turn, in a voice
he can answer from his phone.

## Each turn

1. **Pick the place.**
   - Jerry names a place (by name or id): take that one.
   - Jerry names a region (`/audit kyoto`): `npm run audit -- --next 1 --region kyoto`.
   - Otherwise: `npm run audit -- --next 1`.

   Then `npm run audit -- --place <id>` prints everything held on it:
   the row, its gaps, the queue entry, any open decision and the
   research sources.

2. **Research before asking.** Read the sources already listed before
   searching again. Then one search (the Japanese name plus
   `住所 営業時間` usually works), and one or two pages, best source
   first: the shop's own site or Instagram, Google as search results
   show it, Tabelog, OpenStreetMap. Use Node's `fetch` for Japanese
   pages, not curl. Geocode a new address with GSI.

3. **If the research settles it**, apply it under the rules in the
   doc's "Claude does" table and say so in one line ("Turret Coffee:
   address and hours from its site, pin moved to the door"). Then go
   straight on to the next place. Don't ask Jerry what the evidence
   already answers.

4. **Otherwise ask one question.** A short card, nothing more:
   - **Name** (id), region and area, and what kind of place it is.
   - **Uncertain:** the gap, in a sentence.
   - **Found:** what the research shows, with one or two links.
   - **Recommend:** what you'd do and why, in a line.

   Then the options, the recommended one first. They're usually: keep
   as is, fix (give the change), drop, or skip for now. Use
   AskUserQuestion when it's available, else a numbered list. Jerry may
   be on his phone: keep the card under about 120 words.

5. **Apply the answer.**
   - **The row:** edit `data/<layer>.csv`, then
     `npm run import -- <layer>` to normalise it. A dropped place is
     deleted; its ID is never reused.
   - **The queue** (`docs/research/audit-queue.csv`): remove the tags
     now settled, and add what you learned to the detail. The place
     leaves the queue when no tags are left.
   - **The decisions** (`docs/research/audit-decisions.md`): remove the
     place's row once decided.
   - **A moved pin** that crosses into another area means
     `npm run areas` (adding-places.md, "Adding an area").
   - **Checks:** run `npm test` and `npm run snapshot`. Both must pass.
   - **Commit** that one place: `Audit: <name>: <what changed>`, with
     the usual co-author line.

   "Skip for now" changes nothing. Remember the place for the rest of
   the session: ask for `--next 5` and take the first place not
   skipped. It comes up again next session.

6. **Show progress, then the next place.** One line for the region from
   `npm run audit`, such as "Tokyo: 47 scrubbed, 80 ready, 160 to go".
   Then start the next place at step 1.

## Ending

When Jerry stops, push the session's commits (each push deploys, so
once is enough), watch the deploy, and say in two lines how many places
were settled, dropped or skipped, and the region's scorecard now.

## Don'ts

- Never drop, rename, or change a place's region or kind without
  Jerry's answer.
- Never write a guess. A blank cell beats a wrong one.
- One question per turn. A place with two open questions takes two
  turns, the worse one first.
- Notes keep the voice in `adding-places.md`, and the data test enforces
  it.
