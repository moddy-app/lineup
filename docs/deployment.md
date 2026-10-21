# Déploiement

Hébergement : Vercel, site statique (SPA). Build : `npm run build` (`tsc -b` puis `vite build`), sortie `dist/`.

## `vercel.json`

- **Réécriture SPA** : toute URL qui ne commence pas par `assets/` et ne finit pas par une extension (`.xxx`) est servie par `/index.html` (le routeur prend le relais). Les fichiers et les assets manquants restent des 404.
- **En-têtes de sécurité** sur toutes les routes : `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Cache** : `/assets/*` en `public, max-age=31536000, immutable` (noms hachés) ; `/index.html` en `no-cache` pour qu'un déploiement soit vu tout de suite.

## Variables d'environnement

Aucune n'est obligatoire (valeurs par défaut de `src/config.ts`). En production :

- `VITE_API_BASE` : `https://api.moddy.app` (défaut).
- `VITE_SITE_URL` : `https://lineup.moddy.app` (défaut).
- `VITE_MOCK_API` : ne jamais la définir. Même définie, un build de production (`vite build` sans `--mode mock`) n'inclut ni le mock ni MSW, mais il ne faut pas compter sur ce garde-fou.

## Domaine et HTTPS

L'API refuse les écritures d'une origine non autorisée (`403 Origin not allowed`) et le cookie de session est propre à `.moddy.app`. Le site doit donc être servi depuis `*.moddy.app` en HTTPS (LINEUP.md §0). Un domaine `*.vercel.app` ne peut pas se connecter. Les `redirect` de connexion sont limités à `moddy.app` et ses sous-domaines.

## Vérifier un build

```sh
npm run typecheck && npm run lint && npx vitest run && npm run build
grep -rl "msw\|mockServiceWorker" dist   # doit être vide
ls dist/mockServiceWorker.js             # doit échouer
npm run preview                          # contrôle visuel, http://localhost:4173
```

`/__ui` (galerie) n'est pas dans le build : la route n'existe qu'en développement.
