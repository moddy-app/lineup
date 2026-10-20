/**
 * The theme at runtime: change the color or the mode, follow the system's
 * dark mode. The boot script (boot.ts) has already applied a theme before
 * the first paint; this module takes over from there.
 *
 * Every change fires `moddy-theme-change` on window.
 */

import {applyThemeCss, type ColorMode, currentMode, isDarkMode, KEYS, read, write} from './apply.js';
import {tintFavicon} from './favicon.js';
import {themeCss} from './scheme.js';
import {DEFAULT_SEED, SEEDS} from './seeds.js';

export type {ColorMode};

export interface ThemeState {
  seed: string;
  mode: ColorMode;
  /** True when the user picked the color; false: random on every visit. */
  locked: boolean;
}

export const THEME_CHANGE = 'moddy-theme-change';

export function getThemeState(): ThemeState {
  return {
    seed: read(KEYS.seed) || DEFAULT_SEED,
    mode: currentMode(),
    locked: Boolean(read(KEYS.locked)),
  };
}

/** Applies the stored theme for the current mode. */
function render() {
  const {seed, mode} = getThemeState();
  const dark = isDarkMode(mode);
  let css = read(dark ? KEYS.dark : KEYS.light);
  if (!css) {
    css = themeCss(seed, dark);
    write(dark ? KEYS.dark : KEYS.light, css);
  }
  applyThemeCss(css, dark);
  tintFavicon(css);
  window.dispatchEvent(new Event(THEME_CHANGE));
}

function useSeed(seed: string) {
  write(KEYS.seed, seed);
  write(KEYS.light, themeCss(seed, false));
  write(KEYS.dark, themeCss(seed, true));
}

/** A color picked by the user: applied and kept on the next visits. */
export function setSeed(seed: string) {
  useSeed(seed);
  write(KEYS.locked, '1');
  render();
}

/** Back to a random color on every visit, and a new one right away (never
 *  the current one). Returns the new seed. */
export function shuffleSeed(seeds: string[] = SEEDS): string {
  const current = getThemeState().seed.toLowerCase();
  const pool = seeds.filter((seed) => seed.toLowerCase() !== current);
  const seed = pool[Math.floor(Math.random() * pool.length)] ?? seeds[0];
  useSeed(seed);
  write(KEYS.locked, null);
  render();
  return seed;
}

export function setMode(mode: ColorMode) {
  write(KEYS.mode, mode);
  render();
}

/**
 * Call once per page: follows the system's dark mode while in 'auto', tints
 * the favicon, and applies a theme if the boot script did not run.
 */
export function initTheme() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentMode() === 'auto') render();
  });
  if (!document.getElementById('moddy-theme')) {
    if (!read(KEYS.seed)) useSeed(DEFAULT_SEED);
    render();
  } else {
    tintFavicon(document.getElementById('moddy-theme')!.textContent ?? '');
  }
}
