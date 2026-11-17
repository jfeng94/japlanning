# Cloud first run: results

The first cloud session on this repo, run 2026-11-17 by the handoff in
`docs/design/cloud-first-run.md`, from Jerry's phone.

- **Branch at start:** `claude/clever-hypatia-i9fjx1`, a branch made
  for the session, at `3f7902f` (the same commit as main).
- **Node:** v26.13.1, from `.nvmrc` via the start-up hook.

Two checks failed on the first try because Jerry's one-time setup
(`docs/design/cloud-sessions.md`) wasn't done yet: pushing, and the
network. He installed the Claude GitHub App and switched the
environment to Full during the run, and both then passed.

## Checks

| # | Check | Expected | What happened |
| --- | --- | --- | --- |
| 1 | Hook's last line | "Cloud session setup: Node v26.… is on PATH…" | Pass: "Node v26.13.1 from .nvmrc is on PATH and the npm packages are installed." |
| 1 | `echo $CLAUDE_CODE_REMOTE` | `true` | Pass |
| 1 | `node -v` | v26, matching `.nvmrc` | Pass: v26.13.1 |
| 1 | `command -v node` | `~/.local/node26/bin/node` | Pass: `/root/.local/node26/bin/node` (HOME is /root) |
| 1 | `node_modules/.cloud-install.sha256` | exists | Pass |
| 2 | `npx tsc --noEmit -p .` | no output | Pass |
| 2 | `npm test` | all pass, 369+ | Pass: 369 in 29 files |
| 2 | `npm run ids` | IDs OK, six layers | Pass |
| 2 | `npm run import -- drinks` | no change in `data/` | Pass: 162 places, 0 warnings, no diff |
| 2 | `npm run snapshot` | 0 warnings per layer | Pass |
| 2 | `npm run audit` | each region's scorecard | Pass, with a gap: New York's 48 places show as "unplaced" (fix 1) |
| 3 | `git branch --show-current` | record it | `claude/clever-hypatia-i9fjx1` |
| 3 | `git status --short` | clean | Pass |
| 3 | `git push --dry-run origin HEAD:main` | succeeds | First **failed**, 403 for any branch: "Claude doesn't have GitHub access to jfeng94/japlanning". Fetching worked because the repo is public. Passed once Jerry installed the Claude GitHub App. |
| 3 | `gh run list --workflow deploy.yml -L 3` | latest deploys | Pass: three green deploys, newest `3f7902f` |
| 3 | `gh api repos/jfeng94/japlanning --jq .default_branch` | `main` | Pass |
| 4 | `curl -sI https://www.heytea.com/` | a status line | First **failed**: the proxy refused every outside host (403 on CONNECT). The environment, "Default", was on Limited with no allowed hosts. Passed once Jerry switched it to Full: 200. Note that `head -1` now prints the proxy's "HTTP/1.1 200 Connection Established", not the site's own status (fix 2). |
| 4 | WebFetch the Warabimochi Kamakura site | the shop's site | **Still fails** after the switch ("ENOTFOUND"), and for ceresnyc.com too: WebFetch seems to keep the network rules the session started with (fix 3). curl reads it: the chain's US homepage, "Handcrafted warabimochi and Japanese tea… find a location". |
| 4 | WebSearch "Heytea Gelato Lab 863 Broadway" | the Union Square shop | Pass: WhatNow on the first US Gelato Lab+, 863 Broadway |
| 5 | `curl -sI` the share link | name and address, no pin | Pass: a 302 to `maps.google.com?q=Warabimochi+Kamakura-+Chelsea,+232+7th+Ave,+New+York,+NY+10011,…` |
| 5 | Nominatim, 232 7th Ave | about 40.74461, -73.99560, within 10 m | Pass: 40.7446069, -73.9955982, 5.1 m from the row |
| 5 | GSI, 祇園町南側570-127 | 135.774017, 35.003597 | Pass: exactly that, Gion Tokuya's pin |
| 6 | Read a screenshot | name, address, hours as a row | Pass, below |

### Step 6: the screenshot

Jerry sent Google Maps' listing for Ceres, a pizza restaurant. Read
back as a row:

| Column | Value |
| --- | --- |
| Name | Ceres |
| Address | 164 Mott St, New York, NY 10013 |
| Hours | Mon, Wed, Thu 11:30–21:00; Fri, Sat 11:00–21:30; Sun 11:00–21:00; closed Tue |
| Hours (OSM) | `Mo,We,Th 11:30-21:00; Fr,Sa 11:00-21:30; Su 11:00-21:00; Tu off` (opening_hours parses it with no warnings) |
| Last verified | 2026-11-17, from the shop's own site |
| Google rating, reviews, rated on | 4.1, 1306, 2026-11-17 |
| Link | https://ceresnyc.com/ |

- **Hours:** the screenshot shows only "Closed · Opens 11:30 AM Wed",
  with the week folded away. The hours above come from ceresnyc.com,
  so they count as verified. The site doesn't list Tuesday, which
  matches the listing being closed on a Tuesday evening. Without the
  site, Jerry would need to send the listing with the hours unfolded.
- **Coordinates:** Nominatim finds the building, 40.7196797,
  -73.9959766.
- **Area:** that point falls in SoHo & Nolita (NTA MN0201), an area
  that already exists, so no `npm run areas`.
- **Layer and kind:** Food. It has no Pizza type, so Ceres would go
  in as Type `Italian` (kind Italian), unless a Pizza type is added to
  `FOOD_KINDS` first.

Nothing was written to `data/`: this run makes no data changes.

## Proposed fixes

None are made. Each waits for Jerry's go.

1. **The audit doesn't know New York.** `TRIP` in `scripts/audit.ts`
   lists only the Japan stops, so New York's 48 places land in
   "unplaced". Add `{ region: "nyc" }` at the top, since that trip
   comes first (from 2026-11-18).
2. **Step 4's curl check reads the proxy, not the site.** Through the
   cloud proxy, `curl -sI … | head -1` prints the proxy's
   "HTTP/1.1 200 Connection Established" whether or not the site
   answers. Use
   `curl -sS -o /dev/null -w '%{http_code}\n' https://www.heytea.com/`
   in `cloud-first-run.md`, which prints only the site's status.
3. **WebFetch keeps the network rules the session started with.**
   After a switch to Full mid-session, WebFetch still refused every
   site while curl reached them. Add a line to "Working in one" in
   `cloud-sessions.md`: after changing the network, read sites with
   curl or start a new session. Jerry's one-time setup, done before
   the session starts, avoids it.
4. **Pushing needs the Claude GitHub App on the repo.** Already step 1
   of Jerry's one-time setup. The symptom is worth adding there: a 403
   on push with "Claude doesn't have GitHub access", while fetching
   still works because the repo is public.
