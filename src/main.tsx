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
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import '@/ui/material';

import {App} from '@/app/App';
import {initI18n} from '@/i18n';
import {getItem, setItem} from '@/lib/storage';

initTheme();
initI18n();

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
