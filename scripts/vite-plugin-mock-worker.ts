/**
 * Serves the MSW service worker for the development mock, and nowhere else.
 *
 * The worker script must be reachable from the site root
 * (`/mockServiceWorker.js`) for its scope to cover the whole site, but it must
 * NEVER end up in a normal production `dist/`: so it is not in `public/`.
 *
 * The plugin is active in exactly the cases where `src/main.tsx` starts the
 * mock (`VITE_MOCK_API=1` AND (dev server OR `--mode mock`)):
 *
 *   - the dev server (`npm run dev:mock`, or plain `npm run dev` with
 *     `VITE_MOCK_API=1` in `.env.local` or in the shell) serves the worker;
 *   - `vite build --mode mock` (`npm run build:mock`) emits it into the bundle,
 *     for an end-to-end run on a preview server.
 *
 * In any other build, `vite build` included even when `VITE_MOCK_API=1` is set,
 * it does nothing: the bundle holds neither MSW nor the worker.
 */

import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadEnv, type Plugin} from 'vite';

const WORKER_URL = '/mockServiceWorker.js';
const WORKER_SOURCE = 'node_modules/msw/lib/mockServiceWorker.js';

/** Whether the mock is wanted: the env flag, read the way Vite reads it for the app (mode files + shell). */
function mockRequested(mode: string, root: string): boolean {
  return loadEnv(mode, root, 'VITE_').VITE_MOCK_API === '1';
}

export function mockWorker(): Plugin {
  let active = false;
  let workerFile = resolve(process.cwd(), WORKER_SOURCE);
  return {
    name: 'lineup-mock-worker',
    config(config, {mode, command}) {
      const root = resolve(config.root ?? process.cwd());
      workerFile = resolve(root, WORKER_SOURCE);
      const wanted = mockRequested(mode, root);
      // Same rule as main.tsx: the flag, and only in dev or in the explicit `mock` mode.
      active = wanted && (command === 'serve' || mode === 'mock');
    },
    configureServer(server) {
      if (!active) return;
      server.middlewares.use(WORKER_URL, (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Service-Worker-Allowed', '/');
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(workerFile));
      });
    },
    generateBundle() {
      if (!active) return;
      this.emitFile({type: 'asset', fileName: WORKER_URL.slice(1), source: readFileSync(workerFile)});
    },
  };
}
