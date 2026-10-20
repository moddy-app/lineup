/**
 * The text of the kit's components. Pages pass translated strings through a
 * `labels` property or JSON attribute (labels/<locale>.json holds them in
 * the five Moddy languages); English is the fallback. Never hardcode a
 * visible string in a component.
 */

export interface AppBarLabels {
  home: string;
  skipToMain: string;
}

export interface UserMenuLabels {
  userMenu: string;
  signOut: string;
}

export interface ThemeLabels {
  title: string;
  colors: string;
  random: string;
  randomTitle: string;
  custom: string;
  source: string;
  hue: string;
  chroma: string;
  tone: string;
  mode: string;
  dark: string;
  auto: string;
  autoShort: string;
  light: string;
}

export const APP_BAR_LABELS: AppBarLabels = {
  home: 'Home',
  skipToMain: 'Skip to main content',
};

export const USER_MENU_LABELS: UserMenuLabels = {
  userMenu: 'User menu',
  signOut: 'Sign out',
};

export const THEME_LABELS: ThemeLabels = {
  title: 'Theme',
  colors: 'Colors',
  random: 'Random',
  randomTitle: 'A new color on every visit',
  custom: 'Custom color',
  source: 'Source color',
  hue: 'Hue',
  chroma: 'Chroma',
  tone: 'Tone',
  mode: 'Color mode',
  dark: 'Dark',
  auto: 'Automatic',
  autoShort: 'Auto',
  light: 'Light',
};
