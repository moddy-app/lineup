# Refonte de l'interface (octobre 2026)

Charte de la refonte. Elle complète `design-kit/DESIGN-SYSTEM.md` et [design.md](design.md) et l'emporte sur eux pour l'intérieur des pages de Lineup. Tout agent qui touche une page la lit en entier avant de coder.

## Ce qui ne change pas

Material 3, thème aléatoire, police, barre du haut du kit, fond de page `surface-container`, jetons seulement (aucune couleur hex, aucun emoji, aucun dégradé, aucune ombre), règles des boutons (un seul `md-filled-button` par rangée, trois boutons au plus), formes polygonales pour les icônes de fonctionnalité, `src/lib/format.ts` pour nombres et dates, mouvement sous `prefers-reduced-motion: no-preference`, aucun défilement horizontal à 390 px, i18n dans les cinq langues.

## Ce qui change

1. **Plus de bento à l'intérieur des pages.** Pas de grille de cartes, pas de « une idée par carte ». Le contenu se pose directement sur le fond de page, organisé par des titres de section, des listes et des séparateurs (`md-divider`). Une carte (`Card`, avec ses `edge-caps`) sert seulement à regrouper un objet qu'on peut pointer : une annonce dans une liste, un serveur dans l'annuaire, un panneau de formulaire. Pas de carte autour d'un simple titre, d'un paragraphe ou d'un bouton isolé. Pas de carte dans une carte.
2. **Pas de pied de page.** Le sélecteur de langue est dans la barre du haut.
3. **Hiérarchie.** Une seule chose grande par page : le titre (nom du serveur, nom de la personne, titre de la page). Les chiffres (membres, en ligne, boosts) sont des métadonnées en ligne, `--text-body-small`, icône remplie 18 px + nombre en graisse 600 + libellé en `on-surface-variant` (composant `InlineStats`). Jamais de `Stat` géant pour une donnée secondaire.
4. **Peu d'information à l'arrivée.** L'essentiel en haut (qui, quoi, action principale). Le détail plus bas, regroupé par sections titrées, ou replié (« Afficher plus »). Pas de texte d'explication qui répète ce que montre l'interface.
5. **Deux familles de pages, bien distinctes.**
   - **Vitrine** (public, lecture) : recrutements, candidats, annuaire, profil de serveur, profil de personne, annonce. Mise en page `ShowcasePage` : en-tête de page (titre, sous-titre court, action principale à droite), puis le contenu sur le fond de page, largeur `--content-width`.
   - **Espace de gestion** (privé, paramètres) : mon profil, mes expériences, mes annonces, mes serveurs, gestion d'un serveur, éditeur d'annonce. Mise en page `SettingsLayout` : colonne de navigation à gauche (« Mon espace » : Profil, Expériences, Annonces, Serveurs ; puis les serveurs gérés), contenu à droite en panneaux de formulaire. Sous 900 px la navigation devient une liste en tête de page (pas d'onglets qui défilent). Le titre de chaque page rappelle où l'on est. On passe de la vitrine à la gestion par le menu utilisateur ou un bouton « Gérer » explicite, jamais par un mélange des deux sur la même page.
   - **Console staff** : `StaffLayout`, même principe que l'espace de gestion, minimaliste.
6. **Dialogues.** Le voile couvre toute la fenêtre, barre du haut comprise ; aucun coin de carte ne ressort au-dessus du voile.

## Composants communs (dans `src/components` ou `src/ui`)

| Composant | Rôle |
| --- | --- |
| `ShowcasePage`, `PageHeader` | Mise en page vitrine (`src/ui/pageLayouts.tsx`) |
| `SettingsLayout` | Mise en page de l'espace de gestion, navigation latérale |
| `VerifiedBadge`, `DisplayName`, `verificationOf(badges, entity)` | Badge de vérification à côté d'un nom (voir plus bas) |
| `BadgeStrip` | Rectangle `surface-container` (coins `--radius-s`) qui porte les icônes des badges, toutes en `on-surface-variant`, nom du badge en infobulle. Exclut les badges `source: "discord"`, les ids `discord_*` et les badges de vérification (déjà montrés par la coche) |
| `LanguageFlags` | Drapeaux (images SVG du paquet `flag-icons`), nom de la langue en infobulle |
| `Markdown` | Rendu Markdown sûr (pas de HTML brut, liens `https` seulement, `rel="noopener noreferrer nofollow"`) |
| `InlineStats` | Ligne de métadonnées « icône **18** en ligne · icône **30** membres » |
| `FilterBar` | Recherche + bouton entonnoir + chips de filtre (voir plus bas) |

## Badge de vérification

- Icône `check_circle` remplie (`'FILL' 1`), 16 px, couleur `--md-sys-color-primary`, conteneur rond `inline-flex`. Une seule variante ; seule l'infobulle change.
- Dans la même ligne que le nom, juste après : `.display-name { display: inline-flex; align-items: center; gap: 2px; min-width: 0 }`, le nom coupé par « … », le badge `flex-shrink: 0` et `transform: translateY(1px)`.
- Infobulle sous le badge, à 6 px, centrée, `inverse-surface` / `inverse-on-surface`, coins 4 px, padding `4px 8px`, 12 px graisse 500, `nowrap`, fondu d'opacité 120 ms, `pointer-events: none`. Déclenchée au survol et au focus clavier (`tabindex="0"`, `:focus-visible`).
- `role="img"` et `aria-label` avec le texte ; l'infobulle visuelle en `aria-hidden`.
- Priorité quand plusieurs badges s'appliquent : 1. `moddy_staff` « Équipe Moddy » ; 2. `moddy_server` « Serveur officiel Moddy » ; 3. `lineup_verified` « Serveur vérifié » (serveur) ou « Compte vérifié » (personne).
- Partout où un nom de serveur ou de personne est affiché, on passe par `DisplayName`. Si l'objet n'a pas de `badges` (résumés d'auteur, d'équipe, `post.guild` : voir [backend-notes.md](backend-notes.md)), rien n'est rendu.

## Chips de filtre (`FilterBar`)

Adaptation du modèle shadcn fourni, avec Material Web et les jetons du thème.

- Conteneur en colonne, `gap: var(--gap-m)`. Barre d'outils en ligne, `gap: var(--gap-s)` : champ de recherche (`md-outlined-text-field` avec icône loupe en tête, `flex: 1`) qui est l'action principale ; bouton icône entonnoir (`md-icon-button`, `filter_list`, infobulle).
- Rangée de chips en `flex-wrap`, `gap: var(--gap-s)`, non rendue tant qu'aucun filtre n'est actif.
- Cycle : clic sur l'entonnoir, menu (`md-menu`) des filtres pas encore utilisés (icône + nom ; « Tous les filtres sont utilisés » s'il n'en reste pas) ; le choix ajoute la chip et ouvre son popover 160 ms plus tard ; toute fermeture dans les 250 ms qui suivent l'ouverture est ignorée ; un popover fermé sans valeur retire la chip ; « Retirer » (bouton pleine largeur, `error`, icône `delete`) en bas du popover ; « + Ajouter un filtre » en fin de rangée tant qu'il reste des filtres. Les choix simples (une valeur) ferment le popover ; les choix multiples le laissent ouvert.
- Chip : un `<button>`, hauteur 28 px, `border-radius: var(--radius-full)`, bordure 1 px, padding `0 10px`, `--text-label`, icône 14 px, libellé en 600 suivi de « : » si une valeur existe, valeur en 400 coupée à 10rem, chevron `expand_more` à 70 % d'opacité. Couleurs : fond `secondary-container`, texte `on-secondary-container`, bordure `outline-variant` ; survol avec une couche `on-secondary-container` à 8 %. L'entonnoir actif prend `secondary-container` aussi.
- « + Ajouter un filtre » : même hauteur et même forme, sans bordure ni fond, `on-surface-variant`, fond `surface-container-high` au survol.
- Popover : `surface-container-lowest`, coins `--radius-l`, padding 8 px, largeur 14rem (18rem pour une liste longue), aligné à gauche de la chip, en-tête icône + nom en `--text-label` `on-surface-variant`. Choix : boutons pleine largeur, coins `--radius-m`, sélection en `secondary-container`.
- Modèle de données générique : `FilterKey`, `FILTER_META` (icône, libellé), valeurs, `hasValue`, `activeKeys` dans l'ordre d'ajout. Les valeurs restent dans l'URL comme aujourd'hui.

## Contrôle

Captures à 1400 et 390 px, clair et sombre, en français et en anglais, regardées avant de rendre le travail.
