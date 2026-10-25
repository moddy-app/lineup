# The mock API

A fake of the Moddy API (LINEUP.md, the 41 routes under `/lineup` plus `POST /auth/logout`) that runs in
the browser with [MSW](https://mswjs.io) v2. The app's code is the same with or without it: the handlers
match the absolute URLs (`${config.apiBase}/lineup/...`), the service worker answers them.

```
npm run dev:mock       # dev server with the mock, http://localhost:5173
npm run build:mock     # bundle with the mock, into dist-mock/
npm run preview:mock   # serve dist-mock/
```

## How it starts

`src/main.tsx` imports `./mocks/browser` dynamically, and only when `VITE_MOCK_API === '1'` **and** the app runs
in dev or in `--mode mock`. In any other build the condition is a constant and the import is dropped: no
`src/mocks`, no `msw` in `dist/` (`grep -r "msw\|mockServiceWorker" dist` is empty).

The worker script is **not** in `public/`. The Vite plugin `scripts/vite-plugin-mock-worker.ts` serves it
(dev server) or emits it (`vite build --mode mock`) under exactly the same condition as `main.tsx`:
`VITE_MOCK_API=1` and (dev server or `--mode mock`). So `npm run dev:mock` works, and so does a plain
`npm run dev` with `VITE_MOCK_API=1` in `.env.local` or in the shell. If the mock is asked for but the worker
cannot be loaded, `startMocks()` logs one explicit error in the console and the app loads without a mock.

## Layout

| Folder or file                                 | Role                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `logic/*.ts`                                   | The rules (state machines, quotas, visibility, cursors, validation, rate limiter). No MSW, no browser. Tested with Vitest.        |
| `server/routes.ts`                             | The 41 routes as thin adapters: parse, call the logic, pick the status code.                                                      |
| `server/dispatch.ts`                           | `Request` to `Response`: routing, authentication (401, 403 sanction, 403 `Staff only`), `Cache-Control: no-store` with a session. |
| `errors.ts`                                    | The four error shapes of LINEUP.md section 0, byte for byte.                                                                      |
| `seed/*.ts`                                    | The data (see below), built relative to "now".                                                                                    |
| `db.ts`                                        | In memory, persisted to `localStorage` (`lineup-mock-db`, versioned, seed older than a week is replaced).                         |
| `personas.ts`, `settings.ts`                   | `lineup-mock-persona` and `lineup-mock-settings` in `localStorage`.                                                               |
| `browser.tsx`, `DevPanel.tsx`, `LoginPage.tsx` | The MSW plumbing, the dev panel, the sign-in page.                                                                                |
| `testing.ts`                                   | `createTestApi()`: the whole API without MSW, for the unit tests.                                                                 |

## Sign-in

`setLoginUrlBuilder` sends every login to `/__mock/login?redirect=<path>` (this origin). Pick a persona and you
come back to `<path>`. "Deny (access_denied)" comes back with `?auth_error=access_denied` and no session.
`POST /auth/logout` answers `200` with an EMPTY body (no JSON) and puts the persona back to `anonymous`; a suspended
account can still sign out; without a valid session it is `401 {"error":"Non authentifie"}` (no cookie) or
`{"error":"Session expiree"}` (cookie, dead session).

The dev panel action "Expire the session" keeps the cookie but kills the session: session routes answer
`401 {"error":"Session expiree"}`, public and optional routes keep working as anonymous. Signing in again
(`/__mock/login`) clears it.

## Personas

Stored in `localStorage` under `lineup-mock-persona` (stands for the session cookie).

| Persona     | Who     | What it shows                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous` | nobody  | 401 `{"error": "Non authentifie"}` on session routes, public reads work                                                                                                                                                                                                                                                                                           |
| `member`    | Camille | Scopes. Atelier du Phénix (Moddy, claimed, 5 live posts: quota full), Pixel Forge (no Moddy, claimed), Café des Mods (Moddy, not claimed), Studio Nocturne (no Moddy, not claimed), Marché des Arcanes (suspended, not claimed). Guilde du Corbeau appears after `refresh-guilds`. Experiences in every status, posts in every status, 2 of 3 personal posts live |
| `dashboard` | Camille | `has_lineup_scopes: false`: `403 lineup_reauth_required` on `verify`                                                                                                                                                                                                                                                                                              |
| `staff`     | Noé     | `is_staff: true`, the `/lineup/staff/*` routes, edits everything, sees unlisted and suspended content                                                                                                                                                                                                                                                             |
| `suspended` | Dylan   | `403 user_suspended` (shape 2, no root copy) on every session route; public reads stay open                                                                                                                                                                                                                                                                       |
| `newcomer`  | Inès    | Nothing on Lineup: `profile: null`, no experience, no post. Manages Les Chroniqueurs (unclaimed)                                                                                                                                                                                                                                                                  |

## Dev panel

The "Mock" button, bottom left, folded by default. Persona, latency (0, 300, 1200 ms, plus or minus 40%),
"Discord unavailable" (503 `discord_unavailable` with `Retry-After: 30`, only on the routes that call Discord),
"fail the next request" (a network error, once), the outcome of the automatic verification (from the data,
success, `not_member`, `no_staff_permission`), the 60 s feed cache, and the reset of the database.

"Discord unavailable" only hits what really needs Discord: invitations (claim, `PUT` with an invitation,
experiences), `verify`, and the rights checks that neither the session nor the 5-minute server list can answer.
Public reads never fail (they serve the old snapshot with `stale: true`), and "my servers" degrades to the
session's Moddy servers.

## Errors worth knowing

- Unknown route: `404 {"detail":"Not Found"}`; wrong method: `405 {"detail":"Method Not Allowed"}` with
  `Allow: <all methods of the path>`. FastAPI's native shape (`detail`, not `error`).
- `Cache-Control`: `/lineup/catalog` (public, max-age=3600), `/lineup/posts` and `/lineup/guilds` (public,
  max-age=60) keep it with a session; their errors set none, so with a session they get `no-store`.
- `POST /lineup/me/experiences/{id}/verify`: session, 404, 422 `not_guild`, 422 `ended`, already verified (200,
  unchanged, no Discord), 403 `lineup_reauth_required`, 429, then Discord (503, or 422 `lineup_verification_failed`).
  A verified then ended experience answers 422 `ended`.
- `PUT /lineup/guilds/{id}`: body and id validation (422), session (401/403), rights (503 if Discord is silent,
  403 `lineup_guild_forbidden`, 403 `guild_suspended`), no profile (404), then `invite` (422 `invite_invalid`, 503,
  404 `invite_not_found`, 422 `invite_invalid` / `invite_expiring` / `invite_guild_mismatch`), then the write.
  Nothing is written if a step fails. `invite: null` asks Moddy for a new permanent invitation (`moddy-<8 last digits
of the id>`): 422 `invite_required` when Moddy is not on the server.
- `POST /lineup/guilds/claim` takes `{invite}`, `{guild_id}` or both (neither: 422 `value_error` on `body`).
  With an invitation: resolve it, then (two servers: 422 `invite_guild_mismatch`), rights, duplicate. With `guild_id`
  alone: rights (403, also for an unknown id), duplicate (409), then Moddy must be on the server (422
  `invite_required`), which creates the permanent invitation itself. The order of the last two is a guess.
- Experiences: `image_url` and `member_count` are read from the invitation for a server (a server's `image_url` in
  the body is ignored, and `PATCH` leaves it alone). A service has `image_url` (https, 500 characters at most,
  `null` clears it, changing it never resets a verification) and `member_count: null`. `experience.guild` is the
  server's summary (`id`, `name`, `icon_url`, `badges`) when it has a listed, unsuspended profile, else `null`.
- Summaries (`post.guild`, `post.author`, `team[].user`, `experience.guild`, `me.user`, directory cards) carry
  `badges` without Discord's and without `moddy_premium`. `post.guild.nsfw` and the directory card's `nsfw` follow
  the theme or Discord's level. A card's `description` is the Lineup text, else Discord's, cut at 160 characters
  and followed by "…".
- `GET /lineup/guilds/{id}`: `snapshot_at` for a manager only (`null` otherwise). Arena Esport FR has
  `invite: {code: "", url: null, valid: true}` (the bot could not create an invitation: no "Join" button).
  The shape of `code` in that case is not documented; the mock sends an empty string.
- `GET /lineup/me/guilds`: `listed` (profile present and visible in the directory, `false` without a profile).
- `GET /lineup/staff/badges` and the `PUT`: `entity_name` and `entity_icon_url` come from the entity's profile, `null`
  without one (the manual badge on Café des Mods shows it). `entity_type` is optional.

## Test invitation codes

Resolved by the mock's Discord, in the documented order: **invitation, then rights, then duplicate**
(LINEUP.md section 3). The same table serves the experiences (`invite`) and `PUT /lineup/guilds/{id}`.
"Camille" is the `member` persona.

| Code (or link)                                                                                                               | Case                                                                   | Answer for Camille                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `cafe-des-mods`                                                                                                              | success, Moddy installed, session rights                               | 201                                                                                              |
| `studio-nocturne`                                                                                                            | success, no Moddy, rights from her Discord server list (Manage Server) | 201                                                                                              |
| `corbeau-guilde`                                                                                                             | rights not yet in her cached server list                               | 403 `lineup_guild_forbidden`; press "refresh-guilds" (`POST /lineup/me/refresh-guilds`) then 201 |
| `marche-arcanes`                                                                                                             | server suspended globally                                              | 403 `guild_suspended` (sanction shape, no root copy)                                             |
| `atelier-phenix`, `pixelforge`, `atelier`                                                                                    | already claimed, she manages them                                      | 409 `lineup_guild_already_claimed` with `guild_id`                                               |
| `cubelands`, `cubelands-fr`, `moddy`, `animeplaza`, `arena-esport`, `noxafterdark`, `velvetlounge`, `hyrule-rp`, `devcorner` | someone else's server                                                  | 403 `lineup_guild_forbidden` (rights before the duplicate)                                       |
| `lumiere`                                                                                                                    | server she is not a member of                                          | 403 `lineup_guild_forbidden`                                                                     |
| `tradehub`                                                                                                                   | suspended server, already claimed                                      | 403 `lineup_guild_forbidden` for her (not a manager); the staff get 409                          |
| `nocturne-temp`                                                                                                              | expires in 2 days                                                      | 422 `invite_expiring`                                                                            |
| `vieux-code`                                                                                                                 | expired 3 days ago                                                     | 404 `invite_not_found`                                                                           |
| `groupe-mp`                                                                                                                  | leads to a group DM                                                    | 422 `invite_invalid`                                                                             |
| `ami-ouvert`                                                                                                                 | a friend invitation                                                    | 422 `invite_invalid`                                                                             |
| `zzz999` (any code not in this table)                                                                                        | unknown                                                                | 404 `invite_not_found`                                                                           |
| `not a code!!`, `http://discord.gg/x`, `https://example.com/invite/x`                                                        | malformed, HTTP, not a Discord host                                    | 422 `invite_invalid` (checked before Discord is called, so even when Discord is down)            |
| any code with "Discord unavailable" on                                                                                       | Discord silent                                                         | 503 `discord_unavailable`, `Retry-After: 30`                                                     |

Accepted forms: the bare code, `https://discord.gg/<code>`, `https://discord.com/invite/<code>`,
`https://discordapp.com/invite/<code>`. `animeplaza` is also the vanity URL of Anime Plaza.
`chroniqueurs` is the success case for Inès (`newcomer`). `lumen-study` is **not** a code Discord knows (the
invitation of the Lumen Study profile was deleted: `invite.valid` is `false` there). `cubelands-fr` and
`atelier` are second permanent codes of Cubelands and Atelier du Phénix, to change a profile's invitation;
`PUT` with a code of another server answers 422 `invite_guild_mismatch`.

## Test bot ids

Application IDs of the mock's App Directory (`seed/bots.ts`), for the "Add a bot" dialog and bot experiences.
"Camille" is the `member` persona.

| Application ID        | Bot          | Case                                                        | Lookup / claim for Camille                              |
| --------------------- | ------------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| `994573526499328311`  | Atelier Bot  | support server Atelier du Phénix (she owns it), no profile  | `can_claim: true`, claim 201                            |
| `1213818185187328312` | Studio Beats | support server Studio Nocturne (she has Manage Server only) | `can_claim: false`, claim 403 `lineup_bot_forbidden`    |
| `827512720457728302`  | Pixel Helper | claimed by her, listed                                      | `claimed: true`, claim 409 `lineup_bot_already_claimed` |
| `815916308758528303`  | Cube Guard   | claimed by Alex, verified app; her verified bot experience  | `claimed: true`                                         |
| `1176492235030528301` | Moddy        | claimed by Noé (staff), verified app, posts                 | `claimed: true`                                         |
| `697777864572928304`  | Nox          | NSFW theme                                                  | `claimed: true`                                         |
| `942752061718528305`  | Dev Helper   | unlisted (Léo's): 404 for her                               | `claimed: true`                                         |
| `1113799134281728306` | Marché Bot   | support server suspended: invisible                         | claim 403 `guild_suspended`                             |
| `1017766349897728313` | Ghost        | not discoverable                                            | 422 `bot_not_discoverable`                              |
| `1070674978275328314` | Lonely       | no support server                                           | 422 `bot_support_guild_missing`                         |
| any other snowflake   |              | unknown                                                     | 404 `bot_not_found`                                     |

Lookup is limited to 20 calls per minute and person, refresh to 1 per minute and bot. With "Discord unavailable"
on, lookup, claim and bot experiences answer 503 and "my bots" answers `stale: true`.

## Notable seed cases

- Claiming with `guild_id` alone: Café des Mods (Moddy installed) goes through with no invitation field; Studio
  Nocturne (no Moddy) answers 422 `invite_required` and needs `studio-nocturne`. Sending `guild_id: <Café>` with
  `studio-nocturne` answers 422 `invite_guild_mismatch`.
- About 12 claimed servers: a NSFW one by theme (Velvet Lounge), a NSFW one by Discord level 3 (Nox After Dark),
  an unlisted one (Terres d'Hyrule RP), a suspended one (Trade Hub Gains), one with a deleted invitation
  (Lumen Study), one with an old snapshot that cannot be refreshed (`stale: true`, Dev Corner), manual badges of
  every kind (`lineup_verified`, `moddy_partner`, `moddy_server`).
- 16 people (Memoji of the design kit as avatars where there is one), about 40 real posts in every status
  (published, expired, draft, closed, hidden), experiences in every status with proofs, reports open, resolved and
  dismissed.
- The feed and the directory contain filler rows of suspended accounts and servers: with the default page sizes
  (20 and 24) page 1 is short, page 2 is **empty with a non-null `next_cursor`**, page 3 has the rest. Always
  follow `next_cursor`.
- Verification of Camille's experiences: one succeeds from the data (member with Manage Messages), one fails with
  `no_staff_permission`, one with `not_member`; the dev panel can force any outcome.
- Rate limits: reports 10 per hour, `verify` 5 per 10 minutes, `refresh` 1 per minute and server, all with
  `retry_after` in the body and in `Retry-After`. They are counted in memory: a reload resets them.

## Tests

`npx vitest run src/mocks`. The logic tests call the whole API through `createTestApi()` (dispatch included), with
a fixed clock, so they check status codes, headers and bodies as the app sees them.
