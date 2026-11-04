# Japlanning

Offline-capable trip map for Tokyo, Kyoto and Hakone. Served at
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
