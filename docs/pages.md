# Pages

Une section par route de `src/app/paths.ts`. Toutes les pages sont chargées à la demande. Les erreurs non listées passent par `ErrorState` / `errorMessage` (message générique ou par code, bouton "Réessayer", décompte si `Retry-After`). Les routes API sont détaillées dans [coverage.md](coverage.md).

## `/` Fil des annonces (`features/feed`)

- But : parcourir les annonces publiées, filtrer, proposer d'en publier une.
- API : `GET /lineup/posts` (`useFeed`, liste à curseur), `GET /lineup/catalog` (filtres), `GET /lineup/me/posts` (jauge de quota pour une personne connectée).
- Filtres dans l'URL (`feedFilters.ts`) : type, postes, langues, étiquettes, thème, compensation, recherche `q` (délai 350 ms), `include_nsfw`. Une valeur inconnue du catalogue est ignorée. Le panneau devient une boîte de dialogue sous 1100 px.
- États : chargement, vide sans filtre, vide avec filtre ("réinitialiser"), "Charger plus", fin de liste, mise à jour des filtres (`aria-busy`). Le contenu NSFW demande une confirmation d'âge avant d'activer l'interrupteur.
- Erreurs : `lineup_filter_invalid` et `cursor_invalid` proposent de repartir de zéro ; réseau et 5xx via `ErrorState`.

## `/posts/:postId` Annonce (`features/post`)

- But : lire une annonce, candidater, signaler ; pour l'auteur ou le gestionnaire, publier, rouvrir, modifier, fermer, supprimer.
- API : `GET /lineup/posts/{id}`, `POST .../publish`, `POST .../close`, `DELETE`, `POST /lineup/reports`, plus `GET /lineup/users/{id}`, `GET /lineup/me/profile`, `GET /lineup/me/experiences` pour les exigences et l'expérience mise en avant.
- États : chargement, introuvable, bandeaux (brouillon, fermée, masquée par le staff, expirée), porte NSFW (`NsfwGate`) si le thème est `nsfw`, exigences remplies ou non, `RelativeTime` d'expiration, bouton de candidature selon le type.
- Erreurs : `lineup_post_not_found`, `lineup_post_hidden`, `lineup_post_invalid_status` (message selon le statut courant), `lineup_quota_exceeded` (limite et portée), `lineup_post_expired`, `lineup_rate_limited` et `discord_unavailable` (décompte).

## `/posts/new` et `/posts/:postId/edit` Éditeur (`features/post-editor`)

- Protégé (`purpose: editor`). But : créer ou modifier une annonce, en étapes : `type`, `content`, `positions`, `requirements`, `application`, `commitment`, `extras`, `review`.
- API : `POST /lineup/posts` (brouillon), `PATCH /lineup/posts/{id}`, `POST .../publish`, `GET /lineup/me/guilds` (serveurs gérés), `GET /lineup/me/experiences` (expérience mise en avant), `GET /lineup/catalog`, `GET /lineup/posts/{id}` en édition. Seuls les champs modifiés sont envoyés.
- États : chargement, aucun serveur revendiqué, brouillon restauré après connexion (`lineup.postDraft.<id|new>`, avec "Abandonner"), étapes en erreur, aperçu, jauge de quota dans la relecture.
- Erreurs : un 422 est réparti par champ sur l'étape concernée (`FIELD_BY_CODE`), `lineup_form_unavailable` (étape candidature), `lineup_positions_other_required` et `lineup_positions_other_unexpected` (étape postes), `lineup_experience_not_found`, `lineup_experience_not_verified` et `lineup_featured_experience_user_only` (étape options), `lineup_post_expired` (date d'expiration), `lineup_guild_profile_missing`, `guild_suspended` et `lineup_guild_forbidden` (bandeau de serveur), `lineup_quota_exceeded`.

## `/me/posts` Mes annonces (`features/my-posts`)

- Protégé (`posts`). But : voir ses annonces par statut (onglets : toutes, publiées, brouillons, fermées, masquées) et agir.
- API : `GET /lineup/me/posts` (curseur, filtre `status`), `POST .../publish`, `POST .../close`, `DELETE`.
- États : chargement, vide propre à chaque onglet, annonce masquée sans actions d'édition, annonce expirée, jauge de quota, confirmation de suppression.
- Erreurs : `lineup_quota_exceeded`, `lineup_post_expired`, `lineup_post_invalid_status`, `lineup_post_not_found`.

## `/guilds` Annuaire (`features/guilds`)

- But : trouver un serveur qui recrute.
- API : `GET /lineup/guilds` (curseur), `GET /lineup/catalog`.
- Filtres : thème, recherche, NSFW (confirmation d'âge). Invitation à revendiquer son serveur (connexion si anonyme).
- États : chargement, vide, "Charger plus", pages vides suivies automatiquement.
- Erreurs : `theme_invalid`, `cursor_invalid`.

## `/guilds/claim` Revendiquer un serveur (`features/claim`)

- Protégé (`claim`). But : rattacher un serveur Discord à Lineup avec un code d'invitation.
- API : `GET /lineup/me/guilds`, `POST /lineup/me/refresh-guilds`, `POST /lineup/guilds/claim`.
- États : liste des serveurs de la personne (avec ou sans Moddy, revendiqué ou non), liste périmée (`StaleNotice`), actualisation avec décompte, aide sur l'invitation (`InviteHelp`), succès (snackbar puis redirection vers la gestion du serveur), brouillon conservé avant reconnexion.
- Erreurs : `lineup_reauth_required` (bouton d'autorisation), `lineup_guild_forbidden` (aide, droits actualisés), `lineup_guild_already_claimed` (lien vers le profil ou la gestion), `guild_suspended` (`SanctionNotice`), `invite_invalid`, `invite_not_found`, `invite_expiring`, `invite_guild_mismatch` (sur le champ), `discord_unavailable` et `lineup_rate_limited` (décompte), validation locale de la longueur du code.

## `/guilds/:guildId` Profil d'un serveur (`features/guild-profile`)

- But : présenter un serveur et ses annonces.
- API : `GET /lineup/guilds/{id}`.
- États : chargement, introuvable, porte NSFW (`NsfwGate`, serveur NSFW), `StaleNotice` si `stale`, avis "non listé" et "invitation supprimée" pour qui peut gérer, accès à la gestion si `can_manage`, signalement sinon.
- Erreurs : `lineup_guild_not_found`.

## `/guilds/:guildId/manage` Gestion (`features/guild-manage`)

- Protégé (`manage`). But : modifier le profil, voir l'instantané Discord, gérer les annonces du serveur, supprimer le profil.
- API : `GET /lineup/guilds/{id}`, `PUT /lineup/guilds/{id}`, `POST .../refresh`, `DELETE /lineup/guilds/{id}`, `GET /lineup/me/posts` (annonces du serveur), `POST/DELETE` d'annonces, `GET /lineup/catalog`.
- États : chargement, introuvable, accès refusé (pas `can_manage`), `StaleNotice`, brouillon conservé avant reconnexion, confirmation de suppression.
- Erreurs : `lineup_guild_not_found`, `guild_suspended`, `lineup_guild_forbidden`, `invite_*` (dont `invite_expiring`), `lineup_rate_limited` (actualisation), `discord_unavailable`, validation 422 par champ.

## `/users/:userId` Profil d'une personne (`features/user-profile`)

- But : voir le profil, les expériences et les annonces d'une personne.
- API : `GET /lineup/users/{id}`.
- États : chargement, introuvable (404), `StaleNotice`, vue privée (soi-même et staff voient les expériences en attente ou refusées), états vides propres à soi ou à autrui, lien vers l'édition de son propre profil.
- Erreurs : 404 (`lineup_user_not_found`).

## `/me` Mon profil (`features/me-profile`)

- Protégé (`profile`). But : modifier titre, bio, "ouvert aux propositions", liens, langues, fuseau horaire.
- API : `GET /lineup/me/profile`, `PUT /lineup/me/profile` (seuls les champs modifiés), `GET /lineup/catalog`.
- États : chargement, formulaire, brouillon conservé avant reconnexion, succès (snackbar).
- Erreurs : 422 par champ, session expirée (retour à la connexion).

## `/me/experiences` Mes expériences (`features/experiences`)

- Protégé (`experiences`). But : gérer son parcours (ajout, modification, ordre par glisser-déposer, clavier ou boutons, suppression) et la vérification de chaque expérience.
- API : `GET/POST /lineup/me/experiences`, `PATCH` et `DELETE .../{id}`, `PUT .../order`, `POST .../{id}/verify`, `POST .../{id}/request-review`, `GET /lineup/catalog`.
- États : chargement, vide, boîte d'ajout ou de modification (brouillon `lineup-experience-draft`), confirmation de suppression, statut de vérification par expérience (`VerificationBox`) : non vérifiée, en attente de revue manuelle, vérifiée, refusée.
- Erreurs : `lineup_reauth_required` (autoriser Lineup), `lineup_verification_failed` (`not_member`, `no_staff_permission`, avec demande de revue manuelle si `can_request_review`), `lineup_verification_not_applicable` (`not_guild`, `ended`), `lineup_experience_already_verified`, `lineup_review_already_pending`, `lineup_rate_limited` (décompte), `discord_unavailable`, `invite_*` (dans la boîte), `lineup_experience_limit`, `lineup_experience_order_invalid`, `lineup_experience_not_found`.

## `/staff` (redirige vers `/staff/reviews`) Console staff (`features/staff`)

Réservée au staff (404 sinon). Quatre sections liées par la navigation de `StaffLayout`. Les lectures et actions gèrent `staff_only` et `lineup_rate_limited` (`parts.tsx`).

### `/staff/reviews` Vérifications

- But : file des expériences à vérifier (statuts : en attente, non vérifiées, vérifiées, refusées ; les plus anciennes en haut).
- API : `GET /lineup/staff/experiences`, `POST .../{id}/verify`, `POST .../{id}/reject` (motif obligatoire), `GET /lineup/users/{id}` (propriétaire).
- États : chargement, file vide, règles de vérification, "Charger plus". Après action, l'expérience quitte la liste courante.

### `/staff/reports` Signalements

- But : traiter les signalements (ouverts, résolus, rejetés, tous).
- API : `GET /lineup/staff/reports`, `POST .../{id}/resolve`, `POST .../{id}/dismiss`.
- Erreurs : `lineup_report_already_handled`, `lineup_report_not_found`. Depuis un signalement d'annonce, "Masquer" ouvre la section Annonces avec `?action=hide`.

### `/staff/badges` Badges

- But : attribuer ou retirer un badge manuel à un serveur ou une personne.
- API : `GET /lineup/staff/badges` (filtre `entity_type`, deux appels fusionnés pour "tous", limit/offset), `PUT` et `DELETE /lineup/staff/badges/{entity_type}/{id}/{badge}`, `GET /lineup/catalog`.
- Erreurs : `lineup_badge_not_found`, `lineup_entity_type_invalid`, `lineup_badge_invalid`. Brouillon du formulaire conservé (`lineup-staff-grant`).

### `/staff/posts` Annonces

- But : masquer une annonce ou la rendre visible.
- API : `GET /lineup/posts/{id}` (`usePost`), `POST /lineup/staff/posts/{id}/hide`, `POST .../unhide`.
- Erreurs : `lineup_post_not_hidden` (propre à cette page) ; les autres passent par le message générique. L'annonce se charge par son identifiant (depuis un signalement ou la saisie).

## `*` Page introuvable (`app/NotFoundPage.tsx`)

Page spéciale (sans pied de page) : lien vers l'accueil. `RouteError` affiche l'erreur d'une route dans la coque.

## `/__ui` Galerie (développement seulement)

`dev/UiGallery.tsx` : les primitives de `src/ui` et les composants métier avec des données factices (`galleryData.ts`). Absente du build de production.
