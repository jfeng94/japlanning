# Cloud first run: handoff for the cloud session

Written 2026-11-17 for the first cloud session on this repo
(`docs/design/cloud-sessions.md`). Jerry starts one from his phone and
says: **"Read docs/design/cloud-first-run.md and follow it."** The
results go in `docs/research/cloud-first-run-results.md`.

## Who you are, and why this run

You are a Claude Code session running on Anthropic's cloud, started from
Jerry's phone. Until now every change to this repo has come from a
session on Jerry's Windows PC. This run checks that a cloud session can
do the same job, so Jerry can add places during his trips (New York from
2026-11-18, then Japan) when the PC can't be reached.

Read these first:
1. `CLAUDE.md`: the brief and the working agreement.
2. `docs/design/cloud-sessions.md`: what differs in the cloud.
3. "On the trip" in `docs/design/adding-places.md`: the flow this run
   rehearses.

## Ground rules for this run

- **Checks only.** Change no data, config or code. If something fails,
  record it and propose a fix; don't make the fix unasked.
- **One write:** the results file, pushed only after Jerry says go
  (step 7).
- **Never ask for `ODPT_TOKEN`**, or any other token or password.
- **Jerry is on his phone.** Keep messages short: one line when you need
  something from him, one summary at the end.
- **Identify yourself generically.** When a site asks who's calling, send
  the user agent `japlanning-build/1.0 (+https://japan.garbage.house)`.

Keep a table as you go, with columns for the check, what was expected,
and what happened.

## 1. The start-up hook

When the session started, `.claude/settings.json` ran
`scripts/cloud-session-start.sh`. Its last line should be in your
context: "Cloud session setup: Node v26.… from .nvmrc is on PATH and the
npm packages are installed."

| Run | Expect |
| --- | --- |
| `echo $CLAUDE_CODE_REMOTE` | `true` |
| `node -v` | `v26.` something, matching `.nvmrc` |
| `command -v node` | `~/.local/node26/bin/node` |
| `ls node_modules/.cloud-install.sha256` | the file exists |

If `node -v` isn't 26:
1. Run `CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud-session-start.sh`.
2. Record its output and `/tmp/npm-ci.log`.
3. If that fixed it, prefix the rest of the run's commands with
   `export PATH=$HOME/.local/node26/bin:$PATH;`.

## 2. The repo's scripts

| Run | Expect |
| --- | --- |
| `npx tsc --noEmit -p .` | no output |
| `npm test` | every test passes: 369 as of 2026-11-17, more if tests were added since |
| `npm run ids` | "IDs OK" for all six layers |
| `npm run import -- drinks`, then `git status --short data/` | no changes: the file round-trips as it is |
| `npm run snapshot` | "0 warnings" for every layer; it writes `public/data/`, which git ignores |
| `npm run audit` | prints each region's scorecard |

If the import leaves a change in `data/`, record the diff's first lines,
then undo it with `git checkout data/drinks.csv`.

## 3. Git and GitHub

| Run | Expect |
| --- | --- |
| `git branch --show-current` | record it: `main`, or a branch made for this session |
| `git status --short` | clean, apart from anything step 2 left |
| `git push --dry-run origin HEAD:main` | succeeds without pushing; this checks the right to push to main |
| `gh run list --workflow deploy.yml -L 3` | the latest deploys |
| `gh api repos/jfeng94/japlanning --jq .default_branch` | `main` |

`gh pr` and `gh issue` won't work here (the cloud's GitHub proxy refuses
GitHub's GraphQL API). That's expected; nothing in this repo's workflow
needs them.

## 4. The network

The environment should have **Full** network access.

| Try | Expect |
| --- | --- |
| `curl -sI https://www.heytea.com/ \| head -1` | an HTTP status line, not a blocked-host error |
| WebFetch `https://warabimochi-kamakura-usa.com/` | the shop's site; say in a line what it is |
| WebSearch "Heytea Gelato Lab 863 Broadway" | results about the shop at Union Square |

If curl is blocked, the environment is on Limited. Tell Jerry to switch
it to Full ("Jerry's one-time setup" in `cloud-sessions.md`), then
retry.

## 5. A pin, the cloud way

There is no browser here, so a place's pin comes from its address. The
lookups are in "Sources" in `docs/design/auditing-places.md`.

1. **The share link.** Jerry's link for Warabimochi Kamakura (sweets row
   91) is `https://maps.app.goo.gl/AAcL1xz4HRPt8Nd88`. `curl -sI` it.
   The `Location` header names the place and its address ("Warabimochi
   Kamakura- Chelsea, 232 7th Ave, New York, NY 10011"), with no
   coordinates. That is expected.
2. **New York, Nominatim** (one request): look up `232 7th Ave, New York, NY 10011` with
   `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=…`.
   Expect about 40.74461, -73.99560, within 10 m of the row's
   40.7445731, -73.9956399.
3. **Japan, GSI's geocoder:** look up `京都府京都市東山区祇園町南側570-127`
   (URL-encoded) with
   `https://msearch.gsi.go.jp/address-search/AddressSearch?q=…`. Expect
   135.774017, 35.003597, the exact pin of Gion Tokuya (sweets row 52).

## 6. A screenshot (needs Jerry)

Ask Jerry for a screenshot of any Google Maps listing. Read back the
name, address and hours as they would go in a row: `Hours`, and
`Hours (OSM)` in OpenStreetMap syntax. This checks the first step of
"On the trip".

## 7. Results, and one push

1. **Write `docs/research/cloud-first-run-results.md`**, with:
   - the date;
   - the branch you started on and the Node version;
   - the table;
   - anything that needs a fix, with your proposed fix.
2. **Ask Jerry:** "Push the results to main?"
3. **On his go:**
   - Commit with the message "Cloud first run: results".
   - Push it to main with `git push origin HEAD:main`. From a branch of
     your own this fast-forwards main. If main has moved, run
     `git pull --rebase origin main` first.
   - Watch the deploy for your commit. Find it in
     `gh run list --workflow deploy.yml -L 5 --json databaseId,headSha,status,conclusion`:
     it's the run whose `headSha` is your commit, not just the newest
     run. Then `gh run watch <id> --exit-status`.

A new place takes this same path, so a green deploy finishes the
rehearsal.

## 8. Report

Tell Jerry in a few lines:
- what passed;
- what failed, and the fix you propose;
- whether the deploy went green.

## Done when

- Steps 1 to 5 pass.
- Step 6 reads the screenshot correctly.
- The results commit deploys.

The next cloud session can then add a place by "On the trip" with
nothing new to learn.
