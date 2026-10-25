# Bots

Un bot Discord a sur Lineup ce qu'a un serveur : un profil, des annonces (`kind: "bot"`), des expériences dans le CV des personnes (`kind: "bot"`), une équipe et des badges. Référence API : le guide « Bots sur Lineup » transmis par le backend (routes `/lineup/bots`, `/lineup/me/bots`), résumé ici avec les choix du front.

## Conditions côté Discord

Rappelées dans le dialogue « Ajouter un bot » :

1. le bot est **découvrable** (portail développeur, rubrique App Directory) ;
2. il déclare un **serveur support** (champ Support Server) ;
3. la personne est **propriétaire ou administratrice** de ce serveur support. « Gérer le serveur » ne suffit pas, contrairement aux serveurs.

L'id saisi est l'**Application ID** (le même que l'id du bot pour presque tous les bots). Contrôle local : 17 à 20 chiffres (`features/claim/botId.ts`).

## Routes et hooks

| Route                                | Fonction     | Hook            |
| ------------------------------------ | ------------ | --------------- |
| `GET /lineup/bots`                   | `getBots`    | `useBots`       |
| `GET /lineup/me/bots`                | `getMyBots`  | `useMyBots`     |
| `GET /lineup/bots/lookup/{bot_id}`   | `lookupBot`  | `useBotLookup`  |
| `POST /lineup/bots/claim`            | `claimBot`   | `useClaimBot`   |
| `GET /lineup/bots/{bot_id}`          | `getBot`     | `useBot`        |
| `PUT /lineup/bots/{bot_id}`          | `updateBot`  | `useUpdateBot`  |
| `DELETE /lineup/bots/{bot_id}`       | `deleteBot`  | `useDeleteBot`  |
| `POST /lineup/bots/{bot_id}/refresh` | `refreshBot` | `useRefreshBot` |

- `useBotLookup(id)` ne part que lorsque la personne le demande (bouton « Rechercher » ou « Voir le bot ») : la route est limitée à 20 appels par minute. Jamais retenté, gardé une minute.
- `GET /lineup/me/bots` avec `stale: true` (et `items: []`) affiche « Impossible de vérifier vos serveurs », jamais « aucun bot ».
- Cache (`cacheSync.ts`) : `syncBotProfile` (claim, PUT, refresh) remplace le détail, met à jour « mes bots » et marque périmés l'annuaire et le profil du serveur support ; `syncBotDeleted` retire le détail et ferme dans le cache les brouillons et annonces publiées du bot. Une annonce de bot écrite met à jour `posts` du profil du bot.
- Clés : `['bots','directory',filtres]`, `['bots','detail',id]`, `['bots','mine']`, `['bots','lookup',id]`.

## Écrans

- `/bots` (`features/bots/BotsPage.tsx`) : annuaire. Recherche, thème, contenu adulte (porte NSFW), grille de `BotTile`. Pas d'entrée dans la barre du haut : on y arrive par Projets filtré sur les bots (bouton « Annuaire des bots »), les profils et les liens. La barre surligne « Projets » sur `/bots` et `/bots/:id`.
- `/bots/:botId` (`BotProfilePage.tsx`) : en-tête (avatar rond, nom avec coche `lineup_verified`, « Application vérifiée Discord » si `is_verified`, nombre de serveurs, badges), « Ajouter le bot » (`add_url`), « Gérer » si `can_manage`, menu (Signaler sauf gestionnaire, copier le lien, copier l'id). Avis gestionnaire : non listé, plus découvrable. Corps : À propos, annonces ; colonne : Informations (catégories de l'App Directory en lecture seule, date de création sur Discord, « Mis à jour » pour les gestionnaires), Serveur support (lien vers `/guilds/{id}` seulement si `profile`, sinon nom et icône ; l'id remplace un nom nul), Liens, Équipe. Porte NSFW si le thème est `nsfw`. Réutilise les classes de `guildProfile.css`.
- Gestion `/bots/:botId/manage` (`features/bot-manage`), comme un serveur : contexte « bot » du tableau de bord (`dashboardContext`), pages Profil, Annonces (`PostsManager` avec `botId`, quota `max_published_posts_per_bot`), Données Discord (rafraîchir, 1 fois par minute, serveur support), Paramètres (visibilité `listed`, suppression : « Vos annonces seront fermées »). Bandeau sur chaque page si `discoverable` est faux. Le formulaire de profil est celui des serveurs (`ProfileEditor`, `useBotForm`, espace `botManage` avec les mêmes clés que `guildManage`) ; « Reprendre la description Discord » vide la description Lineup (`null` à l'envoi).
- Dialogues du tableau de bord (`?servers=add-bot`, `?servers=manage-bots`, `paths.botClaim()`, `paths.myBots()`), ouverts depuis le sélecteur de contexte : `AddBotDialog` (Application ID, aperçu `BotLookupPreview`, puis selon `claimed` / `can_claim` : « Revendiquer ce bot », lien vers le profil, ou « Il faut être administrateur de {serveur} ») et `ManageBotsDialog`. L'id saisi est gardé avant la connexion (`bot-claim-draft`). Après revendication : gestion du bot.
- Projets (`/`) : annonces de serveurs **et** de bots. Sans filtre, la requête part sans `kind` et chaque page est filtrée côté front pour retirer les annonces de personnes (`useFeed(…, {projects: true})`, pages vides suivies par `useInfiniteList`). Le chip « Type » (`?recruiter=guild|bot`) envoie `kind=guild` ou `kind=bot`.
- Annonces : `recruiterOf(post)` choisit `post.guild`, `post.bot` ou `post.author` (nom, image, badges, profil). Avatar de bot rond (`BotAvatar`, hexagone `smart_toy` sans image). Porte NSFW aussi si `post.bot.nsfw`.
- Éditeur : « Qui publie ? » propose un serveur, un bot (`useMyBots`) ou soi ; `?bot=<id>` fixe l'auteur (contexte du bot). Corps `{kind: 'bot', bot_id}`. `lineup_bot_profile_missing` et `lineup_bot_forbidden` renvoient au dialogue « Ajouter un bot ».
- Expériences : type « Bot Discord », champ Application ID, « Voir le bot » (lookup), et en modification « Actualiser depuis Discord » (renvoie le même `bot_id`, la vérification reste). Un autre id prévient que la vérification sera retirée. La vérification automatique est proposée comme pour un serveur ; ses échecs parlent du serveur support (`errorMessage(…, {subject: 'bot'})`). Une ligne d'expérience de bot montre « N serveurs » (`guild_count`) et un lien vers `/bots/{id}` si `experience.bot`.
- Profil serveur : carte « Bots de ce serveur » (`bots`), absente quand la liste est vide.
- Signalement : `target_type: "bot"`. Staff : badges `entity_type = "bot"` (liste, filtre, formulaire ; badges proposés d'après `entities` du catalogue), signalements de bots.

## Erreurs

Messages par code dans `errors` : `lineup_bot_forbidden`, `lineup_bot_not_found`, `bot_not_found`, `lineup_bot_already_claimed` (lien vers le profil avec `bot_id`), `bot_not_discoverable`, `bot_support_guild_missing` (sur le champ Application ID), `lineup_bot_profile_missing`, `lineup_quota_exceeded` avec `scope: "bot"`, `lineup_filter_invalid` avec `field: "bot_id"`, `lineup_verification_not_applicable` avec `reason: "bot_unavailable"` (revue manuelle proposée). `guild_suspended` sur un bot passe par `SanctionNotice`.

## Pièges

- Les droits suivent le serveur support **au dernier rafraîchissement** : un `403 lineup_bot_forbidden` inattendu peut venir d'un changement de serveur support. Le cache des serveurs de la personne dure 5 minutes (dit dans le dialogue).
- `can_manage` n'est pas une autorisation : l'API revérifie chaque écriture.
- `member_count` d'une expérience de bot vaut toujours `null` : afficher `guild_count`.
- Le catalogue porte `entities` sur chaque badge : le lire, pas `entity`. Le nouveau badge `discord_verified_app` est traduit dans l'espace `catalog`.
