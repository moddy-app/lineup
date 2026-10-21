# Client API

Tout passe par `src/api/client.ts`. Les URL sont toujours absolues (`config.apiBase` + chemin), pour que l'API simulée intercepte les mêmes adresses.

## `apiFetch<T>(path, init)`

- Envoie le cookie (`credentials: 'include'`), sérialise la requête (`query`: un tableau devient des paramètres répétés ; `undefined`, `null` et `''` sont ignorés, `false` et `0` sont des valeurs).
- Envoie du JSON seulement s'il y a un `body`, avec son `Content-Type`.
- Résout avec le JSON, ou `undefined` pour un 204 ou un corps vide. Une réponse 2xx dont le corps n'est pas du JSON lève une `ApiError` de type `unknown`.
- Rejette avec une `ApiError`. Une requête annulée rejette avec l'`AbortError` du navigateur, que TanStack Query ignore.
- `POST /auth/logout` répond `200` avec un corps vide : cela passe par le cas "corps vide".

## `ApiError`

| Champ | Contenu |
| --- | --- |
| `status` | Statut HTTP, `0` si aucune réponse |
| `kind` | `lineup`, `sanction`, `text`, `validation`, `network`, `unknown` |
| `code` | Code stable (LINEUP.md §12) ou un des nôtres : `unauthenticated`, `staff_only`, `origin_not_allowed`, `route_not_found`, `validation_error`, `network_error`. `null` si absent |
| `context` | Champs à côté du code (`limit`, `scope`, `reason`, `login_url`, `retry_after`, `guild_id`, `field`, `current_status`, `can_request_review`...) |
| `sanction` | Détail pour `user_suspended` et `guild_suspended` |
| `validation` | Le `detail[]` d'un 422 |
| `retryAfter` | Secondes à attendre (429, 503) |
| `serverMessage` | Message français de l'API, dernier recours d'affichage, jamais pour brancher du code |
| `expired` | Pour `unauthenticated` : la session existait et a expiré (`Session expiree`) |
| `receivedAt` | Instant de création, point de départ du décompte |

Helpers : `isApiError`, `hasCode(error, ...codes)`, `fieldPath`, `issuesByField`.

## Les formes d'erreur

`errorFromResponse(status, body, retryAfterHeader)` les reconnaît toutes :

1. Erreur Lineup : `{"error": {"code", "message", ...}, "code", ...}` (champs aussi à la racine). `kind: 'lineup'`.
2. Sanction : `{"error": {"code": "user_suspended" | "guild_suspended", ...}}`, sans copie à la racine. `kind: 'sanction'`.
3. Texte : `{"error": "Non authentifie"}`, `{"error": "Staff only"}`, `{"error": "Origin not allowed"}`. `kind: 'text'`.
4. Validation : `{"error": "Validation error", "detail": [...]}` (422). `kind: 'validation'`, code `validation_error`.
5. Forme native FastAPI : `{"detail": "Not Found"}` (route inconnue, 404) ou `{"detail": "Method Not Allowed"}` (405). `kind: 'text'`, code `route_not_found` pour le 404. Voir [backend-notes.md](backend-notes.md), point 4 : LINEUP.md §0 indique `{"error": "Not Found"}` à tort.

Un 401 prend le code `unauthenticated` ; `expired` vaut `true` si le texte contient "expir". Un corps qui n'est pas du JSON (page de passerelle) donne `kind: 'unknown'`, avec `unauthenticated` si le statut est 401.

## Message affiché : `src/api/errors.ts`

- `errorMessage(error, t, {context?, seconds?})` renvoie une phrase courte dans la langue courante (espace de noms `errors`). Le code branche sur `code`, jamais sur le message français. Cas particuliers : `unauthenticated` (session expirée ou non), `lineup_guild_forbidden` (contexte `claim` ou `manage`), `lineup_quota_exceeded` (`scope` et `limit`), `lineup_post_invalid_status` (`current_status`), `lineup_filter_invalid` (`field`), `lineup_verification_failed` et `lineup_verification_not_applicable` (`reason`), `lineup_rate_limited` et `discord_unavailable` (durée). Un code inconnu affiche `serverMessage`, sinon "erreur serveur" (5xx) ou message générique.
- `ERROR_CODES` liste chaque code connu ; `errors.test.ts` vérifie qu'ils ont un message dans les cinq langues.
- `fieldErrors(error, t)` convertit un 422 en un message par champ, d'après `loc` (`['body','requirements',2,'value']` devient `requirements.2.value`) et `type` Pydantic (`missing`, `string_too_short`, `too_long`, `greater_than_equal`, `url_scheme`, `literal_error`...). Une règle de modèle sans champ est rangée sous `_form`.
- `formatWait(seconds, t)` : "45 secondes", "3 minutes", "1 heure" (arrondi à l'unité supérieure).

## Pagination : `src/api/pagination.ts`

Les listes à curseur (fil, annuaire, mes annonces, staff) utilisent `useInfiniteList(useXxx())`. Une page peut être plus courte que `limit`, voire vide, avec un `next_cursor` non nul (les annonces d'auteurs suspendus sont retirées après la lecture de la page). Donc :

- La fin de liste est `next_cursor === null`, jamais une page courte.
- Une page vide avec curseur est suivie toute seule, jusqu'à 3 pages vides de suite (`MAX_AUTO_EMPTY_PAGES`) ; ensuite la liste s'arrête et propose "Charger plus".
- Le hook renvoie `items`, `hasMore`, `loadMore`, `isLoading`, `isLoadingMore`, `isEmpty`, `isError`, `isLoadMoreError`, `isRefetching`, `isPlaceholderData`, `error`, `refetch`. Un échec du chargement suivant garde les éléments affichés et propose de réessayer.
- Les badges staff paginent par `limit` / `offset` (`STAFF_BADGES_PAGE_SIZE` = 100).

## Retry et `Retry-After`

- `src/api/retry.ts` : une lecture n'est retentée que pour une erreur réseau ou un 503 `discord_unavailable`, 2 fois au plus, en attendant au moins `Retry-After`, 30 s au maximum, avec un recul exponentiel (1 s, 2 s) sinon. Un 4xx n'est jamais retenté. Une écriture n'est jamais retentée.
- `Retry-After` est lu en secondes ou en date HTTP. Si une 429 ou un 503 n'en porte aucun : 60 s pour `lineup_rate_limited`, 30 s pour `discord_unavailable`.
- `useRetryAfter(error)` renvoie `{seconds, active}`. Le décompte part de `receivedAt`, reste juste si le composant se monte plus tard, et ne tourne qu'une fois par seconde pendant l'attente. On désactive l'action tant que `active` est vrai.
- `formatCountdown(seconds)` : "45 s" jusqu'à 2 minutes, puis "12 min".

## Où sont les routes

`src/api/endpoints/index.ts` contient le tableau des 41 routes (+ `POST /auth/logout`) avec le nom de chaque fonction et son fichier (`auth.ts`, `catalog.ts`, `guilds.ts`, `users.ts`, `posts.ts`, `reports.ts`, `experiences.ts`, `staff.ts`). `endpoints.test.ts` vérifie méthode, chemin, requête et corps de chacune. La correspondance avec les écrans est dans [coverage.md](coverage.md).
