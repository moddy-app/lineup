import {getString, setString} from '@/lib/storage';

import {FALLBACK_LANGUAGE, type Language, LANGUAGE_STORAGE_KEY, resolveLanguage} from './languages';

/**
 * The language to start in, by priority:
 *   1. ?lang= in the URL (a shared link, a screenshot): kept for next time and
 *      removed from the address bar;
 *   2. the language the person picked earlier (localStorage `lineup-lang`);
 *   3. the browser's languages, in order;
 *   4. English.
 */
export function detectLanguage(): Language {
  const url = new URL(window.location.href);
  const fromQuery = resolveLanguage(url.searchParams.get('lang'));
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', url);
  }
  if (fromQuery) {
    setString(LANGUAGE_STORAGE_KEY, fromQuery);
    return fromQuery;
  }

  const stored = resolveLanguage(getString(LANGUAGE_STORAGE_KEY));
  if (stored) return stored;

  for (const tag of navigator.languages ?? [navigator.language]) {
    const language = resolveLanguage(tag);
    if (language) return language;
  }
  return FALLBACK_LANGUAGE;
}
