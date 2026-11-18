# Cloud sessions

Status: **agreed** (Jerry, 2026-11-17), the repo side done; Jerry's
one-time setup and a dry run in New York to come. The way to keep adding
places during the trip when Jerry's PC can't be reached.

## Why

Until now, every change has come from a Claude Code session on Jerry's
Windows PC, driven from his phone over Remote Control. That breaks
whenever the PC does: Windows forces an update and reboots, the power
goes out, or the session crashes. Nobody is home to bring it back.

A **cloud session** runs on a machine Anthropic manages. Jerry starts and
drives it from the **Code tab of the Claude app**, and it keeps running
when he closes the app. It clones this repo from GitHub, so it has
CLAUDE.md and every doc here. It can push to `main` like the PC can, and
Actions then tests and deploys as usual. It counts against Jerry's plan
like any other session; the machine itself costs nothing extra.

Official docs:
- [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Configure cloud environments](https://code.claude.com/docs/en/cloud-environments)

## Jerry's one-time setup

Claude can't do these, since they grant access to his accounts:

1. **Connect GitHub.** Start a session in the Claude app's Code tab (or
   at claude.ai/code) and pick `jfeng94/japlanning`. When asked, install
   the Claude GitHub App on that repository. Without it, a session can
   still clone and fetch, since the repo is public, but every push fails
   with a 403 and "Claude doesn't have GitHub access to
   jfeng94/japlanning" (the first run, 2026-11-17).
2. **Set up the environment** in the session's environment settings:
   - **Network access: Full.** The default, Limited, reaches only
     package registries and GitHub, which blocks shop websites and
     Google Maps links. Nothing secret is in the environment, so Full
     exposes little.
   - **Setup script:** leave it empty. The repo's hook does the setup.
   - **Environment variables and secrets:** none. In particular,
     `ODPT_TOKEN` stays only on the PC.

## What the repo does

`.claude/settings.json` runs `scripts/cloud-session-start.sh` when a
session starts or resumes. On the PC the script returns at once. In the
cloud it:
- **Installs Node.** The cloud machine ships Node 20 to 22, while CI and
  the PC run the version in `.nvmrc` (26). The scripts (`npm run ids`,
  `import`, `snapshot`) run TypeScript files directly, and Vitest wants
  a current Node. So the hook downloads the newest 26.x from nodejs.org,
  checks it against Node's published checksums, and puts it first on
  PATH for the session.
- **Installs packages:** `npm ci`, again only when `package-lock.json`
  or `.nvmrc` has changed.
- **Never blocks the session.** It tells Claude what went wrong, and the
  session carries on.

## Working in one

- **Commit to `main` and push.** Deploys run only from main. If the
  session started on a branch of its own, push the finished commit to
  main (`git push origin HEAD:main`) once Jerry says go.
- **Watching the deploy:** `gh run list` and `gh run watch` work. `gh`
  commands that use GitHub's GraphQL API, like `gh pr` and `gh issue`,
  don't (the cloud's GitHub proxy refuses them).
- **A network change reaches curl, not WebFetch.** Switched to Full
  mid-session, curl reached every site within seconds, while WebFetch
  kept refusing them ("ENOTFOUND"), as if it kept the network the
  session started with (the first run, 2026-11-17). Read sites with curl
  until the next session.
- **Screenshots instead of a browser.** There is no browser pane, so
  Google Maps can't be read the way the PC does it. Jerry sends the
  listing's share link and a screenshot of the listing. The flow is "On
  the trip" in `adding-places.md`.
- **Pins come from the address.** A share link resolves to the place's
  name and address, not its coordinates (checked 2026-11-17). So the pin
  comes from a geocoder (both are in "Sources" in `auditing-places.md`):
  - GSI's in Japan;
  - Nominatim in New York.

  When the geocoder only finds the block, Jerry drops a pin at the door
  and sends its coordinates.
- **Places in an existing area are quick.** A new area means
  `npm run areas`, which first downloads the census blocks (Japan) or the
  neighbourhood shapes (New York) into `.cache/`, which isn't in the repo.
  It works; it just takes a few extra minutes.
- **Station timetables wait for the PC.** `npm run stations -- --refresh`
  needs `ODPT_TOKEN`, which never leaves the PC.
- **Memory doesn't carry over.** Notes a session saves stay in that
  session. Anything lasting goes into CLAUDE.md or a doc here.

## The PC as a backup

Remote Control on the PC still works when the PC is up. To make that
more likely while away: Settings → Windows Update → **Pause updates**,
for up to five weeks on Windows 11 Home. That stops update reboots, but
not crashes or power cuts. Cloud sessions are the plan; the PC is the
fallback.

## Dry run, in New York (2026-11-18 on)

Before Japan, from the phone:
1. Start a cloud session on the repo and say "Read
   docs/design/cloud-first-run.md and follow it." That handoff walks the
   session through every check (Node, the scripts, git, the network,
   pins, a screenshot) and ends with one harmless push and its deploy.
2. Add one place found in New York by the "On the trip" flow, through to
   a live deploy.
3. Note anything that got in the way in `docs/research/nyc-field-test.md`.
