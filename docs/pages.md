# Pages

Une section par route de `src/app/paths.ts`. Toutes les pages sont chargées à la demande. Les erreurs non listées passent par `ErrorState` / `errorMessage` (message générique ou par code, bouton "Réessayer", décompte si `Retry-After`). Les routes API sont détaillées dans [coverage.md](coverage.md).

## `/` Projets et `/people` Profils (`features/feed`)

- Deux pages, un seul composant (`FeedView`, paramétré par `kind`) : `/` (`FeedPage`) liste les annonces `guild` (serveurs qui recrutent), `/people` (`PeoplePage`) les annonces `user` (personnes qui proposent leurs services). Le type n'est ni dans l'interface ni dans l'URL : la route le fixe. Une ancienne adresse `/?type=user` (ou `kind=`) est redirigée vers la bonne page, les autres filtres conservés (`legacyKindRedirect`).
- Haut de bas : `PageHeader` (titre, une ligne, action principale « Publier une annonce » ou « Proposer mes services » vers `paths.postNew()` (`paths.postNew('user')`, soit `?kind=user`, sur `/people`), connexion si anonyme, désactivée si suspendu), `FilterBar`, grille de `PostCard` `variant="tile"` sur toute la largeur de contenu (cartes carrées, `.feed-grid` : 4 colonnes à 1400 px, 2 sur téléphone ; l'état de chargement, « Charger plus » et la fin de liste restent dessous, pleine largeur), « Charger plus » / fin de liste. Pas de jauge de quota ici (elle reste dans l'éditeur et Mes annonces).
- API : `GET /lineup/posts` (`useFeed`, curseur, `kind` envoyé), `GET /lineup/catalog` (filtres).
- Filtres dans l'URL (`feedFilters.ts`) : `q` (recherche, délai 350 ms, champ principal), chips Postes (multi), Langues (multi), Thème (single), Rémunération (single), Contenu adulte (Masquer / Afficher, passe par `NsfwConfirmDialog`). `tags` reste lisible depuis l'URL mais n'a pas de chip (pas de liste connue). Une valeur inconnue du catalogue est ignorée.
- `PostCard` `tile` : carte-lien carrée ; avatar ou icône, `DisplayName` (serveur ou auteur, avec coche) et date relative en dessous, titre h3 sur 2 lignes (3 sur téléphone), description coupée à 3 lignes (4 dès 1000 px, masquée sur téléphone), pied : deux postes au plus en petites pills avec « +N », rémunération. Rien ne dépasse du carré. Pas de pill de type. La variante `feed` (carte large) reste disponible, `row` sert aux profils.
- États : chargement, vide sans filtre, vide avec filtre ("réinitialiser"), "Charger plus", fin de liste, mise à jour (`aria-busy`), via `EmptyState compact`.
- Erreurs : `lineup_filter_invalid` et `cursor_invalid` proposent de repartir de zéro ; réseau et 5xx via `ErrorState`.

## `/posts/:postId` Annonce (`features/post`)

- But : lire une annonce, candidater, signaler ; pour l'auteur ou le gestionnaire, publier, rouvrir, modifier, fermer, supprimer.
- API : `GET /lineup/posts/{id}`, `POST .../publish`, `POST .../close`, `DELETE`, `POST /lineup/reports`, `GET /lineup/guilds/{id}` (membres, en ligne, badges) ou `GET /lineup/users/{id}` (badges, expérience mise en avant), `GET /lineup/me/profile`, `GET /lineup/me/experiences` (exigences).
- De haut en bas : lignes d'état (brouillon, fermée, masquée avec motif, expirée), en-tête en carte (titre, ligne « serveur ou personne » avec `DisplayName` lien vers le profil, puis dates séparées par « · » ; « Modifiée » n'apparaît que si la date dépasse la publication d'une minute ; à droite `ApplicationAction` pour un visiteur, ou pour un éditeur l'action principale `Publier` / `Rouvrir` / `Modifier`, puis un menu `more_vert` : autres actions, ou Signaler), erreurs d'action, corps. Dès 1100 px : colonne principale de cartes (description Markdown et conditions ensemble, puis expérience mise en avant) ; colonne latérale de cartes : Résumé (une `FactList` : une icône puis la valeur par ligne, sans sous-titre ni filet, le nom du champ en infobulle de l'icône ; postes et étiquettes en `TagLabel`, langue en drapeaux, fuseau en texte), puis carte du serveur ou de la personne (`InlineStats`, « Voir le profil »). Dessous : une colonne, Résumé juste après l'en-tête.
- États : chargement, introuvable, porte NSFW (`NsfwGate`) si `post.guild.nsfw` ou si le thème est `nsfw` (`isNsfw`), conditions remplies ou non.
- Erreurs : `lineup_post_not_found`, `lineup_post_hidden`, `lineup_post_invalid_status`, `lineup_quota_exceeded` (lien vers Mes annonces), `lineup_post_expired` (lien vers la date), `lineup_rate_limited` et `discord_unavailable` (décompte, réessayer).

## `/posts/new` et `/posts/:postId/edit` Éditeur (`features/post-editor`)

- Protégé (`purpose: editor`). Dans le tableau de bord (`SettingsLayout`, titre « Nouvelle annonce » / « Modifier l'annonce »), avec le contexte de l'auteur : `?guild=<id>` (serveur revendiqué) donne le contexte de ce serveur, sinon vous ; en édition, le contexte vient de l'annonce (`post.guild`, prop `context`), l'entrée « Annonces » est courante. Les adresses se construisent avec `paths.postNew({kind?, guildId?})`. But : créer ou modifier une annonce, en étapes : `type` (seulement si rien ne fixe l'auteur), `content`, `positions`, `requirements`, `application`, `commitment`, `extras`, `review`.
- Structure, de haut en bas : bandeau discret « brouillon restauré » (avec « Abandonner ») ; sous 1100 px, une ligne « Étape 3 sur 8 · Postes » et une barre fine ; à partir de 1100 px, la liste verticale des étapes (icône d'état, nom) dans une colonne étroite à gauche ; une étape = un `SettingsPanel` (titre, une phrase d'aide, champs, `Précédent` outlined / `Suivant` filled en bas). La relecture liste chaque étape avec « Modifier », montre un aperçu du titre et de la description rendue en Markdown (`Markdown`), puis la jauge de quota ; boutons `Précédent`, `Enregistrer en brouillon`, `Publier`.
- Type : deux grandes options radio (« Un serveur recrute », « Proposer mes services »). Query string : `?kind=user` présélectionne « Proposer mes services » et ouvre directement l'étape contenu (lien depuis la page Profils) ; `?guild=<id>` présélectionne le serveur ; `?focus=expiry` (édition) ouvre l'étape options.
- La description accepte le Markdown (dit sous le champ).
- API : `POST /lineup/posts` (brouillon), `PATCH /lineup/posts/{id}`, `POST .../publish`, `GET /lineup/me/guilds` (serveurs gérés), `GET /lineup/me/experiences` (expérience mise en avant), `GET /lineup/catalog`, `GET /lineup/posts/{id}` en édition. Seuls les champs modifiés sont envoyés.
- États : chargement, aucun serveur revendiqué, brouillon restauré après connexion (`lineup.postDraft.<id|new>`), étapes en erreur, jauge de quota dans la relecture.
- Erreurs : un 422 est réparti par champ sur l'étape concernée (`FIELD_BY_CODE`), `lineup_form_unavailable` (étape candidature), `lineup_positions_other_required` et `lineup_positions_other_unexpected` (étape postes), `lineup_experience_not_found`, `lineup_experience_not_verified` et `lineup_featured_experience_user_only` (étape options), `lineup_post_expired` (date d'expiration), `lineup_guild_profile_missing`, `guild_suspended` et `lineup_guild_forbidden` (bandeau de serveur), `lineup_quota_exceeded`.

## `/me/posts` Mes annonces (`features/my-posts`)

- Protégé (`posts`). Tableau de bord, contexte vous (`SettingsLayout` titre « Annonces », action filled « Nouvelle annonce » vers `paths.postNew({kind: 'user'})`). But : voir ses annonces par statut et agir. Le corps est `PostsManager` (`MyPostsPage.tsx`), partagé avec `/guilds/:id/manage/posts`.
- Structure : jauge de quota compacte (`QuotaMeter`, une ligne) ; chips de statut sélectionnables (toutes, publiées, brouillons, fermées, masquées ; `?status=` dans l'URL) ; liste compacte dans une carte (`Card`, marge `--card-padding` sur les quatre côtés ; chargement, erreur et état vide sont aussi dans la carte), une `InnerCard` par annonce : titre (lien), serveur ou « Pour moi » (`DisplayName`), statut, date relative, expiration proche ; à droite une action principale `md-text-button` (Publier pour un brouillon, Modifier sinon) et un menu `more_vert` (`RowMenu`, `Dropdown` aligné à droite ; Modifier pour un brouillon, Fermer, Rouvrir, Supprimer en erreur). Une annonce masquée n'a ni action ni menu, seulement le motif en une ligne.
- API : `GET /lineup/me/posts` (curseur, filtre `status`), `POST .../publish`, `POST .../close`, `DELETE`.
- États : chargement, vide propre à chaque statut, erreur de ligne avec réessai, pagination « Charger plus », confirmation de suppression.
- Erreurs : `lineup_quota_exceeded`, `lineup_post_expired`, `lineup_post_invalid_status`, `lineup_post_not_found`.

## `/guilds` (ancienne adresse de l'annuaire)

- L'annuaire des serveurs n'existe plus : `/guilds` redirige vers `/` (`Navigate replace`, `paths.feed()`). Les serveurs se trouvent par leurs annonces dans « Projets ». `GET /lineup/guilds` n'est plus appelé par le front. Les profils `/guilds/:guildId` restent.

## `/guilds/:guildId` Profil d'un serveur (`features/guild-profile`)

- But : présenter un serveur et ses annonces. Vitrine (`ShowcasePage`), aucun formulaire de gestion.
- API : `GET /lineup/guilds/{id}`.
- De haut en bas :
  1. bannière (`banner_url`, sinon `splash_url`) : bande d'image 180 px (120 px sous 700 px), absente sans image ;
  2. en-tête en carte : `GuildIcon` 72 px, nom en h1 avec la coche (`DisplayName`), puis le `BadgeStrip` juste dessous ; à droite « Rejoindre le serveur » (filled, seulement si l'invitation est valide et que `invite.url` n'est pas nul : le bot n'a pas toujours pu en créer une), « Gérer » (outlined, si `can_manage`, seule passerelle vers `paths.guildManage`) et un menu `more_vert` (Signaler, sauf pour les gestionnaires ; Copier le lien ; Copier l'identifiant du serveur) ;
  3. `StaleNotice` si `stale` ; pour les gestionnaires, une ligne discrète par avis (profil non listé, invitation supprimée avec lien « Remplacer l'invitation ») ;
  4. corps : une colonne, deux dès 1100 px. À gauche « À propos » (`Markdown`, étiquettes en `TagLabel`) et « Annonces ouvertes » (`PostCard` en `row`, une `InnerCard` par annonce). À droite, en cartes : « Informations » (`FactList`, comme le Résumé d'une annonce et l'encart du profil de personne : membres, boosts si > 0, « Créé en » mois et année, thème, « Langue(s) : » en drapeaux ; pas de nombre de membres en ligne), « Liens » (`LinkList` : une `InnerCard` lien par ligne), « Équipe » (une `InnerCard` lien par membre). Sous 1100 px, Informations et Liens passent juste après l'en-tête.
- États : chargement, introuvable, porte NSFW (`NsfwGate`, serveur NSFW).
- Signalement : `ReportDialog` ouvert depuis le menu (connexion si anonyme).
- Erreurs : `lineup_guild_not_found`.

## Espace de gestion : tableau de bord (`SettingsLayout`)

- Entrée « Tableau de bord » dans la barre du haut (icône `dashboard`, seulement avec une session), après « Profils ». Elle mène à `/me` et est courante sur tout l'espace : `/me` et ses sous-pages, l'éditeur (`/posts/new`, `/posts/:id/edit`) et `/guilds/:id/manage/*` (`app/navMatch.ts`). `/posts/:id` reste sous Recrutements, `/guilds/:id` (profil public) aussi. Voir « Barre du haut » dans [design.md](design.md).
- Colonne de gauche : le **sélecteur de contexte** (`ui/ContextSwitcher.tsx`), puis la navigation du contexte. Le sélecteur est un bloc pleine largeur (bouton `.settings-context-button` : `surface-container-high`, coins `--radius-l`, sans bordure, `md-ripple` et `md-focus-ring`, avatar ou icône, nom, chevron) qui ouvre le `Dropdown` : vous (avatar et nom), les serveurs revendiqués (`useMyGuilds`, `GuildIcon` et nom), puis « Ajouter un serveur » (icône `add`) et « Gérer les serveurs » (icône `settings`), qui ouvrent les deux dialogues ci-dessous. Si la liste charge ou échoue, il ne propose que vous et le serveur de l'adresse (nom lu avec `useGuild`). Accessibilité : `aria-haspopup`, `aria-expanded`, libellé du `Dropdown`.
- Le contexte se déduit de l'adresse (`ui/dashboardContext.ts`, `dashboardContext(pathname, search)`) : `/guilds/:id/manage/*` et `/posts/new?guild=<id>` donnent ce serveur, tout le reste donne vous. Une page qui sait mieux le dit par la prop `context` de `SettingsLayout` (l'éditeur d'une annonce de serveur).
- Contexte « vous » : Profil, Expériences, Annonces.
- Contexte « serveur » : Profil, Invitation, Annonces, Données Discord, Paramètres (une page chacune, voir plus bas).
- Sous 900 px : le sélecteur en haut, puis `CompactNav` (un bouton avec la page courante qui ouvre le `Dropdown` des entrées du contexte).
- **Dialogues des serveurs** (`features/claim`, chargés à la demande par `SettingsLayout` ; état dans l'adresse : `?servers=add` ou `?servers=manage` sur n'importe quelle page du tableau de bord, retiré à la fermeture, `useServersDialog` dans `ui/serversDialog.ts`). `paths.guildClaim()` donne `/me?servers=add`, `paths.myGuilds()` `/me?servers=manage` ; les anciennes routes `/guilds/claim` et `/me/guilds` redirigent vers ces adresses (`Navigate replace`). Les deux dialogues passent par `Dialog` et repartent de zéro à chaque ouverture.
  - « Ajouter un serveur » (`AddServerDialog.tsx`). Étape liste : une `InnerCard` par serveur gérable pas encore sur Lineup (icône, nom, « Moddy installé » si `has_moddy`, « Ajouter » outlined) ; en bas « Ajouter avec une invitation » (texte) et « Actualiser la liste » (bouton icône, décompte de `lineup_rate_limited`), `StaleNotice` si la liste est périmée. Étape serveur, dans le même dialogue, avec « Retour à la liste » : avec Moddy (`has_moddy`), une phrase et « Ajouter », corps `{guild_id}` seul (l'API crée l'invitation permanente) ; sans Moddy ou invitation libre, champ d'invitation obligatoire et aide `InviteHelp` repliée, corps `{invite, guild_id}` (ou `{invite}`). `invite_required` à un `guild_id` seul fait basculer sur le champ. Succès : le dialogue se ferme, snackbar, navigation vers `paths.guildManage` du profil renvoyé (le contexte du sélecteur devient ce serveur). `claimDraft.ts` : brouillon (étape, serveur visé, invitation) gardé en session avant la reconnexion ; `SettingsLayout` rouvre `?servers=add` au retour et le dialogue reprend à la même étape.
  - « Gérer les serveurs » (`ManageServersDialog.tsx`) : une `InnerCard` par serveur déjà sur Lineup (icône, nom, « Visible » ou « Masqué » d'après `listed` de `GET /lineup/me/guilds`, « Voir le profil » discret, « Gérer » outlined, qui navigue et donc ferme le dialogue) et un lien « Ajouter un serveur » (bascule vers l'autre dialogue). Vide : une phrase et « Ajouter un serveur ».
  - API : `GET /lineup/me/guilds`, `POST /lineup/me/refresh-guilds`, `POST /lineup/guilds/claim`. L'API ne renvoie que les serveurs gérables. États : chargement, vide, liste périmée, erreur de lecture, réautorisation. Erreurs : `lineup_reauth_required` (bouton d'autorisation), `lineup_guild_forbidden` (aide, droits actualisés puis nouvel essai), `lineup_guild_already_claimed` (lien vers le profil), `guild_suspended` (`SanctionNotice`), `invite_invalid`, `invite_not_found`, `invite_expiring`, `invite_guild_mismatch` (sur le champ), `invite_required`, `discord_unavailable` et `lineup_rate_limited` (décompte), validation locale de la longueur. À 390 px le dialogue tient dans la fenêtre et défile à l'intérieur.

## `/guilds/:guildId/manage` et sous-pages : gestion d'un serveur (`features/guild-manage`)

- Protégé (`manage`). Une route parente (`GuildManageLayout`) lit `useGuild` une fois, gère chargement, introuvable (`lineup_guild_not_found`) et accès refusé (pas `can_manage`), puis rend `SettingsLayout` (titre : nom du serveur avec `DisplayName` ; une description courte propre à la page ; « Voir le profil public ») et `<Outlet context={guild}>`. Les sous-pages lisent le serveur avec `useManagedGuild()`. Les routes sont `lazy`. Le bouton « Gérer » du profil public mène à `paths.guildManage(id)`.
- Un formulaire par page, avec sa barre collante Annuler (outlined) / Enregistrer (filled) (`SaveBar`, visible tant qu'il y a des changements ou une erreur). `useGuildForm(guild, scope)` garde les valeurs, le brouillon avant reconnexion (`registerBeforeLogin`, clé `guild-manage-draft:<id>:<scope>`), les erreurs locales et serveur et l'enregistrement. Seuls les champs de la page sont comparés et envoyés au `PUT /lineup/guilds/{id}` (l'API laisse intact un champ absent ; `buildUpdate(baseline, values, scope)` et `SCOPE_FIELDS` dans `profileForm.ts`). Après l'écriture, le cache est mis à jour avec la réponse.
- Erreurs communes : `guild_suspended` (`SanctionNotice`), `lineup_guild_forbidden`, `discord_unavailable` (réessayer), `lineup_rate_limited`, 422 par champ.

### `/guilds/:guildId/manage` Profil

- Formulaire « Profil public » (scope `profile`) : description Markdown (aperçu, « Utiliser la description Discord »), thème (`Select`) et étiquettes, langues en cases compactes avec drapeau, liens.
- API : `GET` et `PUT /lineup/guilds/{id}`, `GET /lineup/catalog`.

### `/guilds/:guildId/manage/invite` Invitation

- Un seul `SettingsPanel` « Invitation » (scope `invite` ; la phrase « Le lien du bouton Rejoindre sur votre profil. » est la description de la page). Une ligne : le lien actuel en `Pill` (`discord.gg/<code>`) ou « Aucune invitation » en texte secondaire (aussi quand `invite.url` est nul), `Status error` « Introuvable sur Discord » seulement si `invite.valid` est faux, et à droite un bouton icône copier (`content_copy`, infobulle, snackbar). Si `has_moddy` : « Générer une nouvelle invitation » (outlined, `RegenerateInvite`) envoie `PUT` avec `invite: null`, met le cache à jour avec la réponse, snackbar ; désactivé pendant l'envoi et pendant le décompte de `lineup_rate_limited` / `discord_unavailable` (`useRetryAfter`, affiché sur le bouton) ; les autres erreurs tiennent sur une ligne dessous. À côté, « Coller une autre invitation » (bouton texte) déplie le champ. Le champ n'est affiché par défaut que sans invitation valide ou sans Moddy ; `invite_required` l'ouvre aussi. Déplié : le champ (une ligne d'aide) et « Comment créer une invitation permanente » en lien discret (`InviteHelp` replié ; `invite_expiring` l'ouvre), les autres `invite_*` sur le champ. La barre Enregistrer / Annuler (`SaveBar`) n'apparaît que s'il y a une invitation saisie ou une erreur d'enregistrement. C'est la cible du lien « Remplacer l'invitation » du profil public.
- API : `PUT /lineup/guilds/{id}`.

### `/guilds/:guildId/manage/posts` Annonces

- Même liste que `/me/posts` (`PostsManager`) : jauge de quota compacte (serveur : `max_published_posts_per_guild`), chips de statut (`?status=`), une carte avec une `InnerCard` par annonce, action principale à droite et menu `Dropdown`. « Nouvelle annonce » (filled) est dans l'en-tête de page, vers `paths.postNew({guildId})`.
- API : `GET /lineup/me/posts` (filtre `guild_id`, et une lecture « publiées » pour le quota), `POST .../publish`, `POST .../close`, `DELETE`.

### `/guilds/:guildId/manage/discord` Données Discord

- `SnapshotCard` : membres, `StaleNotice`, « Actualiser maintenant » (une fois par minute, décompte `lineup_rate_limited`). À côté des membres, « Mis à jour il y a… » d'après `snapshot_at` (`RelativeTime`, absent si nul) ; après « Actualiser maintenant », la valeur vient de la réponse (cache mis à jour).
- API : `POST /lineup/guilds/{id}/refresh`.

### `/guilds/:guildId/manage/settings` Paramètres

- « Visibilité » (interrupteur, formulaire de scope `visibility` avec sa barre) puis « Zone de danger » (suppression derrière `ConfirmDialog`, titre en `error`).
- API : `PUT` et `DELETE /lineup/guilds/{id}`.

## `/users/:userId` Profil d'une personne (`features/user-profile`)

- Vitrine (`ShowcasePage`). But : voir le profil, les expériences et les annonces d'une personne.
- API : `GET /lineup/users/{id}`. Plus de lecture par expérience : `experience.guild` (`id`, `name`, `icon_url`, `badges`, nul sans profil listé) donne le nom, l'icône et la coche d'un serveur ; `member_count` s'affiche en `InlineStats` compact ; un service montre `image_url` (`<img>` décorative, `loading="lazy"`, `referrerpolicy="no-referrer"`, 40 px, coins `--radius-m`, repli sur le polygone si elle ne charge pas). Un serveur dont les `badges` contiennent `nsfw` garde l'icône par défaut.
- De haut en bas : carte d'en-tête (bannière pleine largeur en haut de la carte si `banner_url`, 160 px, 110 px sur mobile ; avatar 96 px avec décoration, `DisplayName` en h1 avec coche, puis juste dessous `@pseudo` en texte simple, puis le titre, « Ouvert aux propositions », `BadgeStrip` sans badge Discord ; à droite « Modifier mon profil » pour soi, et pour tous un menu `more_vert` : Copier l'identifiant, Copier le lien du profil, Signaler (pas pour soi)) ; `StaleNotice` ; deux colonnes dès 1100 px (une en dessous). Colonne principale, une carte par section : « Présentation » (Markdown), « Expériences » (une `InnerCard` par `ExperienceRow`, dans `ExperienceList` ; dans une ligne, le nom du serveur ou du service vient d'abord, en gras (`DisplayName` et coche si le serveur a des badges), avec l'état de vérification à droite, puis le poste en dessous, puis membres, période et description), « Annonces » (`PostCard` `variant="row"`). Colonne latérale : carte « Informations » (compte créé en mois et année, fuseau et heure locale, `LanguageFlags`), carte « Liens » (`LinkList`).
- États : chargement, introuvable (404), `StaleNotice`, vue privée (soi-même et staff voient les expériences en attente, refusées ou non vérifiées), vides propres à soi ou à autrui (une ligne de texte).
- Erreurs : 404 (`lineup_user_not_found`).

## `/me` Mon profil (`features/me-profile`)

- Protégé (`profile`). Tableau de bord, contexte vous (`SettingsLayout`, titre « Profil », action « Voir mon profil public »). But : modifier titre, bio, « ouvert aux propositions », liens, langues, fuseau horaire.
- API : `GET /lineup/me/profile`, `PUT /lineup/me/profile` (seuls les champs modifiés), `GET /lineup/catalog`.
- Panneaux (`SettingsPanel`) : « Présentation » (titre, bio « Markdown accepté », aperçu Markdown repliable), « Disponibilité » (interrupteur), « Langues et fuseau » (cases avec drapeau, fuseau, heure locale, suggestion du navigateur), « Liens » (ajout en bas du panneau). Une barre collante Annuler (outlined) / Enregistrer (filled) apparaît tant qu'il y a des changements (ou une erreur sans champ).
- États : chargement, formulaire, brouillon conservé avant reconnexion (`registerBeforeLogin`), succès (snackbar).
- Erreurs : 422 par champ, session expirée (retour à la connexion).

## `/me/experiences` Mes expériences (`features/experiences`)

- Protégé (`experiences`). Tableau de bord, contexte vous (`SettingsLayout`, titre « Expériences », action filled « Ajouter une expérience »). But : gérer son parcours (ajout, modification, ordre, suppression) et la vérification de chaque expérience.
- API : `GET/POST /lineup/me/experiences`, `PATCH` et `DELETE .../{id}`, `PUT .../order`, `POST .../{id}/verify`, `POST .../{id}/request-review`, `GET /lineup/catalog`.
- De haut en bas : compteur et jauge ; une carte avec la liste réordonnable (poignée dnd-kit, clavier) ; chaque expérience est une `InnerCard` (poignée, `ExperienceRow` en `div`, outils) + vérification compacte (`VerificationBox` : détails de contrôle repliés, boutons « Vérifier automatiquement » et « Demander une revue manuelle », formulaires en ligne seulement quand ils s'ouvrent) + bouton modifier et menu `more_vert` (monter, descendre, supprimer) ; « Vérification » (règles) repliée en bas.
- États : chargement, vide, boîte d'ajout ou de modification (brouillon `lineup-experience-draft`), confirmation de suppression, statut par expérience : non vérifiée, en attente de revue manuelle, vérifiée, refusée.
- Boîte d'ajout et de modification : pour un service, champ « Image (URL https) » (facultatif, 500 caractères, https seulement, vide = `null`, aperçu 56 px à côté) ; pour un serveur, rien à saisir : l'image et le nombre de membres viennent de l'invitation. Changer l'image ne remet pas la vérification à zéro.
- Erreurs : `lineup_reauth_required` (autoriser Lineup), `lineup_verification_failed` (`not_member`, `no_staff_permission`, avec demande de revue manuelle si `can_request_review`), `lineup_verification_not_applicable` (`not_guild`, `ended`), `lineup_experience_already_verified`, `lineup_review_already_pending`, `lineup_rate_limited` (décompte), `discord_unavailable`, `invite_*` (dans la boîte), `lineup_experience_limit`, `lineup_experience_order_invalid`, `lineup_experience_not_found`.

## `/staff` (redirige vers `/staff/reviews`) Console staff (`features/staff`)

Réservée au staff (404 sinon). Quatre sections dans `StaffLayout` : navigation latérale (liste compacte sous 900 px, classes `.settings-*`), titre « Console staff », puis la section : titre, chips de statut (`StatusChips`), règles repliables (`Rules`), liste d'`InnerCard` empilées, sans filet (nom via `DisplayName`, actions à droite, motif dans `ActionDialog`). Les lectures et actions gèrent `staff_only` et `lineup_rate_limited` (`parts.tsx`).

### `/staff/reviews` Vérifications

- But : file des expériences à vérifier (statuts : en attente, non vérifiées, vérifiées, refusées ; les plus anciennes en haut).
- API : `GET /lineup/staff/experiences`, `POST .../{id}/verify`, `POST .../{id}/reject` (motif obligatoire ; les réponses portent `user_id`), `GET /lineup/users/{id}` (propriétaire). Chaque expérience s'affiche comme sur un profil (image d'un service, icône et membres d'un serveur, d'après `experience.guild`).
- États : chargement, file vide, règles repliables, preuve repliable par expérience, "Charger plus". Après action, l'expérience quitte la liste courante.

### `/staff/reports` Signalements

- But : traiter les signalements (ouverts, résolus, rejetés, tous).
- API : `GET /lineup/staff/reports`, `POST .../{id}/resolve`, `POST .../{id}/dismiss`.
- Erreurs : `lineup_report_already_handled`, `lineup_report_not_found`. Depuis un signalement d'annonce, "Masquer" ouvre la section Annonces avec `?action=hide`.

### `/staff/badges` Badges

- But : attribuer ou retirer un badge manuel à un serveur ou une personne. Formulaire compact (type, id, badge, note) en tête, puis la liste d'`InnerCard`. Chaque badge montre la personne ou le serveur : avatar ou icône, `entity_name` en `DisplayName` (lien vers le profil) d'après `entity_name` et `entity_icon_url` ; sans profil Lineup (valeurs nulles), seul l'id reste, dans la pill.
- API : `GET /lineup/staff/badges` (filtre `entity_type`, deux appels fusionnés pour "tous", limit/offset ; `entity_type` est facultatif côté API), `PUT` et `DELETE /lineup/staff/badges/{entity_type}/{id}/{badge}`, `GET /lineup/catalog`.
- Erreurs : `lineup_badge_not_found`, `lineup_entity_type_invalid`, `lineup_badge_invalid`. Brouillon du formulaire conservé (`lineup-staff-grant`).

### `/staff/posts` Annonces

- But : masquer une annonce ou la rendre visible.
- API : `GET /lineup/posts/{id}` (`usePost`), `POST /lineup/staff/posts/{id}/hide`, `POST .../unhide`.
- Erreurs : `lineup_post_not_hidden` (propre à cette page) ; les autres passent par le message générique. L'annonce se charge par son identifiant (champ + Charger, ou depuis un signalement), aperçu compact, Masquer / Démasquer.

## `*` Page introuvable (`app/NotFoundPage.tsx`)

Page spéciale : lien vers l'accueil. `RouteError` affiche l'erreur d'une route dans la coque.

## `/__ui` Galerie (développement seulement)

`dev/UiGallery.tsx` : les primitives de `src/ui` et les composants métier avec des données factices (`galleryData.ts`), puis les composants de la refonte (`dev/FoundationGallery.tsx` : noms vérifiés, `BadgeStrip`, drapeaux, `InlineStats`, `Markdown`, `FilterBar`, `PageHeader`, `SettingsLayout`). Absente du build de production.
