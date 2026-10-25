# API simulée

Une imitation de l'API Moddy (les 41 routes de LINEUP.md §6, les 8 routes des bots + `POST /auth/logout`) qui tourne dans le navigateur avec [MSW](https://mswjs.io) v2. Le code de l'app est le même avec ou sans elle : les handlers interceptent les URL absolues (`${config.apiBase}/lineup/...`). Le détail complet, y compris la table des codes d'invitation, est dans [`../src/mocks/README.md`](../src/mocks/README.md) ; cette page en donne l'essentiel.

## Démarrage

```sh
npm run dev:mock       # serveur de dev avec le mock, http://localhost:5173
npm run build:mock     # bundle avec le mock, dans dist-mock/
npm run preview:mock   # sert dist-mock/
```

- `src/main.tsx` importe `./mocks/browser` par `import()` dynamique, seulement si `VITE_MOCK_API === '1'` et que l'app tourne en dev ou en `--mode mock`. Dans tout autre build, la condition est une constante, l'import est supprimé : ni `src/mocks` ni `msw` dans `dist/`.
- Le script du worker n'est pas dans `public/`. Le plugin `scripts/vite-plugin-mock-worker.ts` le sert (serveur de dev) ou l'émet (`vite build --mode mock`) sous exactement la même condition. `npm run dev` avec `VITE_MOCK_API=1` dans `.env.local` marche donc aussi.
- Si le worker ne se charge pas, `startMocks()` écrit une erreur explicite dans la console et l'app démarre sans mock.
- Vérifier l'absence du mock en production : `npm run build` puis `grep -rl "msw\|mockServiceWorker" dist` ne doit rien renvoyer, et `dist/mockServiceWorker.js` ne doit pas exister.

## Organisation

| Élément                                        | Rôle                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `logic/*.ts`                                   | Les règles (machines à états, quotas, visibilité, curseurs, validation, limiteur de débit). Sans MSW ni navigateur, testées avec Vitest |
| `server/routes.ts`                             | Les 41 routes + logout, en adaptateurs minces : lire le chemin et le corps, appeler la logique, choisir le statut                       |
| `server/dispatch.ts`                           | `Request` vers `Response` : routage, authentification (401, 403 sanction, 403 `Staff only`), `Cache-Control: no-store` avec une session |
| `errors.ts`                                    | Les formes d'erreur de LINEUP.md §0                                                                                                     |
| `seed/*.ts`                                    | Les données de départ, calculées par rapport à "maintenant"                                                                             |
| `db.ts`                                        | Base en mémoire, persistée dans `localStorage`                                                                                          |
| `personas.ts`, `settings.ts`                   | Persona courante et réglages du panneau                                                                                                 |
| `browser.tsx`, `DevPanel.tsx`, `LoginPage.tsx` | MSW, panneau de dev, page de connexion                                                                                                  |
| `testing.ts`                                   | `createTestApi()` : toute l'API sans MSW, pour les tests unitaires                                                                      |

## Base de données

Clé `localStorage` `lineup-mock-db`, versionnée (`DB_VERSION` dans `seed/index.ts`, actuellement 2). Elle est écrite après chaque écriture, pour qu'un rechargement garde les changements. Une base illisible, d'une autre version ou semée il y a plus d'une semaine est remplacée par une base neuve. Réinitialiser : bouton "Reset the database" du panneau, ou supprimer la clé. Les compteurs de débit et le cache du fil (60 s) sont en mémoire seulement : un rechargement les remet à zéro. Autres clés : `lineup-mock-persona`, `lineup-mock-settings`.

## Personas

| Persona     | Qui      | Montre                                                                                                                                                     |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous` | personne | 401 `Non authentifie` sur les routes de session, lectures publiques OK                                                                                     |
| `member`    | Camille  | Cas courant : plusieurs serveurs (avec ou sans Moddy, revendiqués ou non, un suspendu), expériences et annonces dans tous les statuts, quota presque plein |
| `dashboard` | Camille  | `has_lineup_scopes: false` : `403 lineup_reauth_required` sur `verify`                                                                                     |
| `staff`     | Noé      | `is_staff: true`, routes `/lineup/staff/*`, voit le contenu non listé et suspendu                                                                          |
| `suspended` | Dylan    | `403 user_suspended` sur toute route de session ; lectures publiques ouvertes                                                                              |
| `newcomer`  | Inès     | Rien sur Lineup (`profile: null`) ; gère Les Chroniqueurs (non revendiqué)                                                                                 |

## Page de connexion du mock

`setLoginUrlBuilder` envoie toute connexion vers `/__mock/login?redirect=<chemin>` (même origine). On choisit une persona et on revient à `<chemin>`. "Deny (access_denied)" revient avec `?auth_error=access_denied` sans session. `POST /auth/logout` répond `200` sans corps et remet la persona à `anonymous` ; sans session valide : `401 {"error":"Non authentifie"}` (pas de cookie) ou `{"error":"Session expiree"}` (cookie, session morte).

## Panneau de dev

Bouton "Mock" en bas à gauche, replié par défaut (anglais). Contrôles : persona ; latence (0, 300, 1200 ms, plus ou moins 40 %) ; "Discord unavailable" (503 `discord_unavailable` avec `Retry-After: 30`, seulement sur les routes qui appellent Discord) ; "fail the next request" (une erreur réseau, une fois) ; issue de la vérification automatique (`auto` selon les données, `success`, `not_member`, `no_staff_permission`) ; cache de 60 s du fil ; réinitialisation de la base. Une action "Expire the session" garde le cookie mais tue la session : les routes de session répondent `401 Session expiree`, les routes publiques fonctionnent en anonyme.

## Codes d'invitation

Résolus par le Discord du mock dans l'ordre documenté : invitation, droits, doublon. La même table sert aux expériences et à `PUT /lineup/guilds/{id}`. Exemples pour Camille : `cafe-des-mods` (201), `studio-nocturne` (201), `corbeau-guilde` (403 puis 201 après `refresh-guilds`), `marche-arcanes` (403 `guild_suspended`), `atelier-phenix` (409 déjà revendiqué), `nocturne-temp` (422 `invite_expiring`), `vieux-code` (404 `invite_not_found`), `groupe-mp` (422 `invite_invalid`), `zzz999` (404). Table complète dans `src/mocks/README.md`.

## Contrat récent reproduit par le mock

- `POST /lineup/guilds/claim` : `{invite}`, `{guild_id}` ou les deux (aucun : 422 `value_error`). `guild_id` seul avec Moddy sur le serveur : l'invitation permanente est créée par le mock (`moddy-<8 derniers chiffres de l'id>`) ; sans Moddy : 422 `invite_required` ; invitation et `guild_id` de deux serveurs : 422 `invite_guild_mismatch`. Café des Mods (Moddy) passe sans invitation ; Studio Nocturne demande `studio-nocturne`.
- `PUT /lineup/guilds/{id}` avec `invite: null` : nouvelle invitation par Moddy, sinon 422 `invite_required`.
- `GET /lineup/guilds/{id}` : `snapshot_at` pour un gestionnaire seulement ; Arena Esport FR a `invite.url` nul.
- Expériences : `image_url` (https, 500 caractères, modifiable pour un service, ignoré pour un serveur) et `member_count` (lus dans l'invitation pour un serveur) ; `experience.guild` pour un serveur à profil listé.
- Résumés (`post.guild`, `post.author`, `team[].user`, `experience.guild`, `me.user`, cartes) : `badges` sans badges Discord ni `moddy_premium` ; `post.guild.nsfw` ; cartes d'annuaire avec `description` (160 caractères, « … ») et `nsfw` ; `listed` sur `me/guilds` ; `entity_name` et `entity_icon_url` sur les badges staff.

## Bots

`db.bots` (l'App Directory) et `db.botProfiles` (`logic/bots.ts`, `seed/bots.ts`). Les droits suivent le serveur support (propriétaire ou `ADMINISTRATOR` dans la liste de serveurs de la personne). Application ID de test et cas pour Camille dans [`../src/mocks/README.md`](../src/mocks/README.md) (« Test bot ids »). `DB_VERSION` passe à 4.

## Données de départ

Environ 12 serveurs revendiqués (dont un NSFW par thème, un NSFW par niveau Discord, un non listé, un suspendu, un à invitation supprimée, un à instantané périmé), 16 personnes, environ 40 annonces dans tous les statuts, des expériences avec preuves dans tous les statuts, des signalements ouverts, résolus et rejetés. Le fil et l'annuaire contiennent des lignes de remplissage de comptes suspendus : avec les tailles de page par défaut, la page 2 est vide avec un `next_cursor` non nul. Les limites : signalements 10 par heure, `verify` 5 par 10 minutes, `refresh` 1 par minute et par serveur.

## Ajouter une route

1. Écrire la règle dans `logic/<domaine>.ts` (fonctions pures sur `Env`), avec les types de corps dans `logic/schemas.ts` si besoin.
2. Ajouter l'entrée dans le tableau `routes` de `server/routes.ts` (`method`, `path`, `auth`, `handler`) ; l'adaptateur ne fait que lire, appeler et choisir le statut.
3. Ajouter un test dans `logic/*.test.ts` ou `server/routes.test.ts` avec `createTestApi()`.
4. Ajouter la fonction côté client dans `src/api/endpoints/` et la ligne dans le tableau de `endpoints/index.ts`, puis [coverage.md](coverage.md).
