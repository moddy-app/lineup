/**
 * Shared by the boot script (before the first paint) and the runtime: keep
 * it small and free of imports, it is inlined in every page's <head>.
 */

export type ColorMode = 'light' | 'dark' | 'auto';

/** What the theme keeps in localStorage. */
export const KEYS = {
  /** The current seed color. */
  seed: 'moddy-theme-seed',
  /** 'light' | 'dark' | 'auto'. */
  mode: 'moddy-theme-mode',
  /** Set when the user picked a color: no random color on the next load. */
  locked: 'moddy-theme-locked',
  /** The current seed's theme, light and dark, so the mode can change and
   *  the next load can apply it without any color math. */
  light: 'moddy-theme-light',
  dark: 'moddy-theme-dark',
} as const;

const STYLE_ID = 'moddy-theme';

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private window or blocked storage: the theme holds for this page.
  }
}

export function currentMode(): ColorMode {
  const mode = read(KEYS.mode);
  return mode === 'light' || mode === 'dark' ? mode : 'auto';
}

export function isDarkMode(mode: ColorMode) {
  return mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

/** Applies a theme stylesheet (from themeCss) to the document. */
export function applyThemeCss(css: string, isDark: boolean) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = css;
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  // The browser's UI (the URL bar on phones) takes the page color.
  const surface = css.match(/--md-sys-color-surface-container:([^;]+);/)?.[1];
  if (surface) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
  }
}
