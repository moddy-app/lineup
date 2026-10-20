/**
 * Preloads the design kit's Google Sans (variable) font.
 *
 * moddy.css is imported from main.tsx, so Vite hashes the font file
 * (assets/variable-<hash>.woff2) and rewrites the @font-face url() to it. A
 * hand-written <link rel="preload"> would point at a different URL and the
 * browser would download the font twice. This plugin writes the preload at
 * the placeholder in index.html with the very same URL as the stylesheet's:
 *   - build: the hashed asset found in the bundle;
 *   - dev: the file served from the kit folder.
 * `crossorigin` is required for fonts, even same-origin, or the preload does
 * not match the @font-face request.
 */

import {posix} from 'node:path';
import type {Plugin} from 'vite';

const PLACEHOLDER = '<!-- font-preload -->';
const FONT = 'variable.woff2';
const DEV_FONT_PATH = `design-kit/assets/fonts/${FONT}`;

export function fontPreload(): Plugin {
  let base = '/';

  return {
    name: 'lineup:font-preload',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!html.includes(PLACEHOLDER)) return html;
        let href: string | undefined;
        if (ctx.bundle) {
          const asset = Object.values(ctx.bundle).find(
            (file) => file.type === 'asset' && file.originalFileNames.some((name) => name.endsWith(`/${FONT}`)),
          );
          if (asset) href = posix.join(base, asset.fileName);
        } else {
          href = posix.join(base, DEV_FONT_PATH);
        }
        const link = href
          ? `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin />`
          : '';
        return html.replace(PLACEHOLDER, () => link);
      },
    },
  };
}
