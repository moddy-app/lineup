# Moddy design kit

Tout ce qu'il faut pour démarrer un nouveau service Moddy avec le look de
moddy.app : CSS, thème, polices, composants web, utilitaires et une démo.

- **Les règles** (pourquoi, quand) : [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md). À lire
  avant de toucher à quoi que ce soit de visible.
- **Le code** (comment) : ce dossier.

Le kit ne dépend d'aucun framework. Le CSS marche partout. Les composants
sont des web components (Lit) : ils marchent en HTML simple, avec React, Vue,
Svelte ou Angular.

## Démarrer

```sh
npm install
npm run dev        # démo sur http://localhost:8000/demo/ (?lang=fr pour les libellés en français)
npm run build      # dist/
npm run typecheck
```

La démo (`demo/`) est un profil et un fil "Moddy Network" construits uniquement
avec le kit. Copie-la comme point de départ.

## Contenu

```
design-kit/
├─ DESIGN-SYSTEM.md        les règles
├─ assets/
│  ├─ fonts/               Google Sans (variable) et Google Sans Mono
│  ├─ avatars/             Memoji d'exemple et moddy.webp
│  └─ favicon.svg
├─ labels/<langue>.json    textes des composants du kit, en en, fr, es, pt-BR, de
├─ src/
│  ├─ css/
│  │  ├─ moddy.css         point d'entrée (importe tout le reste)
│  │  ├─ theme-fallback.css   thème par défaut sans JS (généré)
│  │  ├─ fonts.css
│  │  ├─ base.css          tokens (espacements, rayons, texte, teintes), base, chargement
│  │  ├─ layout.css        .app, .page, .bento, spans, .stack, .app-nav, footer, pages spéciales
│  │  ├─ card.css          cartes et leurs coins (edge-caps)
│  │  ├─ components.css    formes, panneaux, lignes, chips, statuts, pills, avatars, stats, tuiles, tooltips
│  │  ├─ material.css      réglages de Material Web (boutons, menus, champs)
│  │  └─ motion.css        tout le mouvement
│  ├─ theme/
│  │  ├─ seeds.ts          les couleurs du thème aléatoire
│  │  ├─ palettes.ts       leurs thèmes clair et sombre (généré)
│  │  ├─ scheme.ts         seed → tokens Material 3
│  │  ├─ apply.ts          stockage et application (partagé avec le boot)
│  │  ├─ boot.ts           script bloquant du <head>
│  │  ├─ theme.ts          API runtime : setSeed, setMode, shuffleSeed, initTheme
│  │  └─ favicon.ts        favicon à la couleur du thème
│  ├─ components/
│  │  ├─ app-bar.ts        <moddy-app-bar>
│  │  ├─ user-menu.ts      <moddy-user-menu>
│  │  ├─ theme-menu.ts     <moddy-theme-menu>, <moddy-theme-panel>
│  │  ├─ hct-slider.ts     <moddy-hct-slider>
│  │  └─ logo.ts           logo et marque Moddy
│  ├─ utils/
│  │  ├─ edge-caps.ts      coins des cartes
│  │  ├─ format.ts         nombres et dates dans la langue de la page
│  │  ├─ main-color.ts     couleur principale d'une image
│  │  └─ motion.ts         démos scriptées (playDemo, loopWhileVisible)
│  ├─ labels.ts            types et textes anglais par défaut
│  └─ index.ts             tout ce que le kit exporte
├─ scripts/build.mjs
└─ demo/                   index.html, demo.css, demo.ts
```

`npm run build` régénère `palettes.ts` et `theme-fallback.css` depuis `seeds.ts`.
Les deux fichiers sont commités, donc tes propres outils peuvent aussi compiler
les sources sans ce script. Pour changer les couleurs, modifie `seeds.ts` puis
lance `npm run build`.

## Brancher une page

L'ordre du `<head>` compte :

```html
<meta name="theme-color" content="#f1f0f7" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />

<!-- 1. Thème avant le premier rendu, page cachée jusqu'à ce qu'elle soit prête. Bloquant exprès. -->
<script src="/dist/theme-boot.js"></script>

<!-- 2. Le design system, la police préchargée. -->
<link rel="stylesheet" href="/dist/moddy.css" />
<link rel="preload" href="/dist/fonts/variable.woff2" as="font" type="font/woff2" crossorigin />

<!-- 3. Les icônes (display=block : jamais leur nom affiché). -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" />

<!-- 4. Ton app. -->
<script type="module" src="/app.js"></script>
```

Avec un bundler (Vite, esbuild, Next…), importe directement les sources :

```ts
import '@moddy/design-kit/src/css/moddy.css';
import {initTheme, addEdgeCaps} from '@moddy/design-kit/src/index.ts';
import '@material/web/button/filled-button.js'; // chaque composant Material que tu utilises

initTheme();
```

Le boot (`src/theme/boot.ts`) doit rester un script classique, bloquant, dans le
`<head>`. Ne le mets pas dans le bundle de l'app. Sans lui, le thème s'applique
quand même, mais après le premier rendu.

Avec Next.js ou un autre SSR, déclare le kit dans `transpilePackages` et importe
les composants côté client uniquement : les web components et le thème ont besoin
de `window`.

### Les cartes dans un framework

Chaque carte commence par les `edge-caps`. Fais-en un composant `Card` qui les
rend toujours :

```tsx
// React : les edge-caps sont le premier enfant direct de la carte.
const EdgeCaps = () => (
  <span className="edge-caps" aria-hidden="true">
    <i className="cap-top"><b className="tl" /><b className="tr" /></i>
    <span className="own"><b className="tl" /><b className="tr" /><b className="bl" /><b className="br" /></span>
    <i className="cap-bottom"><b className="bl" /><b className="br" /></i>
  </span>
);

export function Card({span, className = '', children, ...props}) {
  return (
    <section className={`card ${span ? `span-${span}` : ''} ${className}`} {...props}>
      <EdgeCaps />
      {children}
    </section>
  );
}
```

Dans une page rendue côté serveur ou en HTML simple, `addEdgeCaps()` les ajoute à
toutes les `.card`.

### Les composants

```html
<moddy-app-bar home-href="/">
  <nav slot="nav" class="app-nav" aria-label="…">
    <a href="/" aria-current="page"><span class="material-symbols-outlined" aria-hidden="true">home</span><span class="app-nav-label">Fil</span></a>
  </nav>
  <moddy-theme-menu></moddy-theme-menu>
  <moddy-user-menu>
    <md-menu-item href="/settings"><md-icon slot="start">settings</md-icon><div slot="headline">Paramètres</div></md-menu-item>
  </moddy-user-menu>
</moddy-app-bar>
```

```ts
import fr from '@moddy/design-kit/labels/fr.json';

appBar.labels = fr.appBar;
themeMenu.labels = fr.theme;
userMenu.labels = fr.userMenu;
userMenu.user = {handle: 'mia', name: 'Mia Laurent', email: '…', avatar: '…', verified: 'Compte vérifié', max: true};
userMenu.addEventListener('sign-out', () => logout());
```

`<moddy-user-menu>` ne connaît ni l'API ni l'authentification : l'app lui donne
l'utilisateur et réagit à `sign-out`.

### Le thème en code

```ts
import {getThemeState, setSeed, setMode, shuffleSeed, THEME_CHANGE} from '…';

setSeed('#0B8A7A');      // couleur choisie, gardée aux prochaines visites
shuffleSeed();           // retour au tirage aléatoire à chaque visite
setMode('dark');         // 'light' | 'dark' | 'auto'
addEventListener(THEME_CHANGE, () => …);
```

Clés `localStorage` : `moddy-theme-seed`, `moddy-theme-mode`, `moddy-theme-locked`,
`moddy-theme-light`, `moddy-theme-dark`.

## Pour une plateforme de type réseau

Pas de composant à inventer : tout se compose avec les briques du kit (la démo
montre la plupart).

| Besoin | Brique |
|---|---|
| Fil d'actualité et colonne latérale | `.stack.span-8` (un post = une `.card`) à côté de `.stack.span-4.sticky` |
| En-tête de profil | carte `span-8` : `.avatar.xl`, nom en `h1`, `.verified`, `@handle` en `.pill`, boutons |
| Chiffres du profil | `.panel` de `.stat`, `formatNumber` |
| Expériences, offres, notifications | `.rows` : `.row` avec forme ou avatar, titre, méta, `.status` |
| Compétences, tags | `.chips`, `a.chip` si ça mène quelque part |
| Communautés, pages | `a.card` (seule carte avec un survol) |
| Réactions, commentaires | `md-text-button` avec icône, dans `.card-actions` |
| Formulaires | `md-outlined-text-field`, action principale `md-filled-button` |
| Ids, @handles, URLs | `.pill` (mono) |
| États vides | `.card.split` : forme, une phrase, un bouton, une petite démo `playDemo` |
| Erreurs, connexion | `.page.special`, sans footer |

## Ce qui a été laissé au site vitrine

Le kit vient du site moddy.app (`site/`), sans ce qui ne sert qu'au site vitrine :
Eleventy et le rendu par langue, l'îlot SSR, les illustrations de la page d'accueil,
la page Moddy Max, l'embed Discord, la redirection de langue, Google Analytics, et
l'authentification Discord de la barre du haut. Le comportement visuel est le même.
Les noms changent :

| Site | Kit |
|---|---|
| `--home-card-padding`, `--home-card-radius` | `--card-padding`, `--card-radius` |
| `--catalog-top-app-bar-height` | `--app-bar-height` |
| `--catalog-body-l-font-size`… | `--text-body`… |
| `.home` | `.page` |
| `.bento::after` | `.page::after` |
| `<top-app-bar>` | `<moddy-app-bar>` + `<moddy-user-menu>` |
| `<theme-changer>` dans le footer | `<moddy-theme-menu>`, à mettre où l'app veut |
| `random-theme.html` + `apply-saved-theme.ts` + `html.booting` | `theme-boot.js` |
