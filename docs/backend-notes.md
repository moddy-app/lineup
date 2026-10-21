# Notes pour l'équipe backend

Questions et écarts rencontrés en construisant le front, avec les réponses déjà données par le responsable du backend. Le front ne dépend d'aucun point ouvert : il gère les deux cas quand il y a doute.

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

## Questions ouvertes

1. **Badges Discord publics.** LINEUP.md §10 dit que les badges Discord publics ne sont pas exposés ; §5 et §6.3 disent qu'ils le sont (source `discord`). Le front gère les deux.
2. **`entity_type` sur `GET /lineup/staff/badges`.** Est-il obligatoire ? Le front l'envoie quand on filtre et fusionne deux appels pour "tous".
3. **Réponses staff verify / reject.** Contiennent-elles `user_id` ? Le front ne s'y appuie pas.
4. **Nombre de pages vides à suivre.** Le front suit au plus 3 pages vides consécutives (avec `next_cursor` non nul), puis affiche "Charger plus". Une valeur recommandée côté backend serait utile.
5. **`redirect` depuis localhost.** Le front envoie un chemin relatif (une URL localhost est réduite à son chemin). À confirmer que c'est le comportement voulu pour le développement.
6. **NSFW sur une annonce.** `post.guild` n'a ni badges ni indicateur `nsfw` : la porte d'âge de la page d'annonce ne peut se déclencher que sur le thème `nsfw`. Une annonce d'un serveur de niveau Discord `nsfw_level` 1 ou 3 mais d'un autre thème s'affiche sans porte. Proposition : ajouter `nsfw: boolean` (ou `badges`) à `post.guild`.
7. **Annonces d'un serveur non listé.** LINEUP.md §16 dit à un endroit que ces annonces restent dans le fil et ailleurs qu'elles sont masquées (§8 "Visibilité côté lecteur", dernier point, contre §9 et §16 ; le texte du dossier indique les deux comportements). Le mock les masque. À confirmer.
8. **Badges sur les résumés.** `post.guild`, `post.author`, `team[].user` et `GET /lineup/me` n'ont pas de `badges`, alors que la coche de vérification doit apparaître partout où un nom s'affiche. Proposition : ajouter `badges` (sans les badges Discord) à ces quatre objets, avec la même logique que les profils complets. Le mock le fait déjà ; le front n'affiche rien si le champ manque (`badges` est optionnel dans les types).
9. **Invitation des serveurs avec Moddy.** Quand Moddy est déjà sur le serveur, le bot pourrait créer lui-même l'invitation permanente. Proposition : rendre `invite` facultatif dans `POST /lineup/guilds/claim` et `PUT /lineup/guilds/{id}` quand `has_moddy` est vrai (l'API crée ou réutilise une invitation via le bot). Le front garde le champ obligatoire tant que l'API ne l'accepte pas.
10. **Description dans l'annuaire.** `GET /lineup/guilds` ne renvoie pas `description`. Proposition : l'ajouter, tronquée (par exemple 160 caractères), pour l'afficher sur les cartes de l'annuaire.
11. **Autres écarts.** Aucun autre écart n'a été relevé en lisant `src/mocks/README.md` et les commentaires du code. Si vous en trouvez, ajoutez-les ici.
