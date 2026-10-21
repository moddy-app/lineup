# Tests

## Tests unitaires et de composants (Vitest)

```sh
npx vitest run          # ou npm test
npx vitest run src/mocks   # un dossier
```

Environnement `jsdom`, tests dans `src/**/*.test.{ts,tsx}`, setup dans `src/test/setup.ts` (nettoyage Testing Library, `matchMedia` simulé), harnais de rendu dans `src/test/harness.tsx`. État au moment de l'écriture : 52 fichiers, 931 tests, tous verts.

Ce qui est couvert :

- **Client API** : `client.test.ts` (formes d'erreur, `Retry-After`, requête), `errors.test.ts` (un message par code dans les cinq langues, validation 422), `endpoints/endpoints.test.ts` (méthode, chemin, requête et corps des 41 routes + logout), `retry.test.ts`, `useRetryAfter.test.ts`, `pagination.test.ts`, `catalog.test.ts`, `hooks.test.tsx`.
- **Cache** : `cacheUpdates.test.ts` et `cacheSync.test.ts` (aucune relecture du fil, ordre des listes, `routeApiError`).
- **Authentification** : `session.test.tsx`, `authError.test.ts`, `beforeLogin.test.ts`, `status.test.ts`, `useAuthAction.test.tsx`, `RequireAuth.test.tsx`.
- **i18n** : `locales.test.ts` (parité des cinq langues, marqueurs identiques), `detect.test.ts`.
- **Composants et logique de formulaire** : `components/*.test.ts(x)`, `NsfwGate`, `ReportDialog`, `post-editor/form.test.ts`, `experienceForm`, `profileForm`, `feedFilters`, `directoryFilters`, `postActions`, `staffLogic`.
- **Utilitaires** : `lib/*.test.ts`.
- **API simulée** : `src/mocks/**/*.test.ts` (règles, routes, graine, plugin du worker, page de connexion) avec `createTestApi()`.

## Tests de bout en bout : pas encore écrits

Jules les écrira. Points de départ :

- Lancer `npm run dev:mock` (ou `npm run build:mock` puis `npm run preview:mock`, qui sert `dist-mock/`).
- Playwright est en dépendance de développement (`playwright ~1.56`). Chromium est installé dans `/opt/pw-browsers/chromium` (aussi `chromium-1194`). Pointer `executablePath` ou `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` selon l'installation.
- Changer de persona sans passer par la connexion : écrire `lineup-mock-persona` dans `localStorage` avant le chargement, ou utiliser le panneau de dev (bouton "Mock", en bas à gauche). La page `/__mock/login?redirect=<chemin>` fait aussi le choix. Voir [mock-api.md](mock-api.md) pour les personas, la latence, "Discord unavailable", "fail the next request", l'issue de la vérification, "Expire the session" et la réinitialisation de la base.
- Les codes d'invitation de `src/mocks/README.md` donnent chaque erreur de la revendication.
- Pour un état reproductible, réinitialiser la base (clé `lineup-mock-db`) avant chaque scénario.
- Forcer la langue avec `?lang=fr` (mémorisé).

### Scénarios à couvrir

1. Navigation anonyme : fil, filtres, annonce, annuaire, profil de serveur et de personne ; pages protégées qui proposent de se connecter.
2. Connexion (persona `member`), refus (`access_denied`, message), déconnexion.
3. Créer, publier et fermer une annonce ; brouillon restauré après connexion.
4. Quota : persona `member` (quota plein), message `lineup_quota_exceeded` à la publication.
5. Revendication avec chaque erreur : succès, droits insuffisants puis actualisation, déjà revendiqué, serveur suspendu, invitation invalide, expirante, introuvable, Discord indisponible avec décompte.
6. Expériences : ajout, ordre, suppression ; vérification réussie ; échec `not_member` et `no_staff_permission` puis revue manuelle ; persona `dashboard` (`lineup_reauth_required`) ; limite de débit avec décompte.
7. Staff (persona `staff`) : vérifier et refuser une expérience, traiter un signalement, attribuer et retirer un badge, masquer et rendre visible une annonce ; un compte non staff voit la 404.
8. Compte suspendu (persona `suspended`) : écran de suspension, boutons d'écriture désactivés, déconnexion possible.
9. NSFW : porte d'âge sur un serveur NSFW et sur une annonce de thème `nsfw`, interrupteur du fil et de l'annuaire.
10. Session expirée ("Expire the session") : retour à la connexion, message de session expirée.
11. Pages vides suivies automatiquement puis "Charger plus" (fil et annuaire avec la graine par défaut).
12. Les cinq langues, thème clair et sombre, 1400 px et 390 px.

### Liste de captures (`design-kit/DESIGN-SYSTEM.md` §10)

1. `npm run build` et `npm run typecheck` passent.
2. Captures à 1400 px et 390 px, clair et sombre, dans au moins deux langues. Les regarder.
3. Faire défiler une carte sous la barre du haut et sous le bord bas : les coins restent ronds.
4. Recharger plusieurs fois : aucun saut au chargement, chaque couleur de thème s'affiche.
5. Aucune couleur hexadécimale dans le CSS, aucun emoji, aucun dégradé, aucune ombre sur une carte, rangées pleines, pas de défilement horizontal à 390 px.
