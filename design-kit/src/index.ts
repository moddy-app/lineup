/**
 * The Moddy design kit: components, theme and helpers.
 *
 *   import {initTheme} from '@moddy/design-kit';
 *   initTheme();
 *
 * Importing it defines <moddy-app-bar>, <moddy-user-menu> and
 * <moddy-theme-menu>. Material Web components are imported by whoever uses
 * them (import '@material/web/button/filled-button.js', …).
 */

export {ModdyAppBar} from './components/app-bar.js';
export {moddyLogo, moddyMark} from './components/logo.js';
export {ModdyThemeMenu, ModdyThemePanel} from './components/theme-menu.js';
export {ModdyUserMenu, type ModdyUser} from './components/user-menu.js';

export * from './labels.js';

export {hctFromHex, hexFromHct, themeCss, themeTokens} from './theme/scheme.js';
export {DEFAULT_SEED, SEEDS} from './theme/seeds.js';
export {
  type ColorMode,
  getThemeState,
  initTheme,
  setMode,
  setSeed,
  shuffleSeed,
  THEME_CHANGE,
  type ThemeState,
} from './theme/theme.js';

export {addEdgeCaps, EDGE_CAPS_HTML, edgeCaps} from './utils/edge-caps.js';
export {formatCompact, formatNumber, formatRelativeTime} from './utils/format.js';
export {dominantHue, mainColor} from './utils/main-color.js';
export {loopWhileVisible, playDemo, reduceMotion, stepper, wait} from './utils/motion.js';
