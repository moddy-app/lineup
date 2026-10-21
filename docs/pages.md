# Pages

Une section par route de `src/app/paths.ts`. Toutes les pages sont chargées à la demande. Les erreurs non listées passent par `ErrorState` / `errorMessage` (message générique ou par code, bouton "Réessayer", décompte si `Retry-After`). Les routes API sont détaillées dans [coverage.md](coverage.md).

## `/` Recrutements et `/people` Candidats (`features/feed`)

- Deux pages, un seul composant (`FeedView`, paramétré par `kind`) : `/` (`FeedPage`) liste les annonces `guild` (serveurs qui recrutent), `/people` (`PeoplePage`) les annonces `user` (personnes qui proposent leurs services). Le type n'est ni dans l'interface ni dans l'URL : la route le fixe. Une ancienne adresse `/?type=user` (ou `kind=`) est redirigée vers la bonne page, les autres filtres conservés (`legacyKindRedirect`).
- Haut de bas : `PageHeader` (titre, une ligne, action principale « Publier une annonce » ou « Proposer mes services » vers `paths.postNew()` (`paths.postNew('user')`, soit `?kind=user`, sur `/people`), connexion si anonyme, désactivée si suspendu), `FilterBar`, colonne de `PostCard` (840 px au plus, centrée), « Charger plus » / fin de liste. Pas de jauge de quota ici (elle reste dans l'éditeur et Mes annonces).
- API : `GET /lineup/posts` (`useFeed`, curseur, `kind` envoyé), `GET /lineup/catalog` (filtres).
- Filtres dans l'URL (`feedFilters.ts`) : `q` (recherche, délai 350 ms, champ principal), chips Postes (multi), Langues (multi), Thème (single), Rémunération (single), Contenu adulte (Masquer / Afficher, passe par `NsfwConfirmDialog`). `tags` reste lisible depuis l'URL mais n'a pas de chip (pas de liste connue). Une valeur inconnue du catalogue est ignorée.
- `PostCard` : carte-lien ; avatar ou icône, `DisplayName` (serveur ou auteur, avec coche), date relative, titre h3, description sur 2 lignes, une ligne de métadonnées (postes en petites pills, rémunération, heures, postes ouverts, expiration proche, drapeaux). Pas de pill de type.
- États : chargement, vide sans filtre, vide avec filtre ("réinitialiser"), "Charger plus", fin de liste, mise à jour (`aria-busy`), via `EmptyState compact`.
- Erreurs : `lineup_filter_invalid` et `cursor_invalid` proposent de repartir de zéro ; réseau et 5xx via `ErrorState`.

## `/posts/:postId` Annonce (`features/post`)

- But : lire une annonce, candidater, signaler ; pour l'auteur ou le gestionnaire, publier, rouvrir, modifier, fermer, supprimer.
- API : `GET /lineup/posts/{id}`, `POST .../publish`, `POST .../close`, `DELETE`, `POST /lineup/reports`, `GET /lineup/guilds/{id}` (membres, en ligne, badges) ou `GET /lineup/users/{id}` (badges, expérience mise en avant), `GET /lineup/me/profile`, `GET /lineup/me/experiences` (exigences).
- De haut en bas : lignes d'état (brouillon, fermée, masquée avec motif, expirée), en-tête en carte (titre, ligne « serveur ou personne » avec `DisplayName` lien vers le profil, puis dates séparées par « · » ; « Modifiée » n'apparaît que si la date dépasse la publication d'une minute ; à droite `ApplicationAction` pour un visiteur, ou pour un éditeur l'action principale `Publier` / `Rouvrir` / `Modifier`, puis un menu `more_vert` : autres actions, ou Signaler), erreurs d'action, corps. Dès 1100 px : colonne principale de cartes (description Markdown et conditions ensemble, puis expérience mise en avant) ; colonne latérale de cartes : Résumé (une `FactList` : une icône puis la valeur par ligne, sans sous-titre ni filet, le nom du champ en infobulle de l'icône ; postes et étiquettes en `TagLabel`, langue en drapeaux, fuseau en texte), puis carte du serveur ou de la personne (`InlineStats`, « Voir le profil »). Dessous : une colonne, Résumé juste après l'en-tête.
- États : chargement, introuvable, porte NSFW (`NsfwGate`) si le thème est `nsfw`, conditions remplies ou non.
- Erreurs : `lineup_post_not_found`, `lineup_post_hidden`, `lineup_post_invalid_status`, `lineup_quota_exceeded` (lien vers Mes annonces), `lineup_post_expired` (lien vers la date), `lineup_rate_limited` et `discord_unavailable` (décompte, réessayer).

## `/posts/new` et `/posts/:postId/edit` Éditeur (`features/post-editor`)

- Protégé (`purpose: editor`). Espace de gestion : `SettingsLayout` (titre « Nouvelle annonce » / « Modifier l'annonce »). But : créer ou modifier une annonce, en étapes : `type`, `content`, `positions`, `requirements`, `application`, `commitment`, `extras`, `review`.
- Structure, de haut en bas : bandeau discret « brouillon restauré » (avec « Abandonner ») ; sous 1100 px, une ligne « Étape 3 sur 8 · Postes » et une barre fine ; à partir de 1100 px, la liste verticale des étapes (icône d'état, nom) dans une colonne étroite à gauche ; une étape = un `SettingsPanel` (titre, une phrase d'aide, champs, `Précédent` outlined / `Suivant` filled en bas). La relecture liste chaque étape avec « Modifier », montre un aperçu du titre et de la description rendue en Markdown (`Markdown`), puis la jauge de quota ; boutons `Précédent`, `Enregistrer en brouillon`, `Publier`.
- Type : deux grandes options radio (« Un serveur recrute », « Proposer mes services »). Query string : `?kind=user` présélectionne « Proposer mes services » et ouvre directement l'étape contenu (lien depuis la page Candidats) ; `?guild=<id>` présélectionne le serveur ; `?focus=expiry` (édition) ouvre l'étape options.
- La description accepte le Markdown (dit sous le champ).
- API : `POST /lineup/posts` (brouillon), `PATCH /lineup/posts/{id}`, `POST .../publish`, `GET /lineup/me/guilds` (serveurs gérés), `GET /lineup/me/experiences` (expérience mise en avant), `GET /lineup/catalog`, `GET /lineup/posts/{id}` en édition. Seuls les champs modifiés sont envoyés.
- États : chargement, aucun serveur revendiqué, brouillon restauré après connexion (`lineup.postDraft.<id|new>`), étapes en erreur, jauge de quota dans la relecture.
- Erreurs : un 422 est réparti par champ sur l'étape concernée (`FIELD_BY_CODE`), `lineup_form_unavailable` (étape candidature), `lineup_positions_other_required` et `lineup_positions_other_unexpected` (étape postes), `lineup_experience_not_found`, `lineup_experience_not_verified` et `lineup_featured_experience_user_only` (étape options), `lineup_post_expired` (date d'expiration), `lineup_guild_profile_missing`, `guild_suspended` et `lineup_guild_forbidden` (bandeau de serveur), `lineup_quota_exceeded`.

## `/me/posts` Mes annonces (`features/my-posts`)

- Protégé (`posts`). Espace de gestion : `SettingsLayout` titre « Annonces », action filled « Nouvelle annonce ». But : voir ses annonces par statut et agir.
- Structure : jauge de quota compacte (`QuotaMeter`, une ligne) ; chips de statut sélectionnables (toutes, publiées, brouillons, fermées, masquées ; `?status=` dans l'URL) ; liste compacte dans une carte (`Card`), une `InnerCard` par annonce : titre (lien), serveur ou « Pour moi » (`DisplayName`), statut, date relative, expiration proche ; à droite une action principale `md-text-button` (Publier pour un brouillon, Modifier sinon) et un menu `more_vert` (Modifier pour un brouillon, Fermer, Rouvrir, Supprimer en erreur). Une annonce masquée n'a ni action ni menu, seulement le motif en une ligne.
- API : `GET /lineup/me/posts` (curseur, filtre `status`), `POST .../publish`, `POST .../close`, `DELETE`.
- États : chargement, vide propre à chaque statut, erreur de ligne avec réessai, pagination « Charger plus », confirmation de suppression.
- Erreurs : `lineup_quota_exceeded`, `lineup_post_expired`, `lineup_post_invalid_status`, `lineup_post_not_found`.

## `/guilds` Annuaire (`features/guilds`)

- But : trouver un serveur qui recrute. Vitrine (`ShowcasePage`).
- API : `GET /lineup/guilds` (curseur), `GET /lineup/catalog`.
- De haut en bas : `PageHeader` (« Serveurs », sous-titre court, action « Ajouter mon serveur » en outlined, vers `paths.myGuilds()` ; connexion d'abord si anonyme) ; `FilterBar` (recherche `q`, chips Thème en choix simple et Contenu adulte en choix simple avec confirmation d'âge `NsfwConfirmDialog`) ; grille de cartes-liens compactes (3 colonnes dès 1100 px, 2 dès 700 px, 1 en dessous) ; « Charger plus ».
- Carte : icône 48 px, `DisplayName` (coche), `InlineStats` compacts (en ligne, membres), pill du thème, `BadgeStrip` (sans badges Discord). Pas de description : `GuildCard` n'en a pas.
- Filtres dans l'URL (`q`, `theme`, `nsfw=1`). États : chargement, vide, vide filtré (« Effacer les filtres »), pages vides suivies automatiquement.
- Erreurs : `theme_invalid`, `cursor_invalid`.

## `/me/guilds` Mes serveurs (`features/claim`)

- Ancienne adresse `/guilds/claim` : redirection (`Navigate replace`) vers `/me/guilds` ; `paths.guildClaim()` renvoie `/me/guilds`.
- Protégé (`claim`). Espace de gestion (`SettingsLayout`, titre « Serveurs », description « Les serveurs Discord que vous gérez »). But : voir les serveurs que l'on gère et en ajouter à Lineup avec une invitation.
- De haut en bas : bouton icône « Actualiser la liste » dans l'en-tête (décompte quand la limite de débit s'applique) ; `StaleNotice` sur une ligne si la liste est périmée ; carte « Sur Lineup » (une `InnerCard` par serveur déjà revendiqué : icône, `DisplayName` avec coche, « Dans l'annuaire » ou « Masqué » d'après `useGuild`, « Voir le profil » discret, « Gérer » outlined) ; carte « À ajouter » (une `InnerCard` par serveur non revendiqué : icône, nom, « Moddy installé » si `has_moddy`, « Ajouter » outlined) avec en bas « Ajouter avec une invitation » (champ libre). L'API ne renvoie que les serveurs gérables : il n'y a pas de liste des serveurs « d'un autre » ou non gérables.
- « Ajouter » ouvre un `Dialog` de revendication : serveur ciblé dans le titre, champ d'invitation, aide `InviteHelp` repliée. Pour un serveur avec Moddy, la phrase d'aide dit que l'invitation reste demandée (voir `backend-notes.md`, point 9). Succès : snackbar puis redirection vers la gestion du profil renvoyé par l'API. `claimDraft.ts` : brouillon (invitation + serveur visé) gardé en session avant la reconnexion, le dialogue se rouvre au retour.
- API : `GET /lineup/me/guilds`, `POST /lineup/me/refresh-guilds`, `POST /lineup/guilds/claim`, `GET /lineup/guilds/{id}` (statut des serveurs revendiqués).
- États : chargement, liste vide (avec le bouton d'invitation libre), liste périmée, erreur de lecture, réautorisation.
- Erreurs : `lineup_reauth_required` (bouton d'autorisation), `lineup_guild_forbidden` (aide, droits actualisés puis nouvel essai), `lineup_guild_already_claimed` (lien vers le profil), `guild_suspended` (`SanctionNotice`), `invite_invalid`, `invite_not_found`, `invite_expiring`, `invite_guild_mismatch` (sur le champ ; la revendication ne la renvoie pas aujourd'hui : le serveur revendiqué est celui de l'invitation), `discord_unavailable` et `lineup_rate_limited` (décompte), validation locale de la longueur.

## `/guilds/:guildId` Profil d'un serveur (`features/guild-profile`)

- But : présenter un serveur et ses annonces. Vitrine (`ShowcasePage`), aucun formulaire de gestion.
- API : `GET /lineup/guilds/{id}`.
- De haut en bas :
  1. bannière (`banner_url`, sinon `splash_url`) : bande d'image 180 px (120 px sous 700 px), absente sans image ;
  2. en-tête en carte : `GuildIcon` 72 px, nom en h1 avec la coche (`DisplayName`), puis le `BadgeStrip` juste dessous ; à droite « Rejoindre le serveur » (filled, seulement si l'invitation est valide), « Gérer » (outlined, si `can_manage`, seule passerelle vers `paths.guildManage`) et un menu `more_vert` (Signaler, sauf pour les gestionnaires ; Copier le lien ; Copier l'identifiant du serveur) ;
  3. `StaleNotice` si `stale` ; pour les gestionnaires, une ligne discrète par avis (profil non listé, invitation supprimée avec lien « Remplacer l'invitation ») ;
  4. corps : une colonne, deux dès 1100 px. À gauche « À propos » (`Markdown`, étiquettes en `TagLabel`) et « Annonces ouvertes » (`PostCard` en `row`, une `InnerCard` par annonce). À droite, en cartes : « Informations » (`FactList`, comme le Résumé d'une annonce et l'encart du profil de personne : membres, boosts si > 0, « Créé en » mois et année, thème, « Langue(s) : » en drapeaux ; pas de nombre de membres en ligne), « Liens » (`LinkList` : une `InnerCard` lien par ligne), « Équipe » (une `InnerCard` lien par membre). Sous 1100 px, Informations et Liens passent juste après l'en-tête.
- États : chargement, introuvable, porte NSFW (`NsfwGate`, serveur NSFW).
- Signalement : `ReportDialog` ouvert depuis le menu (connexion si anonyme).
- Erreurs : `lineup_guild_not_found`.

## `/guilds/:guildId/manage` Gestion (`features/guild-manage`)

- Protégé (`manage`). Espace de gestion (`SettingsLayout`) : titre = nom du serveur (`DisplayName`), description « Gestion du profil Lineup », action « Voir le profil public ». Les états introuvable et accès refusé sont aussi dans `SettingsLayout`.
- De haut en bas : liens d'ancre vers les sections (`SectionNav`, `sectionIds.ts`) puis des `SettingsPanel` : « Profil public » (description Markdown avec aperçu et « Utiliser la description Discord », thème et étiquettes, langues en cases compactes avec drapeau, liens) ; « Invitation » (code actuel en `Pill` + état valide ou introuvable, nouvelle invitation, aide repliée) ; « Visibilité » (interrupteur) ; barre Enregistrer / Annuler commune aux trois panneaux (`position: sticky` en bas, seulement quand il y a des changements ou une erreur, les erreurs s'y affichent) ; « Annonces du serveur » (chips de filtre par statut, « Nouvelle annonce », `QuotaMeter` du serveur, lignes titre / statut / date avec menu `more_vert` : modifier, fermer ou rouvrir ou publier, supprimer) ; « Données Discord » (`InlineStats` membres et en ligne, `StaleNotice`, « Actualiser maintenant » avec décompte) ; « Zone de danger » (suppression derrière `ConfirmDialog`, titre en `error`). L'API ne donne pas la date de dernière lecture : elle n'est pas affichée.
- API : `GET /lineup/guilds/{id}`, `PUT /lineup/guilds/{id}`, `POST .../refresh`, `DELETE /lineup/guilds/{id}`, `GET /lineup/me/posts` (annonces du serveur, et une requête « publiées » pour le quota), `POST/DELETE` d'annonces, `GET /lineup/catalog`.
- États : chargement, introuvable, accès refusé (pas `can_manage`), `StaleNotice`, brouillon conservé avant reconnexion, confirmation de suppression.
- Erreurs : `lineup_guild_not_found`, `guild_suspended`, `lineup_guild_forbidden`, `invite_*` (dont `invite_expiring`, qui ouvre l'aide), `lineup_rate_limited` (actualisation), `discord_unavailable`, validation 422 par champ.

## `/users/:userId` Profil d'une personne (`features/user-profile`)

- Vitrine (`ShowcasePage`). But : voir le profil, les expériences et les annonces d'une personne.
- API : `GET /lineup/users/{id}` ; chaque expérience de serveur lit `GET /lineup/guilds/{id}` (cache) pour l'icône et la coche (un 404 laisse l'icône par défaut ; un serveur NSFW garde l'icône par défaut).
- De haut en bas : carte d'en-tête (bannière pleine largeur en haut de la carte si `banner_url`, 160 px, 110 px sur mobile ; avatar 96 px avec décoration, `DisplayName` en h1 avec coche, puis juste dessous `@pseudo` en texte simple, puis le titre, « Ouvert aux propositions », `BadgeStrip` sans badge Discord ; à droite « Modifier mon profil » pour soi, et pour tous un menu `more_vert` : Copier l'identifiant, Copier le lien du profil, Signaler (pas pour soi)) ; `StaleNotice` ; deux colonnes dès 1100 px (une en dessous). Colonne principale, une carte par section : « Présentation » (Markdown), « Expériences » (une `InnerCard` par `ExperienceRow`, dans `ExperienceList`), « Annonces » (`PostCard` `variant="row"`). Colonne latérale : carte « Informations » (compte créé en mois et année, fuseau et heure locale, `LanguageFlags`), carte « Liens » (`LinkList`).
- États : chargement, introuvable (404), `StaleNotice`, vue privée (soi-même et staff voient les expériences en attente, refusées ou non vérifiées), vides propres à soi ou à autrui (une ligne de texte).
- Erreurs : 404 (`lineup_user_not_found`).

## `/me` Mon profil (`features/me-profile`)

- Protégé (`profile`). Espace de gestion (`SettingsLayout`, titre « Profil », action « Voir mon profil public »). But : modifier titre, bio, « ouvert aux propositions », liens, langues, fuseau horaire.
- API : `GET /lineup/me/profile`, `PUT /lineup/me/profile` (seuls les champs modifiés), `GET /lineup/catalog`.
- Panneaux (`SettingsPanel`) : « Présentation » (titre, bio « Markdown accepté », aperçu Markdown repliable), « Disponibilité » (interrupteur), « Langues et fuseau » (cases avec drapeau, fuseau, heure locale, suggestion du navigateur), « Liens » (ajout en bas du panneau). Une barre collante Annuler (outlined) / Enregistrer (filled) apparaît tant qu'il y a des changements (ou une erreur sans champ).
- États : chargement, formulaire, brouillon conservé avant reconnexion (`registerBeforeLogin`), succès (snackbar).
- Erreurs : 422 par champ, session expirée (retour à la connexion).

## `/me/experiences` Mes expériences (`features/experiences`)

- Protégé (`experiences`). Espace de gestion (`SettingsLayout`, titre « Expériences », action filled « Ajouter une expérience »). But : gérer son parcours (ajout, modification, ordre, suppression) et la vérification de chaque expérience.
- API : `GET/POST /lineup/me/experiences`, `PATCH` et `DELETE .../{id}`, `PUT .../order`, `POST .../{id}/verify`, `POST .../{id}/request-review`, `GET /lineup/catalog`.
- De haut en bas : compteur et jauge ; une carte avec la liste réordonnable (poignée dnd-kit, clavier) ; chaque expérience est une `InnerCard` (poignée, `ExperienceRow` en `div`, outils) + vérification compacte (`VerificationBox` : détails de contrôle repliés, boutons « Vérifier automatiquement » et « Demander une revue manuelle », formulaires en ligne seulement quand ils s'ouvrent) + bouton modifier et menu `more_vert` (monter, descendre, supprimer) ; « Vérification » (règles) repliée en bas.
- États : chargement, vide, boîte d'ajout ou de modification (brouillon `lineup-experience-draft`), confirmation de suppression, statut par expérience : non vérifiée, en attente de revue manuelle, vérifiée, refusée.
- Erreurs : `lineup_reauth_required` (autoriser Lineup), `lineup_verification_failed` (`not_member`, `no_staff_permission`, avec demande de revue manuelle si `can_request_review`), `lineup_verification_not_applicable` (`not_guild`, `ended`), `lineup_experience_already_verified`, `lineup_review_already_pending`, `lineup_rate_limited` (décompte), `discord_unavailable`, `invite_*` (dans la boîte), `lineup_experience_limit`, `lineup_experience_order_invalid`, `lineup_experience_not_found`.

## `/staff` (redirige vers `/staff/reviews`) Console staff (`features/staff`)

Réservée au staff (404 sinon). Quatre sections dans `StaffLayout` : navigation latérale (liste compacte sous 900 px, classes `.settings-*`), titre « Console staff », puis la section : titre, chips de statut (`StatusChips`), règles repliables (`Rules`), liste d'`InnerCard` empilées, sans filet (nom via `DisplayName`, actions à droite, motif dans `ActionDialog`). Les lectures et actions gèrent `staff_only` et `lineup_rate_limited` (`parts.tsx`).

### `/staff/reviews` Vérifications

- But : file des expériences à vérifier (statuts : en attente, non vérifiées, vérifiées, refusées ; les plus anciennes en haut).
- API : `GET /lineup/staff/experiences`, `POST .../{id}/verify`, `POST .../{id}/reject` (motif obligatoire), `GET /lineup/users/{id}` (propriétaire).
- États : chargement, file vide, règles repliables, preuve repliable par expérience, "Charger plus". Après action, l'expérience quitte la liste courante.

### `/staff/reports` Signalements

- But : traiter les signalements (ouverts, résolus, rejetés, tous).
- API : `GET /lineup/staff/reports`, `POST .../{id}/resolve`, `POST .../{id}/dismiss`.
- Erreurs : `lineup_report_already_handled`, `lineup_report_not_found`. Depuis un signalement d'annonce, "Masquer" ouvre la section Annonces avec `?action=hide`.

### `/staff/badges` Badges

- But : attribuer ou retirer un badge manuel à un serveur ou une personne. Formulaire compact (type, id, badge, note) en tête, puis la liste d'`InnerCard`.
- API : `GET /lineup/staff/badges` (filtre `entity_type`, deux appels fusionnés pour "tous", limit/offset), `PUT` et `DELETE /lineup/staff/badges/{entity_type}/{id}/{badge}`, `GET /lineup/catalog`.
- Erreurs : `lineup_badge_not_found`, `lineup_entity_type_invalid`, `lineup_badge_invalid`. Brouillon du formulaire conservé (`lineup-staff-grant`).

### `/staff/posts` Annonces

- But : masquer une annonce ou la rendre visible.
- API : `GET /lineup/posts/{id}` (`usePost`), `POST /lineup/staff/posts/{id}/hide`, `POST .../unhide`.
- Erreurs : `lineup_post_not_hidden` (propre à cette page) ; les autres passent par le message générique. L'annonce se charge par son identifiant (champ + Charger, ou depuis un signalement), aperçu compact, Masquer / Démasquer.

## `*` Page introuvable (`app/NotFoundPage.tsx`)

Page spéciale : lien vers l'accueil. `RouteError` affiche l'erreur d'une route dans la coque.

## `/__ui` Galerie (développement seulement)

`dev/UiGallery.tsx` : les primitives de `src/ui` et les composants métier avec des données factices (`galleryData.ts`), puis les composants de la refonte (`dev/FoundationGallery.tsx` : noms vérifiés, `BadgeStrip`, drapeaux, `InlineStats`, `Markdown`, `FilterBar`, `PageHeader`, `SettingsLayout`). Absente du build de production.
