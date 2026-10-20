# Moddy Design System

Les règles du look Moddy, pour tout service Moddy : le site vitrine
moddy.app, et les plateformes construites avec ce kit. Le code qui les applique
est dans `src/` ; ce fichier dit **pourquoi** et **quand**. Le `README.md` dit
**comment** démarrer.

Un service Moddy doit avoir l'air d'avoir toujours fait partie du même site :
mêmes marges, mêmes cartes, même police, mêmes couleurs, même mouvement.

---

## 1. Principes

1. **Bento minimal.** La page est une grille de cartes arrondies unies. Une idée
   par carte : un titre, une ou deux phrases, au plus une illustration ou quelques boutons.
2. **Rien de décoratif sans sens.** Pas de dégradé sur les cartes, pas de halo, pas
   d'ombre sur les cartes, pas de motif de fond, pas d'emoji. Un visuel montre le
   produit en train de faire quelque chose (un vrai message, une ligne de log, une
   ligne de tableau de bord), sinon il n'existe pas.
3. **Calme.** Le mouvement est rare et utile (section 8). Rien ne bouge seul,
   sauf à l'intérieur d'une illustration visible.
4. **Mêmes marges partout.** Une seule valeur d'espacement par niveau. Si deux
   écarts d'une page diffèrent, l'un des deux est faux.

---

## 2. Couleurs

### Règle absolue

**Uniquement les tokens Material** `--md-sys-color-*`. Jamais de valeur hex dans le CSS.
Le thème change à chaque chargement (seed aléatoire), en clair et en sombre : toute
couleur codée en dur jurera avec certains thèmes.

### Le thème

- Seeds (`src/theme/seeds.ts`) : `#003BCC` (bleu Moddy, défaut et thème sans JS),
  `#6750A4`, `#0B8A7A`, `#D6336C`, `#E8590C`, `#2F9E44`, `#1C7ED6`, `#AE3EC9`,
  `#C2255C`, `#5C7CFA`.
- Chaque seed devient un thème Material 3 complet (`SchemeContent`), clair et
  sombre, **au build** (`src/theme/palettes.ts`). Le script de démarrage en choisit
  un avant le premier rendu (jamais le même deux fois de suite) : pas de flash, pas
  de calcul de couleur dans le `<head>`.
- Si l'utilisateur choisit une couleur dans le menu de thème, elle est gardée. La
  pastille "aléatoire" revient au tirage à chaque visite.
- Modes : clair, sombre, auto (suit le système, en direct).

### Surfaces (la hiérarchie la plus importante)

| Élément | Token |
|---|---|
| Fond de page (`:root`, barre du haut) | `surface-container` |
| Cartes, menus | `surface-container-lowest` (un cran plus clair que la page) |
| Panneaux intérieurs (`.panel`, `.row`, `.pill`, carte utilisateur du menu) | `surface-container` |

### Zones colorées

- **Petites** (formes d'icône, statuts) : `primary-container`,
  `tertiary-container`, `secondary-container`, ou `primary` pour l'unique accent
  plein (`.tone-solid`, `.status.accent`, `.badge`).
- **Grandes** (tuiles, gros aplats) : les teintes douces `--tint-primary`,
  `--tint-tertiary`, `--tint-secondary` (`.tile`). Les conteneurs sont trop vifs à
  cette taille.

### Texte

| Usage | Token |
|---|---|
| Titres | `on-surface` |
| Corps et texte secondaire | `on-surface-variant` |
| Accents (chiffres, liens, badges) | `primary` |
| Erreurs, déconnexion, suppression | `error` uniquement |

### Seules couleurs calculées depuis un contenu

Les couleurs tirées d'une image (`mainColor`, `dominantHue` dans
`src/utils/main-color.ts`) : l'anneau Moddy Max, une tuile de serveur, une bannière
de profil. Toujours avec les couleurs du thème en repli.

---

## 3. Typographie

| | |
|---|---|
| Texte et titres | **Google Sans**, variable, 400 à 700 dans un seul fichier (`assets/fonts/variable.woff2`) |
| Code, chemins, ids | **Google Sans Mono**, 400 (`assets/fonts/mono.woff2`) |
| Repli | `'Google Sans', Roboto, system-ui, sans-serif` |
| Chargement | auto-hébergées, `font-display: swap`, la variable préchargée |
| Material Web | même police (`--md-ref-typeface-plain`) |

### Poids

- **600** pour les titres (`h1`…`h6`) et les noms (`strong`, `b`), antialiasés.
- **400 à 500** pour le texte. Jamais 700, jamais de gras synthétique.

### Échelle (tokens de `src/css/base.css`)

| Token | Bureau | ≤ 600px | Usage |
|---|---|---|---|
| `--text-display` | `clamp(38px, 5.2vw, 64px)` | | le `h1` de la page (hero), interligne 1.15, `-0.01em` |
| `--text-title` | 28px | 24px | `h2` de carte |
| `--text-hero` | 18px | | corps du hero |
| `--text-body` | 16px | 14px | corps, interligne 1.5, largeur max ~560px |
| `--text-subtitle` | 15px | | `h3` de carte, titres de ligne |
| `--text-body-small` | 14px | 12px | chips, texte secondaire, nav |
| `--text-small` | 13px | | emails, méta, petit texte |
| `--text-label` | 12px | | statuts, méta mono, tooltips |

Dans une carte, le bloc de texte suit des petits pas fixes : forme, puis titre
(`margin: 20px 0 10px`), puis texte.

### Règles

- **Chiffres qui changent** (stats, compteurs) : `tabular-nums` (`.stat-value`,
  `.numeric`) et format de la langue (`formatNumber`, `formatCompact`).
- **Dates** relatives dans la langue (`formatRelativeTime`).
- **Valeurs dynamiques que l'utilisateur n'a pas écrites** (chemin, id, @handle) :
  dans une pill mono (`.pill`), jamais en ligne dans une phrase.
- Liens : `primary`, soulignés seulement au survol et au focus clavier.

---

## 4. Espacement et mise en page

| Token | Bureau | ≤ 600px | Usage |
|---|---|---|---|
| `--page-gap` | 20px | 12px | marge de page, écart entre cartes, espace au-dessus du footer |
| `--card-padding` (= `--space`) | 32px | 20px | padding des cartes **et** espace entre blocs dans une carte |
| `--card-radius` | 32px | 24px | angles des cartes |
| `--content-width` | 1240px | | largeur max de `.page`, centrée |
| `--app-bar-height` | 72px | | hauteur de la barre du haut |

Pas internes : `--gap-s` 8px, `--gap-m` 12px, `--gap-l` 16px. Rayons : `--radius-xs`
4px (tooltips), `-s` 8px (chips), `-m` 12px, `-l` 16px (lignes, items de menu),
`-xl` 24px (panneaux, menus), `-full` (pills).

### Grille bento

- `.bento` : 12 colonnes. Enfants pleine largeur par défaut, `span-3` … `span-8`
  sinon. **Les rangées sont pleines** : les spans d'une rangée font 12.
- ≤ 1100px : tout span ≥ 4 passe à 12, `span-3` passe à 6.
- ≤ 900px : `.card.split` passe en une colonne.
- ≤ 600px : rayon, padding et tailles de texte réduits.
- **À 390px de large : aucun défilement horizontal, jamais.**
- `.stack` : une colonne de cartes dans la grille (un fil `span-8` à côté d'une
  colonne `span-4`). `.stack.sticky` reste visible pendant que l'autre défile.
- **Pages spéciales** (404, erreur, connexion) : `.page.special`, sans footer,
  plus étroite (1040px, 640px empilée), centrée dans les deux sens.

### Structure

```
.app
 ├─ <moddy-app-bar>        sticky, 72px, surface-container
 ├─ main.app-content       padding: --page-gap
 │    └─ .page > .bento    cartes
 └─ footer.app-footer      carte sans coins du bas, au bord de la fenêtre
```

La bande fixe `.page::after` (une marge de page, couleur de la page) masque le
bas de la fenêtre : les cartes en sortent une marge au-dessus du bord, comme elles
passent sous la barre du haut.

---

## 5. Cartes

```html
<section class="card span-7">
  <span class="edge-caps" aria-hidden="true">…</span>
  <h2>Titre</h2>
  <p>Une ou deux phrases.</p>
  <div class="card-visual">…</div>
  <div class="card-actions">…</div>
</section>
```

- Fond `surface-container-lowest`, padding `--card-padding`, `overflow: clip` (pas
  `hidden`, qui casserait les coins).
- **Toute carte commence par `edge-caps`** (`EDGE_CAPS_HTML`, `edgeCaps` en Lit, ou
  `addEdgeCaps()` sur une page rendue). La carte n'a alors pas de `border-radius` :
  ses coins sont des petites pièces dans la couleur de la page, et deux paires
  sticky gardent les coins ronds là où la carte passe sous la barre du haut et sous
  la marge du bas.
- Sur ses deux derniers rayons, la carte finit en pilule : les pièces rétrécissent
  avec `transform: scale()` sur la view timeline de la carte, à la souris seulement.
  **Ne jamais animer `border-radius`, une propriété custom ou un `clip-path` au
  scroll** : tout a été essayé et saccade sur téléphone.
- Titre en `h2` (`h1` seulement pour le hero). Ordre : **titre → texte → visuel →
  actions**, séparés par `--space`. Les boutons restent en bas (`.card-actions`).
- Variantes : `.card.split` (texte et visuel côte à côte, `.reverse`),
  `.card.hero` (centré, une par page), `a.card` (carte-lien).
- **Survol seulement si toute la carte est un lien** (`a.card`). Sinon aucun.
- Pièces internes : `.card-head` (avatar ou forme + titre), `.panel`, `.rows` /
  `.row` (`a.row` réagit au survol), `.chips` / `.chip` (`a.chip` se remplit et
  sa flèche `.chip-go` sort), `.status` (`.strong`, `.accent`, `.error`), `.badge`,
  `.pill`, `.stat`, `.tiles` / `.tile`.

---

## 6. Icônes, formes, composants

### Icônes

**Material Symbols Outlined**, **remplies** (`'FILL' 1`, classe `.filled`) dans
les formes, menus et badges. Chargées avec `display=block` (jamais leur nom affiché).
Aucun emoji.

### Formes

```html
<span class="shape shape-hexagon tone-tertiary"><span class="material-symbols-outlined">verified</span></span>
```

Une icône de fonctionnalité vit dans un **polygone**, jamais un cercle ni un trèfle :
`square`, `diamond`, `pentagon`, `hexagon`, `heptagon`, `octagon` ; tons défaut
(primary), `tone-secondary`, `tone-tertiary`, `tone-solid` ; 56px ou `.small`
(36px). **Varier formes et tons entre cartes voisines.**

### Material Web

- Boutons : `md-filled-button` pour l'unique action principale,
  `md-outlined-button` pour les autres, **trois au maximum** par rangée.
  `md-text-button` pour les actions répétées de faible poids (réactions d'un fil).
  Aucun bouton maison.
- Menus : `surface-container-lowest`, coins 24px, items de 48px avec coins 16px et
  8px de marge, icônes remplies, séparateur inset de 16px, item destructif
  `.destructive` en `error`. Pas d'icône "lien externe".
- Champs : `md-outlined-text-field`, coins 16px. Dialogues : coins de carte.
- Tooltips : `inverse-surface`, coins 4px, 12px, fondu d'opacité (`data-tooltip`).

### Avatars

Ronds, `object-fit: cover` (`.avatar`, `.small` 32, défaut 40, `.large` 56, `.xl`
96). Les vrais profils montrent la photo de l'utilisateur ; les exemples (démos,
états vides, captures) utilisent les Memoji de `assets/avatars/` et `moddy.webp`.
Jamais d'initiales ni de photos de stock.

### Composants du kit

| Élément | Rôle |
|---|---|
| `<moddy-app-bar>` | logo (marque seule ≤ 600px), slot `nav`, actions à droite, lien d'évitement |
| `.app-nav` | navigation dans la barre : icône + libellé, page courante en pill `secondary-container`, icônes seules ≤ 900px |
| `<moddy-user-menu>` | avatar 32px, anneau Moddy Max **à l'extérieur** de l'image (barre seulement), carte utilisateur (nom ou @handle, badge vérifié unique avec le type en tooltip, email), items de l'app, "Se déconnecter" |
| `<moddy-theme-menu>` | pastilles rondes des seeds (la choisie devient un carré arrondi avec une coche) après une pastille "aléatoire", couleur personnalisée (sélecteur, hex, curseurs HCT), mode en trois segments. Garder chacun de ces éléments |

---

## 7. Mouvement

- **Tout le mouvement est dans `prefers-reduced-motion: no-preference`.** Sinon,
  chaque illustration montre son état final.
- Easing `--ease` (`cubic-bezier(0.2, 0, 0, 1)`). **150 à 400ms** pour l'UI, plus
  lent seulement pour les boucles d'ambiance (une forme `.turning` en 24s).
- **Survol seulement sur ce qui réagit au pointeur** (liens, chips, boutons) et
  quand ça dit quelque chose. Pas de survol sur les stats, le texte, les illustrations.
- Illustrations : petites démos scriptées (`playDemo`, `data-at`, `data-done-at`,
  `data-press-at`) qui tournent **seulement visibles** (`loopWhileVisible`). Aucune
  animation d'entrée au scroll.
- **Ne jamais calculer quoi que ce soit au scroll.** CSS que le navigateur compose
  (sticky, transforms).
- **Chargement** : la page reste cachée (`html.booting`) jusqu'à ce que les
  composants à l'écran soient définis et les polices chargées (1,5s max), puis
  apparaît en fondu. Les composants non définis gardent leur taille. Pas de flash
  de police, de boutons bruts ou de noms d'icônes.

---

## 8. Rédaction

- Simple, précis, court. Dire ce que fait le produit, avec de vraies fonctions et
  de vrais chiffres.
- Interdits : le remplissage marketing ("seamless", "powerful", "unlock",
  "elevate", "supercharge", "revolutionize", "next level" et leurs équivalents),
  les questions rhétoriques, les triplets pour le rythme, les incises avec tirets
  cadratins.
- Une petite blague est permise sur une impasse (404), jamais dans le texte produit.
- La baseline "Built to let you focus on your community" reste en anglais partout.
- En cas de doute, écrire le français d'abord, puis adapter chaque langue (pas mot à mot).

### i18n (obligatoire)

- Langues : en, fr, es, pt-BR, de.
- Toute chaîne visible vient des fichiers de langue, **dans les 5 langues**.
- Les composants reçoivent leur texte par `labels` (`labels/<langue>.json` pour
  ceux du kit), jamais en dur.
- `<html lang>` juste : les nombres et les dates en dépendent.

---

## 9. Accessibilité

- Focus clavier visible : contour 2px `primary`, décalé de 2px.
- Contrastes : toujours une paire Material (`on-X` sur `X`).
- Éléments décoratifs en `aria-hidden` (les `edge-caps`, les icônes à côté d'un texte).
- Le lien "Aller au contenu principal" de la barre mène à `#main-content`.
- Sans JS, la page garde le thème par défaut (`theme-fallback.css`).

---

## 10. Avant de pousser un changement visuel

1. `npm run build` et `npm run typecheck` passent.
2. Captures (Playwright, Chromium) à **1400px** et **390px**, clair et sombre, dans
   au moins **deux langues**. Les regarder.
3. Faire défiler une carte sous la barre du haut et sous le bord bas : les coins
   restent ronds.
4. Recharger plusieurs fois : aucun saut au chargement, chaque seed rend bien.
5. Aucune couleur hex dans le CSS, aucun emoji, aucun dégradé, aucune ombre sur une
   carte, rangées pleines, pas de défilement horizontal à 390px.
