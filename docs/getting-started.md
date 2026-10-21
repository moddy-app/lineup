# Démarrer

## Prérequis

- Node 22 ou plus (`engines.node` : `>=22`).
- npm. Le kit de design est un dossier local (`design-kit/`) lié par `"@moddy/design-kit": "file:./design-kit"`. Ne lancez pas `npm install` dans `design-kit/` : `lit` et `@material/web` doivent se résoudre depuis le `node_modules` de la racine, pour n'avoir qu'une copie de chacun.

## Installation et lancement

```sh
npm install
npm run dev:mock   # avec l'API simulée, http://localhost:5173
npm run dev        # contre la vraie API (https://api.moddy.app par défaut)
```

Le port 5173 est imposé (`strictPort`). En développement, `/__ui` affiche toutes les primitives de `src/ui`.

## Variables d'environnement

Toutes ont une valeur par défaut dans `src/config.ts` : l'app tourne sans fichier `.env`. Pour les changer, copiez `.env.example` vers `.env.local`.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `VITE_API_BASE` | `https://api.moddy.app` | URL de base de l'API Moddy (les routes Lineup sont sous `/lineup`) |
| `VITE_SITE_URL` | `https://lineup.moddy.app` | URL publique du site (liens canoniques, redirections de connexion) |
| `VITE_MOCK_API` | vide | `1` : utilise l'API simulée. Actif seulement en `dev` ou en `--mode mock`, jamais dans un build de production |

`.env.mock` ne contient que `VITE_MOCK_API=1` et est chargé par `vite --mode mock`.

## Scripts npm

| Script | Action |
| --- | --- |
| `npm run dev` | Serveur de développement Vite |
| `npm run dev:mock` | Idem avec l'API simulée (`vite --mode mock`) |
| `npm run build` | `tsc -b` puis build de production dans `dist/` |
| `npm run build:mock` | `tsc -b` puis build avec l'API simulée dans `dist-mock/` |
| `npm run preview` | Sert `dist/` |
| `npm run preview:mock` | Sert `dist-mock/` |
| `npm run typecheck` | `tsc -b` (app, kit, scripts de build) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier en écriture |
| `npm test` | `vitest run` |

## CORS en développement local

L'API refuse toute écriture dont l'origine n'est pas autorisée (`403 {"error": "Origin not allowed"}`). En local, `http://localhost:5173` n'est accepté que si l'API tourne avec `ENVIRONMENT=dev` (LINEUP.md §0). Sans accès à une API de dev, utilisez `npm run dev:mock`.
