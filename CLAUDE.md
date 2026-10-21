# CLAUDE.md

Front de Lineup (lineup.moddy.app) : React 19, TypeScript, Vite 7, React Router 7, TanStack Query 5, i18next, kit de design Moddy. API : `https://api.moddy.app`, routes sous `/lineup`, référence `LINEUP.md`. Documentation détaillée dans `docs/` (index : `docs/README.md`). Réponses et docs en français ; identifiants de code en anglais.

## Commandes

```sh
npm install
npm run dev:mock      # API simulée (MSW), http://localhost:5173 : à utiliser par défaut
npm run dev           # vraie API (CORS : l'API doit tourner avec ENVIRONMENT=dev en local)
npm run typecheck     # tsc -b
npm run lint          # eslint .
npx vitest run        # npm test
npm run build         # tsc -b + vite build -> dist/
npm run build:mock    # build avec le mock -> dist-mock/ (preview:mock pour le servir)
npm run format        # prettier --write .
```

Node >= 22. `/__ui` (dev seulement) montre les primitives.

## Structure (voir `docs/architecture.md`)

`src/app` coque, routes, `paths.ts` · `src/api` client, endpoints, hooks, cache · `src/auth` session · `src/i18n` · `src/ui` primitives sur le kit · `src/components` composants métier · `src/features/<page>` une page + sa logique + son CSS · `src/lib` · `src/styles/lineup.css` · `src/mocks` API simulée · `design-kit/` kit (ne pas le modifier ici, ne pas lancer `npm install` dedans).

Ne jamais écrire un chemin d'URL à la main : `paths` de `src/app/paths.ts` (ids encodés).

## Règles du kit de design (non négociables)

Lire `design-kit/DESIGN-SYSTEM.md` avant tout changement visible.

- Jetons seulement : `--md-sys-color-*`, `--gap-*`, `--radius-*`, `--card-padding`... Jamais de couleur hex, d'emoji, de dégradé, d'ombre sur une carte.
- Toute carte commence par ses `edge-caps` (`Card`, `EdgeCaps`).
- Un seul `md-filled-button` par rangée (action principale), `md-outlined-button` pour les autres, 3 boutons au plus par rangée. Pas de bouton maison.
- Les icônes de fonctionnalité sont dans des polygones (`Shape`), jamais des cercles ; varier formes et tons entre cartes voisines.
- Identifiants et valeurs courtes en `Pill`.
- Nombres et dates uniquement via `src/lib/format.ts` (`formatNumber`, `formatDate`, `formatRelativeTime`...).
- Tout mouvement dans `@media (prefers-reduced-motion: no-preference)`. Jamais de calcul au scroll.
- Aucun défilement horizontal à 390 px.
- Bento : ambiance et pages d'état seulement ; les pages d'application utilisent `AppLayout`, `SingleColumn`, `Section`.
- Pas de style en ligne ni de CSS hors `lineup.css` / CSS de feature ; regarder d'abord les classes du kit.

## Rédaction et terminologie

Simple, précis, court. Pas de remplissage marketing, pas de questions rhétoriques, pas de triplets, pas de tirets cadratins en incise, pas d'emoji. Français : "vous" ; espagnol "usted" ; allemand "Sie" ; portugais du Brésil "você". Termes : "revue manuelle" (côté personne), "étiquettes", "Vérification par Lineup prévue" (jamais "vérifié" pour `verified_by_lineup`, rien n'est vérifié pour l'instant), console staff : "Vérifications" (clés et routes restent `reviews`).

## i18n

- Cinq langues : en, fr, es, pt-BR, de. Toute chaîne visible vient de `src/i18n/locales/<langue>/<espace>.json`, dans les cinq.
- Un espace de noms par feature (`useT('feed')`...). Une clé ajoutée va dans les cinq fichiers : `src/i18n/locales.test.ts` impose les mêmes clés que l'anglais et les mêmes `{{variables}}` / `<balises>`.
- Libellés du catalogue : fr et en viennent de l'API ; es, pt-BR, de de l'espace `catalog` (`useCatalogLabel`). Un nouvel id de catalogue se traduit dans ces trois langues.
- Textes des composants du kit : `design-kit/labels/<langue>.json`.

## Conventions API (voir `docs/api-client.md`, `docs/coverage.md`)

- Les ids (snowflakes Discord) sont des chaînes, jamais `Number`. Les UUID aussi.
- Passer par les hooks de `src/api/queries.ts` et `mutations.ts` ; jamais `fetch` ni `endpoints/*` dans un composant.
- Après une écriture, mettre le cache à jour à partir de la réponse (`cacheSync.ts`). Ne jamais relire le fil (60 s de cache serveur).
- Brancher sur `error.code` (`hasCode`), jamais sur le message français. Texte affiché : `errorMessage(error, t)`, 422 : `fieldErrors`.

| Cas                                          | Traitement                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 401 (`Non authentifie`, `Session expiree`)   | Anonyme ; l'action de la personne envoie à la connexion (`useAuthAction`), jamais une requête de fond |
| `user_suspended`                             | Session suspendue, `canWrite` faux, écrans de suspension                                              |
| `lineup_reauth_required`                     | `useReauthenticate()` (login_url relatif à l'API)                                                     |
| `discord_unavailable`, `lineup_rate_limited` | Désactiver l'action avec `useRetryAfter`, afficher le décompte ; 30 s / 60 s par défaut               |
| `guild_suspended`                            | `SanctionNotice`                                                                                      |
| 422                                          | `fieldErrors` d'après `loc` ; erreur sans champ sous `_form`                                          |
| Route inconnue                               | 404 `{"detail": "Not Found"}` (forme FastAPI), géré par `ApiError`                                    |

- Pagination : `useInfiniteList`. Fin de liste = `next_cursor === null`, jamais une page courte. Une page vide avec curseur est suivie (3 de suite au plus), puis "Charger plus".
- NSFW : l'API ne bloque rien, le front affiche une porte d'âge (`NsfwGate`, `isNsfw`), confirmation mémorisée par appareil. Aucun contenu NSFW sans confirmation.
- Formulaires qui contiennent du travail : `registerBeforeLogin` pour sauver le brouillon avant la redirection de connexion.
- Une écriture n'est jamais retentée automatiquement.

## API simulée (voir `docs/mock-api.md`)

`npm run dev:mock`. Personas : `anonymous`, `member` (Camille), `dashboard` (pas de scope), `staff` (Noé), `suspended` (Dylan), `newcomer` (Inès) ; sélection dans le panneau "Mock" (bas gauche) ou sur `/__mock/login`. Codes d'invitation de test dans `src/mocks/README.md`. Réinitialiser la base : panneau ou clé `lineup-mock-db`. Le mock ne doit jamais apparaître dans `dist/`. Ne jamais définir `VITE_MOCK_API` en production.

## Définition de fini

1. `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build` passent.
2. `grep -rl "msw\|mockServiceWorker" dist` est vide.
3. Captures à 1400 px et 390 px, clair et sombre, dans deux langues au moins ; les regarder (`design-kit/DESIGN-SYSTEM.md` §10).
4. Nouveau texte dans les cinq langues ; nouvelle route API dans `endpoints/index.ts`, le mock et `docs/coverage.md`.

Ne pas committer sans demande.

## Pièges de l'API

Ordres de contrôle, formes d'erreur et questions ouvertes : `docs/backend-notes.md`. À retenir : LINEUP.md §0 se trompe sur la forme du 404 (c'est `{"detail": ...}`) ; `POST /auth/logout` répond 200 sans corps ; un fil ou un annuaire peut renvoyer une page vide avec un curseur ; `post.guild` n'a pas d'indicateur NSFW ; les badges Discord publics sont décrits de deux façons dans LINEUP.md.
