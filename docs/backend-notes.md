# Notes pour l'équipe backend

Questions et écarts rencontrés en construisant le front, avec les réponses données par le responsable du backend. Le front ne dépend d'aucun point ouvert : il gère les deux cas quand il y a doute.

## Réponses reçues

1. **`Cache-Control` avec une session.** Le catalogue (`public, max-age=3600`), le fil et l'annuaire (`public, max-age=60`) gardent leur en-tête même avec un cookie. Leurs erreurs (par exemple un 422) n'en posent pas, donc avec une session elles reçoivent `no-store`.
2. **Ordre des contrôles de `POST /lineup/me/experiences/{id}/verify`** :
   1. session (401 ou 403) ;
   2. 404 `lineup_experience_not_found` ;
   3. le service n'est pas un serveur : 422 `lineup_verification_not_applicable` avec `not_guild` ;
   4. `end_date` renseignée : même erreur, avec `ended` ;
   5. déjà vérifiée : 200 inchangé, sans appel Discord ;
   6. pas de scope `guilds.members.read` : 403 `lineup_reauth_required` ;
   7. 429 `lineup_rate_limited` (5 par 10 minutes) ;
   8. Discord : 503, ou 422 `lineup_verification_failed` (`not_member` ou `no_staff_permission`).
      Une expérience vérifiée puis terminée répond 422 `ended`.
3. **Ordre des contrôles de `PUT /lineup/guilds/{id}`** : validation 422, session, droits (503 si Discord ne répond pas, sinon 403 `lineup_guild_forbidden`, puis 403 `guild_suspended`), 404 `lineup_guild_not_found`, puis l'invitation : illisible 422 `invite_invalid`, Discord muet 503, inconnue 404 `invite_not_found`, sans serveur 422 `invite_invalid`, expirante 422 `invite_expiring`, autre serveur 422 `invite_guild_mismatch`, puis 200. Rien n'est écrit en cas d'échec.
4. **Route inconnue ou mauvaise méthode.** Route inconnue : 404 `{"detail":"Not Found"}`. Mauvaise méthode : 405 `{"detail":"Method Not Allowed"}` avec un en-tête `Allow`. C'est la forme native de FastAPI. LINEUP.md §0 est inexact (il écrit `{"error":"Not Found"}`) et son helper `api()` doit aussi lire `body.detail` quand c'est une chaîne. Le responsable backend corrigera le document. Le client du front gère déjà cette forme (voir [api-client.md](api-client.md)).
5. **401 "Session expiree" et "Non authentifie".** Le premier : cookie envoyé, session disparue. Le second : pas de cookie. Le front traite les deux pareil (retour à la connexion) ; le mock simule les deux.
6. **`POST /auth/logout`.** Route du tableau de bord, même session. Réponse 200 avec un corps vide (pas du JSON), `Set-Cookie` qui efface `session_token` sur `.moddy.app`, session supprimée dans Redis. Déconnecte aussi du tableau de bord. Un compte suspendu peut se déconnecter. Sans session valide : 401 (l'un ou l'autre texte), traité par le front comme déjà déconnecté. Origine étrangère : 403 `Origin not allowed`.
7. **Badges Discord publics.** Toujours envoyés sur le profil complet d'une personne (`badges` de `GET /lineup/users/{id}`), jamais sur les résumés. LINEUP.md §10 est corrigé en ce sens. Le front n'affiche de toute façon pas les badges Discord à côté d'un nom.
8. **`entity_type` sur `GET /lineup/staff/badges`.** Facultatif. Le front garde un appel par type et fusionne pour « tous » : la pagination par `limit` et `offset` reste par type.
9. **Réponses staff verify / reject.** Elles contiennent `user_id` (type `StaffExperience`). `syncStaffExperience` s'en sert pour mettre à jour le profil de la personne et la file.
10. **Pages vides consécutives.** Pas de borne stricte côté API ; 3 reste raisonnable. Le front suit au plus 3 pages vides (avec `next_cursor` non nul), puis affiche « Charger plus ».
11. **`redirect` depuis localhost.** Voulu : le chemin relatif est rattaché à `lineup.moddy.app`, donc on revient sur la production après la connexion.
12. **NSFW sur une annonce.** `post.guild.nsfw` (booléen) existe. `isNsfw` le lit : une annonce est NSFW si `post.guild.nsfw` ou si son thème est `nsfw`. Les cartes de l'annuaire portent aussi `nsfw`.
13. **Annonces d'un serveur non listé.** Masquées du fil et du détail (404 pour un tiers). Le mock a raison.
14. **Badges sur les résumés.** `badges` est présent sur `post.guild`, `post.author`, `team[].user`, `experience.guild`, `GET /lineup/me` (`user.badges`) et les cartes de l'annuaire, sans badges Discord ni `moddy_premium`. Les types le déclarent obligatoire.
15. **Invitation des serveurs avec Moddy.** `POST /lineup/guilds/claim` accepte `{invite}` ou `{guild_id}` (au moins un). Avec Moddy sur le serveur, `guild_id` seul suffit : l'API lit le serveur et crée l'invitation permanente. Sans Moddy : 422 `invite_required`. `invite` et `guild_id` pour deux serveurs : 422 `invite_guild_mismatch`. `PUT /lineup/guilds/{id}` avec `invite: null` demande une nouvelle invitation à Moddy (422 `invite_required` sans Moddy). `GET /lineup/guilds/{id}` : `invite.url` nul si le bot n'a pu en créer nulle part ; `snapshot_at` seulement pour les gestionnaires.
16. **Description dans l'annuaire.** Chaque carte porte `description` (description Lineup, sinon Discord, tronquée à 160 caractères avec « … ») et `nsfw`.
17. **Expériences.** `image_url` et `member_count` ; `experience.guild` `{id, name, icon_url, badges}` quand le serveur a un profil Lineup listé, sinon `null` (aussi pour un service). Pour un serveur, `image_url` du corps est ignoré. Changer l'image ne remet pas la vérification à zéro.
18. **Mes serveurs et console staff.** `GET /lineup/me/guilds` : `listed` sur chaque élément. `GET` et `PUT /lineup/staff/badges` : `entity_name` et `entity_icon_url`, nuls sans profil Lineup.

## Questions ouvertes

1. **`invite.code` quand `invite.url` est nul.** Le message annonce seulement `url` nullable. Le type garde `code: string` ; le mock envoie `{code: "", url: null, valid: true}`. À confirmer (sans doute `code` nul aussi).
2. **Ordre des contrôles de `POST /lineup/guilds/claim` avec `guild_id` seul.** Le mock vérifie les droits (403), puis le doublon (409), puis la présence de Moddy (422 `invite_required`). Le front ne dépend pas de l'ordre.
3. **`experience.guild` et NSFW.** Le résumé n'a pas de `nsfw` : le front garde le repli sur l'icône quand ses `badges` contiennent `nsfw`. Proposition : y ajouter `nsfw: boolean` comme sur `post.guild`.
4. **E-mail du compte.** `GET /lineup/me` n'a pas d'e-mail, mais `GET /auth/me` (route du tableau de bord, cookie `session_token`) renvoie `email` (nullable) et `verified`. Le front l'y lit pour le menu du compte (`useAccountEmail`) ; la ligne est masquée si l'e-mail manque ou si la requête échoue. À confirmer : CORS de `/auth/me` pour `https://lineup.moddy.app`.
5. **Filtre `kind` sur `GET /lineup/me/posts`.** « Annonces » de l'espace personnel ne montre que les annonces de la personne pour elle-même (`kind: user`). Sans `guild_id`, l'API renvoie aussi ses annonces pour ses serveurs : le front filtre chaque page (`useMyPosts(…, {personal: true})`), ce qui peut donner des pages vides suivies par `useInfiniteList`. Proposition : un paramètre `kind=user|guild`.
6. **Autres écarts.** Aucun autre écart n'a été relevé en lisant `src/mocks/README.md` et les commentaires du code. Si vous en trouvez, ajoutez-les ici.
