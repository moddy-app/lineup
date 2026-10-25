# Documentation de Lineup

Le code de référence pour l'API est [`../LINEUP.md`](../LINEUP.md). Pour le style visuel, [`../design-kit/DESIGN-SYSTEM.md`](../design-kit/DESIGN-SYSTEM.md). Les règles pour les agents de code sont dans [`../CLAUDE.md`](../CLAUDE.md).

| Fichier                                  | Contenu                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| [getting-started.md](getting-started.md) | Prérequis, installation, variables d'environnement, scripts npm, CORS en local         |
| [architecture.md](architecture.md)       | Dossiers de `src/`, routage, flux de données, intégration du kit                       |
| [api-client.md](api-client.md)           | `apiFetch`, `ApiError`, formes d'erreur, pagination, retry et `Retry-After`            |
| [auth.md](auth.md)                       | Session, connexion, reconnexion, suspension, déconnexion, garde staff                  |
| [i18n.md](i18n.md)                       | Cinq langues, espaces de noms, libellés du catalogue, terminologie                     |
| [design.md](design.md)                   | Application du kit de design et ajouts propres à Lineup                                |
| [ui-redesign.md](ui-redesign.md)         | Charte de la refonte de l'interface (vitrine, gestion, badge de vérification, filtres) |
| [pages.md](pages.md)                     | Une section par route : rôle, appels API, états, erreurs                               |
| [mock-api.md](mock-api.md)               | API simulée (MSW), personas, panneau de dev, codes d'invitation                        |
| [testing.md](testing.md)                 | Vitest, pistes pour les tests de bout en bout, captures à faire                        |
| [deployment.md](deployment.md)           | Vercel, variables de production, contrôle du build                                     |
| [bots.md](bots.md)                       | Bots : routes, écrans, erreurs, pièges                                                 |
| [coverage.md](coverage.md)               | Matrice des 49 routes de l'API (+ `POST /auth/logout`) vers les écrans                 |
| [backend-notes.md](backend-notes.md)     | Questions et écarts pour l'équipe backend, réponses déjà reçues                        |
