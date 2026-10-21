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

| Élément                                                                                                        | Où                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `md-dialog`                                                                                                    | `ui/Dialog.tsx` (`Dialog`, `ConfirmDialog`) : confirmations, expériences, signalement, confirmation NSFW |
| `md-outlined-select` + `md-select-option`                                                                      | `ui/Select.tsx`                                                                                          |
| `md-outlined-text-field`                                                                                       | `ui/TextField.tsx` (compteur et texte d'aide inclus)                                                     |
| `md-switch`, `md-checkbox`                                                                                     | `ui/Toggles.tsx` (`Switch`, `Checkbox`)                                                                  |
| `md-radio`                                                                                                     | Éditeur d'annonce (`steps.tsx`), signalement (`ReportDialog.tsx`)                                        |
| `md-tabs` + `md-primary-tab`                                                                                   | Mes annonces (onglets par statut)                                                                        |
| `md-circular-progress`, `md-linear-progress`                                                                   | Chargement (`ui/Loading.tsx`) et jauges                                                                  |
| `md-menu-item`                                                                                                 | Menu utilisateur de la coque (`AppShell.tsx`)                                                            |
| Boutons `md-filled-button`, `md-filled-tonal-button`, `md-outlined-button`, `md-text-button`, `md-icon-button` | Partout                                                                                                  |
| `md-icon`, `md-focus-ring`, `md-ripple`, `md-divider`, `md-menu`                                               | Dépendances des précédents ou icônes                                                                     |

`md-filter-chip`, `md-chip-set` et `md-secondary-tab` sont importés mais non utilisés dans le JSX au moment de l'écriture ; les puces de l'app (`Chip`, `Chips` dans `ui/Chips.tsx`) reposent sur les classes `.chips` et `.chip` du kit. Le glisser-déposer des expériences utilise `@dnd-kit`.

### Snackbar

`ui/Snackbar.tsx` (`SnackbarProvider`, `useSnackbar().show({message, action?})`) n'existe pas dans le kit. Style dans `lineup.css` : fond `inverse-surface`, texte `inverse-on-surface`, bouton d'action en `inverse-primary`, coins comme l'infobulle du kit, apparition en fondu sous `prefers-reduced-motion: no-preference`.

### CSS propre à l'app

`src/styles/lineup.css` (importé après le CSS du kit), jetons seulement. Il couvre : pages spéciales, avis de suspension et détails de sanction, menu de langue de la barre, champs et interrupteurs, barre de progression de navigation, snackbar, mises en page d'application (`.app-layout`, `.single-column`, sections), états (`.status.neutral`), infobulles `data-tooltip`, avatars (`.user-avatar`, décoration d'avatar Discord), icônes de serveur (`.guild-icon`), badges (`.badge-list`, `.badge-item`, `BadgeStrip`), coche de vérification (`.display-name`, `.verified-badge`), `InlineStats`, drapeaux de langue, `FilterBar` et ses chips, mises en page de la refonte (`.page-header`, `.settings-*` dont la navigation compacte sous 900 px, `.settings-panel`), carte d'annonce (`.post-card`, étiquettes, métadonnées), exigences, lignes d'expérience.

Un fichier CSS par feature, importé par sa page :

- `features/claim/claim.css`, `features/experiences/experiences.css`, `features/feed/feed.css`
- `features/guild-manage/guildManage.css`, `features/guild-profile/guildProfile.css`
- `features/guilds/guilds.css` et `features/guilds/SanctionNotice.css`
- `features/me-profile/me-profile.css`, `features/my-posts/myPosts.css`
- `features/post-editor/editor.css`, `features/post/post.css`
- `features/staff/staff.css`, `features/user-profile/user-profile.css`

Le mock a aussi `src/mocks/mocks.css` (développement seulement). Avant d'ajouter une règle, regardez si une classe du kit ou de `lineup.css` suffit.

## Refonte de l'interface

La charte est [ui-redesign.md](ui-redesign.md) : elle l'emporte sur ce qui précède pour l'intérieur des pages. Ce que les fondations ont mis en place :

- **Plus de pied de page.** `Footer.tsx` et son CSS ont disparu. Le sélecteur de langue est dans la barre du haut (`app/LanguageMenu.tsx` : `md-icon-button` `translate` et `md-menu` des cinq langues, la courante cochée), juste avant `moddy-theme-menu`. En bas de page il reste la marge de page du kit (`--page-gap`, masquée par `.page::after`).
- **Navigation.** « Recrutements » (`/`, `/posts/...`), « Candidats » (`/people`, `/users/...`), « Serveurs » (`/guilds/...`), Staff. Le menu utilisateur : profil public, Mon espace, Mes annonces, Mes serveurs, Expériences.
- **Dialogues.** `md-dialog` dessine son voile dans un `div.scrim` fixe de son shadow root, hors du top layer, au `z-index: 1` du contexte de son hôte. Les `edge-caps` des cartes (z-index 3) et la barre du haut (10) passaient donc au-dessus. `ui/Dialog.tsx` rend désormais l'hôte dans un portail sur `document.body`, et `lineup.css` donne à `md-dialog` `display: block; position: relative; z-index: 1100` (sans `display: block`, un hôte `display: contents` ignore le `z-index`). Le voile couvre toute la fenêtre. Tout `md-dialog` passe par `Dialog` ou `ConfirmDialog` ; un test (`ui/Dialog.test.tsx`) échoue si un autre fichier en crée un.
- **Cartes intérieures** (`ui/InnerCard.tsx`) : `InnerCard` (`.inner-card`, `as` `div` ou `li`, `to` ou `href` pour la variante lien) et `InnerCards` (`.inner-cards`, pile avec `--gap-s`). Fond `surface-container`, coins `--radius-l`, sans `edge-caps`.
- **Mises en page** (`ui/pageLayouts.tsx`) : `ShowcasePage` (`.showcase-page`) avec `PageHeader` (`.page-header`, `-leading`, `-text`, `-title`, `-subtitle`, `-meta`, `-actions`) pour les vitrines ; `SettingsLayout` (`.settings-page`, `.settings-layout`, `.settings-nav`, `.settings-main`, `.settings-head`) avec la navigation « Mon espace » et la liste des serveurs gérés (`useMyGuilds`, serveurs `claimed`, ignorée si la requête échoue), et `SettingsPanel` (`.settings-panel`, une `Card` avec titre h2, description, corps, actions en bas à droite). `AppLayout`, `SingleColumn` et `Section` restent en attendant la migration des pages.
- **Vérification.** `components/verification.ts` (`verificationOf(badges, entity)`, `verificationLabel`), `VerifiedBadge` (`.verified-badge`, `.verified-badge-tip`), `DisplayName` (`.display-name`, `.display-name-text`). `badges` est optionnel sur `post.guild`, `post.author`, `team[].user` et `me.user` (voir [backend-notes.md](backend-notes.md)) : sans le champ, aucune coche. Le menu utilisateur de la barre reçoit `verified` selon `verificationOf(me.user.badges, 'user')`.
- **Autres composants.** `BadgeStrip` (`.badge-strip`, `.badge-strip-item`), `LanguageFlags` (`.language-flags`, `.language-flag`, drapeaux du paquet `flag-icons` importés un par un dans `languageFlags.ts`), `InlineStats` (`.inline-stats`, `.inline-stat`), `Markdown` (`.markdown`, `react-markdown` + `remark-gfm`, sans HTML, liens http(s) et mailto seulement, images remplacées par leur texte, tableaux retirés, h1 à h3 rendus en h3 et h4 à h6 en h4), `FilterBar` (`components/filters/`, `.filter-bar`, `.filter-toolbar`, `.filter-chips`, `.filter-chip`, `.filter-add`, `.filter-popover`, `.filter-option`, `.filter-remove`).
- **FilterBar dans une carte.** Le popover est en `position: absolute` : ne le placez pas dans une `Card` (`overflow: clip` le couperait). Une `FilterBar` se pose sur le fond de page.
