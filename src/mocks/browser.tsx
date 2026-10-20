/**
 * The development mock of the Moddy API, in the browser (MSW v2).
 *
 * `startMocks()` is called by main.tsx BEFORE React renders, and only when
 * `VITE_MOCK_API=1`, through a dynamic import: nothing of src/mocks or msw is
 * in a production build.
 *
 * The handlers match the ABSOLUTE API URLs (`${apiBase}/lineup/…`), so the app
 * runs the very same code in mock and real mode. All the rules live in
 * ./logic and ./server; this file is only the browser plumbing: the service
 * worker, the latency and network-failure toggles, the login page.
 */

import {delay, http, HttpResponse} from 'msw';
import {setupWorker} from 'msw/browser';
import type {ReactNode} from 'react';
import {createRoot} from 'react-dom/client';

import {sanitizeRedirect, setLoginUrlBuilder} from '@/api/endpoints';
import {config} from '@/config';

import {getDb, saveDb} from './db';
import {DevPanel} from './DevPanel';
import {MockLoginPage} from './LoginPage';
import {currentSession, getPersonaId, isSessionExpired, setPersonaId} from './personas';
import {dispatch, type ServerContext} from './server/dispatch';
import {routes} from './server/routes';
import {getSettings, takeFailNext} from './settings';

export const LOGIN_PAGE_PATH = '/__mock/login';
const WORKER_URL = '/mockServiceWorker.js';

const server: ServerContext = {
  get db() {
    return getDb();
  },
  now: () => new Date(),
  session: currentSession,
  expired: isSessionExpired,
  discordDown: () => getSettings().discordDown,
  verifyOutcome: () => getSettings().verifyOutcome,
  feedCache: () => getSettings().feedCache,
  logout: () => setPersonaId('anonymous'),
  persist: saveDb,
};

/** The latency of an answer: the chosen base, ±40%. */
function latency(): number {
  const base = getSettings().latency;
  return base === 0 ? 0 : Math.round(base * (0.6 + Math.random() * 0.8));
}

async function respond(request: Request): Promise<Response> {
  // "Next request fails": the browser sees what an offline user sees.
  if (takeFailNext()) return HttpResponse.error();
  const wait = latency();
  if (wait > 0) await delay(wait);
  return dispatch(server, request);
}

function handlers() {
  const verbs = {GET: http.get, POST: http.post, PUT: http.put, PATCH: http.patch, DELETE: http.delete} as const;
  return [
    ...routes.map((route) => verbs[route.method](`${config.apiBase}${route.path}`, ({request}) => respond(request))),
    // Anything else under the API: 404 `{"error": "Not Found"}`, like an unknown route.
    http.all(`${config.apiBase}/*`, ({request}) => respond(request)),
  ];
}

/**
 * The sign-in goes to the mock's own page on this origin, not to Discord
 * (LINEUP.md §2). `reauth=1` marks a `lineup_reauth_required` sign-in.
 */
function mockLoginUrl(redirect: string, loginPath?: string): string {
  const params = new URLSearchParams({redirect: sanitizeRedirect(redirect)});
  if (loginPath !== undefined) params.set('reauth', '1');
  return `${LOGIN_PAGE_PATH}?${params.toString()}`;
}

/** The dev panel lives in its own React root, outside the app's tree and router. */
function mountDevPanel(): void {
  const host = document.createElement('div');
  host.id = 'mock-dev-panel';
  document.body.append(host);
  createRoot(host).render(<DevPanel />);
}

/**
 * MSW calls `registration.update()` without waiting for it or catching it. When the page is being reloaded at that
 * very moment (MSW itself reloads once after a hard refresh, which leaves the page uncontrolled), the update is
 * refused with "Failed to update a ServiceWorker … Not found" and the browser reports an unhandled rejection. It is
 * noise: the worker is registered and answering. Only that one is silenced.
 */
function silenceWorkerUpdateNoise(): void {
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (message.includes('Failed to update a ServiceWorker')) event.preventDefault();
  });
}

/**
 * Starts the mock. Returns the element to render INSTEAD of the app when the
 * address is the mock's login page, or null for the normal app.
 */
export async function startMocks(): Promise<ReactNode | null> {
  setLoginUrlBuilder(mockLoginUrl);
  silenceWorkerUpdateNoise();
  const worker = setupWorker(...handlers());
  try {
    await worker.start({
      serviceWorker: {url: WORKER_URL},
      onUnhandledRequest: 'bypass',
      quiet: true,
    });
  } catch (error) {
    // The mock was asked for but cannot run: say why, and let the app load (its API calls will then fail visibly
    // against the real API, which is the honest picture of "no mock").
    console.error(
      `[mock api] could not start: ${WORKER_URL} is not being served (or service workers are unavailable).\n` +
        'Run `npm run dev:mock`, or set VITE_MOCK_API=1 and restart the dev server: the Vite plugin ' +
        '(scripts/vite-plugin-mock-worker.ts) serves the worker only then.',
      error,
    );
    return null;
  }
  getDb();
  mountDevPanel();
  console.info(`[mock api] running, persona: ${getPersonaId()}. Panel: bottom left.`);
  return window.location.pathname === LOGIN_PAGE_PATH ? <MockLoginPage /> : null;
}
