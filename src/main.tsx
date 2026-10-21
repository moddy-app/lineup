/**
 * Entry point.
 *
 * Order matters: the design system CSS, then the app's own; the kit and the
 * Material Web elements are imported (so defined) BEFORE React renders, so
 * React 19 finds each custom element upgraded and sets objects (labels, user)
 * as properties, not as attributes.
 */

import '@moddy/design-kit/src/css/moddy.css';
import '@/styles/lineup.css';

import {initTheme} from '@moddy/design-kit';
import {type ReactNode, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import '@/ui/material';

import {App} from '@/app/App';
import {consumeAuthError} from '@/auth/authError';
import {initI18n} from '@/i18n';
import {getItem, setItem} from '@/lib/storage';

initTheme();
initI18n();
// A refused sign-in comes back with ?auth_error=: read and removed before the router reads the address.
consumeAuthError();

// After a deploy, an open tab asks for a script that no longer exists: reload
// once to get the new version (the guard stops a loop if the server is down).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const key = 'lineup-reloaded-at';
  if (Date.now() - getItem(key, 0, 'session') > 10_000) {
    setItem(key, Date.now(), 'session');
    window.location.reload();
  }
});

// Development mock API (`npm run dev:mock`, `npm run build:mock`): starts the MSW worker BEFORE anything renders and
// may return its own page (the mock sign-in) to render instead of the app. The condition is a constant in a normal
// production build, so neither src/mocks nor msw is in it (the dynamic import is dropped). It is the same rule as
// scripts/vite-plugin-mock-worker.ts, which serves the worker script exactly when this condition can hold:
// VITE_MOCK_API=1 and (the dev server or `--mode mock`).
let mockPage: ReactNode = null;
if (import.meta.env.VITE_MOCK_API === '1' && (import.meta.env.DEV || import.meta.env.MODE === 'mock')) {
  const {startMocks} = await import('./mocks/browser');
  mockPage = await startMocks();
}

createRoot(document.getElementById('root')!).render(<StrictMode>{mockPage ?? <App />}</StrictMode>);
