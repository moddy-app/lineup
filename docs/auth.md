# Authentification

Le code est dans `src/auth/` et `src/api/endpoints/auth.ts`.

## Session

- `GET /lineup/me` teste la session. La requête `['me']` en garde un instantané (`src/api/sessionSnapshot.ts`) : `authenticated` (200, objet `Me`), `anonymous` (401), `suspended` (403 `user_suspended`, avec la sanction). Les trois sont des données, pas des erreurs. Un autre échec (réseau, 5xx) rend la session inconnue : la personne est traitée comme anonyme, `session.error` est renseigné.
- `useSession()` expose `status` (`loading`, `anonymous`, `authenticated`, `suspended`), `me`, `sanction`, `canWrite`, `login`, `logout`, `requireAuth`, `refresh`.
- Les deux textes d'un 401 sont traités pareil (retour à la connexion) : `Non authentifie` (pas de cookie) et `Session expiree` (cookie envoyé, session disparue). Le second positionne `ApiError.expired`, ce qui change seulement le message (`sessionExpired`).
- Un visiteur anonyme lit toutes les pages publiques. Seule une action (`useAuthAction`, `requireAuth`) l'envoie se connecter. Un 401 sur une requête de fond ne redirige jamais : la session passe à anonyme.

## Connexion

- `loginUrl(redirect)` construit `${apiBase}/lineup/auth/login?redirect=<chemin encodé>` ; c'est une navigation, pas une requête.
- `sanitizeRedirect` garde ce que l'API accepte : un chemin commençant par un seul `/`, ou une URL https sur `moddy.app` ou un sous-domaine (sans identifiants, sans port). Une URL de l'origine courante qui n'est pas `*.moddy.app` (localhost) est réduite à son chemin relatif. Tout le reste devient `/`. Le front envoie donc un chemin relatif depuis localhost.
- Un `login_url` venu d'une erreur `lineup_reauth_required` n'est suivi que s'il commence par `/` (jamais `//`), sinon on retombe sur le chemin de connexion Lineup.
- `setLoginUrlBuilder` permet à l'API simulée de renvoyer vers sa propre page de connexion.

## `?auth_error=`

Si la personne annule sur Discord, l'API la ramène sur la page d'origine avec `?auth_error=access_denied` (64 caractères au plus). `consumeAuthError()` (appelé dans `main.tsx` avant le routeur) lit la valeur, la retire de la barre d'adresse avec `history.replaceState` en gardant les autres paramètres. `SessionProvider` affiche ensuite un message : "annulée" pour `access_denied`, "échec" sinon (un code vide compte comme échec).

## Reconnexion : `has_lineup_scopes` et `useReauthenticate`

Une session venue du tableau de bord peut ne pas avoir le scope qui lit les serveurs de la personne (`has_lineup_scopes: false`). Les routes qui en ont besoin répondent `403 lineup_reauth_required` avec un `login_url`. `useReauthenticate()` affiche "Autorisez Lineup à lire vos serveurs", exécute les sauvegardes d'avant connexion, puis envoie vers la connexion après 1,6 s (`REAUTH_DELAY_MS`) avec retour sur la page courante. Utilisé par la vérification automatique des expériences et par la page de revendication.

## Brouillons : `registerBeforeLogin`

Se connecter recharge toute la page. Un formulaire qui contient du travail non envoyé appelle `registerBeforeLogin(callback)` (renvoie la fonction de désinscription) ; `login()` et la reconnexion exécutent les callbacks juste avant de partir. Un callback qui lève ne bloque ni les autres ni la connexion. Les brouillons vont dans `sessionStorage` (ou `localStorage` pour l'annonce et l'expérience) et sont restaurés au retour. Clés : `lineup.postDraft.<id|new>`, `lineup-experience-draft`, `lineup-me-profile-draft`, `guild-manage-draft:<guildId>:<profile|invite|visibility>`, `lineup-staff-grant`.

## Suspension

Un `403 user_suspended` (sur `/lineup/me` ou sur toute autre requête, via `routeApiError`) passe la session à `suspended`. Effets :

- `RequireAuth` affiche `SuspendedScreen` (sanction détaillée par `SanctionDetails`) sur les pages protégées.
- `SuspendedNotice` prévient sur les pages publiques.
- `canWrite` vaut `false` : tous les boutons et formulaires d'écriture sont désactivés dans l'app. Il vaut `true` pour un anonyme (l'action l'envoie alors se connecter).
- Un compte suspendu peut se déconnecter. Une sanction de serveur (`guild_suspended`) s'affiche avec `SanctionNotice`.

## Déconnexion

`logout()` appelle `POST /auth/logout` (route du tableau de bord, même cookie, hors `/lineup`). Réponse attendue : `200` avec un corps vide. Un `401` (peu importe le texte) signifie déjà déconnecté : le but est atteint. Une autre erreur est affichée et rien n'est oublié. Ensuite : toutes les requêtes en cache sont supprimées sauf la session et le catalogue, pour que les pages publiques ne gardent aucune trace de la personne (`can_edit`, `is_self`...). Ce n'est pas `queryClient.clear()`, qui détacherait les observateurs montés, la session est mise à `anonymous`, navigation vers l'accueil, message "déconnecté".

## Garde staff

La console `/staff/*` est sous `RequireAuth staff` : un compte non staff reçoit la 404 (la console n'est pas révélée). Chaque section gère aussi un 403 `staff_only` sur ses lectures (`src/features/staff/parts.tsx`). `is_staff` vient de `me.user.is_staff`.
