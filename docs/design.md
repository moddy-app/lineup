# Design

Référence : `design-kit/DESIGN-SYSTEM.md` (à lire avant de toucher à l'interface) et `design-kit/README.md`. Cette page dit comment Lineup l'applique et ce qu'il ajoute.

## Application du kit

- **Jetons seulement.** Couleurs : jetons de thème Material (`--md-sys-color-*`), jamais une valeur hexadécimale. Tailles : jetons d'espacement, de rayon et de typographie du kit (`--page-gap`, `--card-padding`, `--gap-s|m|l`, `--radius-*`). Pas de dégradé, pas d'ombre sur les cartes, pas d'emoji, pas de décor sans sens.
- **Cartes.** Chaque carte commence par ses `edge-caps` (`EdgeCaps`, `Card`), a un fond `surface-container-lowest`, `overflow: clip`. Ordre : titre, texte, visuel, actions. Survol seulement si toute la carte est un lien.
- **Mises en page.** Pages d'application : `AppLayout` (colonne principale `app-main`, colonne latérale `app-aside`, `sticky` possible, repli sous 1100 px), `SingleColumn` et `Section` (`src/ui/appLayout.tsx`). Le bento (`Bento`, `Stack`, `Page`) sert à l'ambiance, aux pages d'état et aux tableaux de bord légers, pas à organiser des formulaires ou des listes.
- **Boutons.** Un seul `md-filled-button` par rangée (l'action principale), `md-outlined-button` pour les autres, trois au maximum par rangée, `md-text-button` pour les actions répétées de faible poids. Aucun bouton maison. Un bouton destructif utilise la classe `destructive` (`ConfirmDialog` avec `destructive`).
- **Formes.** Une icône de fonctionnalité vit dans un polygone (`Shape` : carré, losange, pentagone, hexagone, heptagone, octogone), jamais un cercle ; on varie formes et tons entre cartes voisines. Les avatars sont ronds.
- **Pills.** Identifiants et valeurs courtes en `Pill` ; états en `Status` (`neutral`, `strong`, `accent`, `error`).
- **Nombres et dates.** Toujours via `src/lib/format.ts` : `formatNumber`, `formatCompact`, `formatRelativeTime` (du kit), `formatDate`, `formatMonthYear`, `parseDate`. Ils lisent `<html lang>`. Jamais `toLocaleString` à la main ni de format codé en dur.
- **Mouvement.** Tout mouvement est dans `@media (prefers-reduced-motion: no-preference)`. Easing `--ease`, 150 à 400 ms. Pas de calcul au scroll. Le survol seulement sur ce qui réagit au pointeur.
- **Responsive.** Aucun défilement horizontal à 390 px, jamais.
- **Accessibilité.** Focus visible, paires `on-X` sur `X`, éléments décoratifs en `aria-hidden`, lien d'évitement vers `#main-content`.

## Ajouts au kit

### Composants Material Web utilisés

Tous importés une fois dans `src/ui/material.ts` (types JSX dans `src/types/custom-elements.d.ts`) :

| Élément | Où |
| --- | --- |
| `md-dialog` | `ui/Dialog.tsx` (`Dialog`, `ConfirmDialog`) : confirmations, expériences, signalement, confirmation NSFW |
| `md-outlined-select` + `md-select-option` | `ui/Select.tsx` |
| `md-outlined-text-field` | `ui/TextField.tsx` (compteur et texte d'aide inclus) |
| `md-switch`, `md-checkbox` | `ui/Toggles.tsx` (`Switch`, `Checkbox`) |
| `md-radio` | Éditeur d'annonce (`steps.tsx`), signalement (`ReportDialog.tsx`) |
| `md-tabs` + `md-primary-tab` | Mes annonces (onglets par statut) |
| `md-circular-progress`, `md-linear-progress` | Chargement (`ui/Loading.tsx`) et jauges |
| `md-menu-item` | Menu utilisateur de la coque (`AppShell.tsx`) |
| Boutons `md-filled-button`, `md-filled-tonal-button`, `md-outlined-button`, `md-text-button`, `md-icon-button` | Partout |
| `md-icon`, `md-focus-ring`, `md-ripple`, `md-divider`, `md-menu` | Dépendances des précédents ou icônes |

`md-filter-chip`, `md-chip-set` et `md-secondary-tab` sont importés mais non utilisés dans le JSX au moment de l'écriture ; les puces de l'app (`Chip`, `Chips` dans `ui/Chips.tsx`) reposent sur les classes `.chips` et `.chip` du kit. Le glisser-déposer des expériences utilise `@dnd-kit`.

### Snackbar

`ui/Snackbar.tsx` (`SnackbarProvider`, `useSnackbar().show({message, action?})`) n'existe pas dans le kit. Style dans `lineup.css` : fond `inverse-surface`, texte `inverse-on-surface`, bouton d'action en `inverse-primary`, coins comme l'infobulle du kit, apparition en fondu sous `prefers-reduced-motion: no-preference`.

### CSS propre à l'app

`src/styles/lineup.css` (importé après le CSS du kit), jetons seulement. Il couvre : pages spéciales sans pied de page, avis de suspension et détails de sanction, pied de page (byline, sélecteur de langue), champs et interrupteurs, barre de progression de navigation, snackbar, mises en page d'application (`.app-layout`, `.single-column`, sections), états (`.status.neutral`), infobulles `data-tooltip`, avatars (`.user-avatar`, décoration d'avatar Discord), icônes de serveur (`.guild-icon`), badges (`.badge-list`, `.badge-item`), carte d'annonce (`.post-card`, étiquettes, métadonnées), exigences, lignes d'expérience.

Un fichier CSS par feature, importé par sa page :

- `features/claim/claim.css`, `features/experiences/experiences.css`, `features/feed/feed.css`
- `features/guild-manage/guildManage.css`, `features/guild-profile/guildProfile.css`
- `features/guilds/guilds.css` et `features/guilds/SanctionNotice.css`
- `features/me-profile/me-profile.css`, `features/my-posts/myPosts.css`
- `features/post-editor/editor.css`, `features/post/post.css`
- `features/staff/staff.css`, `features/user-profile/user-profile.css`

Le mock a aussi `src/mocks/mocks.css` (développement seulement). Avant d'ajouter une règle, regardez si une classe du kit ou de `lineup.css` suffit.
