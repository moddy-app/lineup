# Lineup

Lineup (lineup.moddy.app) is a Moddy service. It connects Discord servers that
recruit staff with people looking for a team, with profiles for servers and
people. The backend is the Moddy API (`https://api.moddy.app`, routes under
`/lineup`); its reference is [`LINEUP.md`](LINEUP.md).

This repo is the website: React 19, TypeScript, Vite, React Router, TanStack
Query and i18next, on the Moddy design system, hosted on Vercel.

## Run it

```sh
npm install
npm run dev:mock   # development mock API (VITE_MOCK_API=1), http://localhost:5173
npm run dev        # against the real API (see .env.example)
```

| Script              | Does                                        |
| ------------------- | ------------------------------------------- |
| `npm run build`     | typecheck, then production build in `dist/` |
| `npm run preview`   | serves `dist/`                              |
| `npm run typecheck` | `tsc -b` (app, design kit, build scripts)   |
| `npm run lint`      | ESLint                                      |
| `npm run format`    | Prettier                                    |
| `npm test`          | Vitest                                      |

Node 22. In development, `/__ui` shows every UI primitive on one page.

## Layout

```
design-kit/   the Moddy design kit (see below), not modified here
src/app/      shell, routes, paths, error and 404 pages
src/auth/     session
src/features/ one folder per page, lazy-loaded
src/i18n/     i18next, one namespace per feature (locales/<lang>/<ns>.json)
src/lib/      format, storage, Discord helpers
src/ui/       React primitives on the kit's classes and Material Web
src/styles/   lineup.css: the app's additions to the kit, tokens only
```

Project documentation will live in `docs/`.

## Design kit

Lineup uses the same design system as moddy.app. Read
[`design-kit/DESIGN-SYSTEM.md`](design-kit/DESIGN-SYSTEM.md) before touching
anything visible, and [`design-kit/README.md`](design-kit/README.md) for the
code.

- [`design-kit/`](design-kit/): the Moddy design kit (CSS, theme, fonts, web
  components, demo).
- It comes from `design-kit/` in [moddy-app/website](https://github.com/moddy-app/website).
  When the look changes there, copy the change here.
- The app depends on it as `"@moddy/design-kit": "file:./design-kit"` and
  compiles its TypeScript sources with Vite. Do not run `npm install` inside
  `design-kit/`: `lit` and `@material/web` must resolve from the root
  `node_modules`, so there is a single copy of each.
