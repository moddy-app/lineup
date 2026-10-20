/**
 * Inlines the design kit's theme boot script in index.html.
 *
 * The kit README is explicit: `design-kit/src/theme/boot.ts` must stay a
 * classic, blocking script in the <head>, outside the app bundle. It picks
 * the theme and hides the page (html.booting) before the first paint; as a
 * module, or after the stylesheets, the page would flash in the wrong
 * colors. So it is not imported from main.tsx: this plugin bundles it with
 * esbuild (iife, minified) and writes it inline where index.html has the
 * placeholder, in dev and in build.
 *
 * The placeholder (not `injectTo: 'head-prepend'`) keeps the README's <head>
 * order exact: charset, viewport, theme-color and favicon first (the charset
 * must be within the first 1024 bytes, the inlined boot is far bigger), then
 * the boot script.
 */

import {buildSync} from 'esbuild';
import {resolve} from 'node:path';
import type {Plugin} from 'vite';

const PLACEHOLDER = '<!-- theme-boot -->';

export function themeBoot(entry = 'design-kit/src/theme/boot.ts'): Plugin {
  let root = process.cwd();
  let minify = true;

  const bundle = (): string => {
    const {outputFiles} = buildSync({
      entryPoints: [resolve(root, entry)],
      bundle: true,
      format: 'iife',
      minify,
      target: 'es2020',
      write: false,
      logLevel: 'silent',
    });
    const code = outputFiles[0]?.text ?? '';
    // "</script" would end the inline script early.
    return code.replace(/<\/script/gi, '<\\/script');
  };

  return {
    name: 'lineup:theme-boot',
    configResolved(config) {
      root = config.root;
      minify = config.command === 'build';
    },
    // The boot script's sources are not in the module graph: reload the page
    // when one changes in dev.
    configureServer(server) {
      const dir = resolve(root, 'design-kit/src/theme');
      server.watcher.on('change', (file) => {
        if (file.startsWith(dir)) server.ws.send({type: 'full-reload'});
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(PLACEHOLDER)) {
          throw new Error(`index.html needs the ${PLACEHOLDER} placeholder after the favicon link.`);
        }
        return html.replace(PLACEHOLDER, () => `<script>${bundle()}</script>`);
      },
    },
  };
}
