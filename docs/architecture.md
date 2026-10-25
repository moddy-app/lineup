# Architecture

Stack : React 19, TypeScript, Vite 7, React Router 7, TanStack Query 5, i18next, Material Web et le kit de design Moddy (`design-kit/`).

## Dossiers de `src/`

```
src/
  main.tsx        point d'entrée : thème, i18n, ?auth_error=, mock éventuel, rendu
  config.ts       apiBase, siteUrl, mockApi (valeurs par défaut incluses)
  app/            coque, routes, chemins, pages d'erreur et 404, écran de suspension
  api/            client HTTP, types, endpoints, requêtes, mutations, cache, pagination, retry
  auth/           session, retour d'erreur de connexion, brouillons avant connexion, reconnexion
  i18n/           i18next, langues, ressources, libellés du kit
  ui/             primitives React sur les classes du kit et Material Web
  components/     composants métier partagés (carte d'annonce, badges, quota, porte NSFW...)
  features/       une page (ou un groupe de pages) par dossier, chargée à la demande
  lib/            format, stockage, helpers Discord, URL, navigation
  styles/         lineup.css : ajouts de l'app au kit
  mocks/          API simulée (développement seulement)
  dev/            galerie /__ui (développement seulement)
  test/           harnais et setup Vitest
  types/          déclarations des éléments personnalisés
```

| Dossier     | Rôle                                                                                                                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`      | `App.tsx`, `Root.tsx`, `AppShell.tsx` (barre du haut : logo et navigation `TopNav.tsx`, sélecteur de langue `LanguageMenu.tsx`, thème, menu du compte `UserMenu.tsx`), `routes.tsx`, `paths.ts`, `RequireAuth.tsx`, `SuspendedScreen.tsx`, `SuspendedNotice.tsx`, `queryClient.ts`                                               |
| `api/`      | `client.ts` (`apiFetch`, `ApiError`), `errors.ts` (message par code), `endpoints/` (une fonction par route), `queries.ts` et `mutations.ts` (hooks), `queryKeys.ts`, `cacheSync.ts` et `cacheUpdates.ts` (mises à jour du cache), `pagination.ts`, `retry.ts`, `useRetryAfter.ts`, `catalog.ts`, `limits.ts` (limites de champs) |
| `auth/`     | `session.tsx`, `status.ts`, `authError.ts`, `beforeLogin.ts`, `reauth.ts`, `useAuthAction.ts`                                                                                                                                                                                                                                    |
| `features/` | `feed`, `post`, `post-editor`, `my-posts`, `guild-profile`, `guild-manage`, `bots`, `bot-manage`, `claim`, `user-profile`, `me-profile`, `experiences`, `staff`                                                                                                                                                                  |

Chaque feature contient sa page (export `Component`), ses sous-composants, sa logique de formulaire testable (`form.ts`, `*Form.ts`) et son CSS.

## Routage

- Les URL vivent dans `src/app/paths.ts` : `routePatterns` (ce que le routeur reconnaît) et `paths` (constructeurs pour les liens). Les identifiants sont des chaînes et sont encodés. N'écrivez jamais un chemin à la main.
- `routes.tsx` : la coque est chargée tout de suite, chaque page est `lazy` (`lazy: () => import(...)`). Une route sans chemin `content` porte `HydrateFallback` (chargement) et `ErrorBoundary` (`RouteError`) pour qu'ils apparaissent dans la coque, la barre ne disparaît jamais.
- `RequireAuth` (route de mise en page sans chemin) entoure les pages qui demandent une session. Il affiche : un chargement, l'écran de suspension, l'invitation à se connecter (`SignInPrompt`, selon le `purpose`), ou la page. Avec `staff`, un compte non staff voit la 404 pour ne pas révéler la console.
- `/__ui` n'existe qu'en développement. `*` mène à `NotFoundPage`.
- `/staff` redirige vers `/staff/reviews`.
- Bots ([bots.md](bots.md)) : `/bots`, `/bots/:botId`, et `/bots/:botId/manage` (route protégée `manage`, sous-routes `posts`, `discord`, `settings`), contexte « bot » du tableau de bord (`paths.botManage`…, `?bot=` dans l'éditeur).
- `/guilds` (ancien annuaire) redirige vers `/` (`Navigate replace`). `SanctionNotice` est dans `src/components`.
- Nouvelle route de la refonte : `/people` (Profils, provisoirement la `FeedPage`). Plus de page « Mes serveurs » : `/me/guilds` et `/guilds/claim` redirigent (`Navigate replace`) vers `/me?servers=manage` et `/me?servers=add`, qui ouvrent les dialogues de `features/claim` (`AddServerDialog`, `ManageServersDialog`, chargés par `SettingsLayout`).
- Tableau de bord : `/me`, `/me/experiences`, `/me/posts`, l'éditeur et `/guilds/:id/manage/*` partagent `SettingsLayout` (sélecteur de contexte et navigation du contexte, `src/ui/dashboardContext.ts`). La gestion d'un serveur est une route parente protégée (`purpose` `manage`, `features/guild-manage/GuildManageLayout`) avec cinq sous-routes `lazy` : index (profil), `invite`, `posts`, `discord`, `settings` ; `paths.guildManage`, `guildManageInvite`, `guildManagePosts`, `guildManageDiscord`, `guildManageSettings`. La barre du haut décide de l'entrée courante dans `app/navMatch.ts`.
- Avant la connexion, les formulaires enregistrent leur état avec `registerBeforeLogin` (voir [auth.md](auth.md)).
- Après un déploiement, un onglet ouvert qui demande un script disparu se recharge une fois (`vite:preloadError` dans `main.tsx`).

## Flux de données

- Toute lecture passe par un hook de `src/api/queries.ts` (TanStack Query) et toute écriture par un hook de `src/api/mutations.ts`. Les composants n'appellent jamais `fetch` ni les fonctions d'`endpoints/` directement.
- Les clés sont hiérarchiques (`src/api/queryKeys.ts`) : `['catalog']`, `['me']` (session, toujours adressée avec `exact: true`), `['me','profile']`, `['me','experiences']`, `['posts','feed',filtres]`, `['posts','detail',id]`, `['posts','mine',...]`, `['guilds','detail',id]`, `['guilds','mine']`, `['users','detail',id]`, `['staff','experiences'|'reports'|'badges',...]`. Les filtres de liste sont normalisés (ensembles triés, sans doublon) pour que deux filtres équivalents aient la même clé.
- Après une écriture, le cache est mis à jour à partir de la réponse (`cacheSync.ts`, qui applique les fonctions pures de `cacheUpdates.ts`) : un élément est remplacé, retiré ou inséré dans les pages déjà chargées, sans toucher aux curseurs. On ne relit jamais le fil (il a 60 s de cache serveur). Les données que l'on ne peut pas calculer (équipe d'un serveur, annuaire) sont seulement marquées périmées, sans rechargement.
- `queryClient.ts` : `staleTime` 30 s, pas de rechargement au focus (sauf la session), retry limité aux erreurs réseau et à `discord_unavailable`, jamais pour une écriture. Toute erreur passe par `routeApiError` : une suspension suspend la session, un 401 sur une requête protégée la déconnecte sans redirection.

## Amorçage du thème

Le script `design-kit/src/theme/boot.ts` doit rester un script classique bloquant dans le `<head>`, hors du bundle, pour choisir le thème et cacher la page (`html.booting`) avant le premier rendu. `scripts/vite-plugin-theme-boot.ts` le compile avec esbuild (iife) et l'insère en ligne à la place du marqueur `<!-- theme-boot -->` de `index.html`, en dev et en build. `scripts/vite-plugin-font-preload.ts` précharge les polices. `scripts/vite-plugin-mock-worker.ts` sert le worker MSW (voir [mock-api.md](mock-api.md)).

## Intégration du kit

- Sources TypeScript du kit (décorateurs Lit) compilées avec l'app. `vite.config.ts` fixe `experimentalDecorators` et `useDefineForClassFields: false` pour tous les fichiers.
- `resolve.dedupe` : `lit`, `@material/web` et `@material/material-color-utilities`. Une seconde copie définirait chaque élément deux fois.
- Ordre des imports dans `main.tsx` : CSS du kit (`moddy.css`), puis `lineup.css`, puis les éléments (`@/ui/material`) avant le rendu de React, pour que React 19 trouve chaque élément déjà défini et lui passe les objets en propriétés.
- Découpage du build : chunks `material` (Material Web, Lit) et `vendor` (React, routeur, Query, i18next).
- Le kit ne se modifie pas ici : il vient de `design-kit/` de `moddy-app/website`.
