# Japlanning

Offline-capable trip map for Tokyo, Kyoto, Osaka, Nara and Hakone. Served at
https://japan.garbage.house.

- Brief and working agreement: [CLAUDE.md](CLAUDE.md)
- Design docs: [docs/design/](docs/design/)
- Milestone proposals: [docs/proposals/](docs/proposals/)

## Develop

Needs Node 26 (see `.nvmrc`).

```bash
npm install
npm run dev
```

`npm run build` type-checks and writes `dist/`. Pushes to `main` deploy via
GitHub Actions.

## Credits

- **Map data** © OpenStreetMap contributors, via Protomaps. Area shapes
  are processed from Japan's 2020 census boundaries (e-Stat).
- **Train times and station codes** come from the Public Transportation
  Open Data Center (ODPT); Toei's under CC BY 4.0. ODPT and the operators
  aren't responsible for their accuracy. Questions about this app go to
  its issues page, not to the train companies.
- **Icons and pin artwork** are images found online, sometimes lightly
  retouched. They are not the maintainer's own work, and the project
  claims no rights to them. It is a personal, non-commercial project; ask
  and any image will be removed.
