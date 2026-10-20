/**
 * The boot script: a small classic script, loaded blocking in the <head>
 * before any stylesheet is painted (dist/theme-boot.js, see the README).
 *
 * 1. Applies the theme: a new color among the seeds on every load (never
 *    the same twice in a row), or the one the user picked. The seeds' themes
 *    are computed at build time (palettes.ts), so nothing is painted in a
 *    wrong color and no color math runs here.
 * 2. Keeps the page hidden (html.booting) until the components on screen
 *    are defined and the fonts are loaded, 1.5 s at most, so there is no
 *    flash of fallback font, raw buttons or icon names.
 */

import {applyThemeCss, currentMode, isDarkMode, KEYS, read, write} from './apply.js';
import {PALETTES} from './palettes.js';

function applyTheme() {
  const mode = currentMode();
  const dark = isDarkMode(mode);
  let css = read(KEYS.locked) ? read(dark ? KEYS.dark : KEYS.light) : null;
  if (!css) {
    const last = (read(KEYS.seed) || '').toLowerCase();
    const pool = PALETTES.filter((p) => p.seed.toLowerCase() !== last);
    const pick = pool[Math.floor(Math.random() * pool.length)] || PALETTES[0];
    // A picked color whose theme is missing (cleared storage) falls back
    // to random colors.
    write(KEYS.locked, null);
    write(KEYS.seed, pick.seed);
    write(KEYS.light, pick.light);
    write(KEYS.dark, pick.dark);
    css = dark ? pick.dark : pick.light;
  }
  applyThemeCss(css, dark);
}

function holdUntilReady() {
  const root = document.documentElement;
  root.classList.add('booting');
  const reveal = () => root.classList.remove('booting');
  setTimeout(reveal, 1500);
  addEventListener('DOMContentLoaded', () => {
    const tags = new Set<string>();
    for (const el of document.querySelectorAll(':not(:defined)')) {
      if (el.getBoundingClientRect().top < innerHeight) tags.add(el.localName);
    }
    Promise.all([document.fonts.ready, ...[...tags].map((tag) => customElements.whenDefined(tag))]).then(() =>
      requestAnimationFrame(reveal),
    );
  });
}

applyTheme();
holdUntilReady();
