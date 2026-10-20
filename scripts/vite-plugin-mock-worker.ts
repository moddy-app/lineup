/**
 * Serves the MSW service worker for the development mock, and nowhere else.
 *
 * The worker script must be reachable from the site root
 * (`/mockServiceWorker.js`) for its scope to cover the whole site, but it must
 * NEVER end up in a normal production `dist/`: so it is not in `public/`.
 * It exists only in `--mode mock`: served by the dev server, and emitted into
 * the bundle of `npm run build:mock` (for an end-to-end run on a preview
 * server). In any other mode this plugin does nothing.
 */

import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {Plugin} from 'vite';

const WORKER_URL = '/mockServiceWorker.js';
const WORKER_FILE = fileURLToPath(new URL('../node_modules/msw/lib/mockServiceWorker.js', import.meta.url));

export function mockWorker(): Plugin {
  let active = false;
  return {
    name: 'lineup-mock-worker',
    config(_config, {mode}) {
      active = mode === 'mock';
    },
    configureServer(server) {
      if (!active) return;
      server.middlewares.use(WORKER_URL, (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Service-Worker-Allowed', '/');
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(WORKER_FILE));
      });
    },
    generateBundle() {
      if (!active) return;
      this.emitFile({type: 'asset', fileName: WORKER_URL.slice(1), source: readFileSync(WORKER_FILE)});
    },
  };
}
