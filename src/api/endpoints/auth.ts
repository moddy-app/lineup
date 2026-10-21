/**
 * Session routes (LINEUP.md §2, §6.1).
 *
 * `GET /lineup/auth/login` is a browser navigation, not a request: it is a
 * URL builder here. `GET /auth/me` and `POST /auth/logout` are dashboard routes (the cookie is
 * shared), not under /lineup.
 */

import {config} from '@/config';

import {apiFetch} from '../client';
import type {Account, Me} from '../types';
import type {ReadOptions} from './shared';

/** `GET /lineup/me`: the session test. A 401 means signed out. */
export function getMe({signal}: ReadOptions = {}): Promise<Me> {
  return apiFetch<Me>('/lineup/me', {signal});
}

/** `GET /auth/me` (a dashboard route; same cookie): the Discord e-mail, which `/lineup/me` does not send. A 401 means signed out. */
export function getAccount({signal}: ReadOptions = {}): Promise<Account> {
  return apiFetch<Account>('/auth/me', {signal});
}

/** `POST /auth/logout` (a dashboard route; same cookie). 200 with an EMPTY body (not JSON); 401 without a valid session. */
export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', {method: 'POST'});
}

// ---------------------------------------------------------------------------
// The sign-in URL
// ---------------------------------------------------------------------------

export const LOGIN_PATH = '/lineup/auth/login';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

const isModdyHost = (hostname: string) => hostname === 'moddy.app' || hostname.endsWith('.moddy.app');

/**
 * A destination the API will accept (LINEUP.md §2). It takes two forms: an
 * absolute https URL on moddy.app or a subdomain (no credentials, port 443
 * only), or a path starting with a single `/`. Anything else is ignored by the
 * API, which then sends the person to the home page.
 *
 * One case is rewritten: a URL on THIS site's own origin that is not a moddy.app
 * one (a development server on localhost) becomes its path, which the API attaches to
 * https://lineup.moddy.app. Everything unusable falls back to `/`.
 */
export function sanitizeRedirect(input: string, currentOrigin: string = window.location.origin): string {
  const value = input.trim();
  if (!value || CONTROL_CHARACTERS.test(value)) return '/';
  // `//host` and `/\host` are read by browsers as another site.
  if (value.startsWith('/')) return value.startsWith('//') || value.includes('\\') ? '/' : value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return '/';
  }
  // The URL parser drops a default port: an explicit :8443 stays and is refused.
  if (url.protocol === 'https:' && isModdyHost(url.hostname) && !url.username && !url.password && !url.port) {
    return url.href;
  }
  if (url.origin === currentOrigin) return url.pathname + url.search + url.hash;
  return '/';
}

/**
 * Builds the sign-in URL for a destination. `loginPath` is the `login_url` of
 * a `lineup_reauth_required` error (relative to the API); it defaults to the
 * Lineup login.
 */
export type LoginUrlBuilder = (redirect: string, loginPath?: string) => string;

const realLoginUrl: LoginUrlBuilder = (redirect, loginPath = LOGIN_PATH) => {
  // Only a path of the API is followed: a `login_url` is never a way to leave it.
  const path = loginPath.startsWith('/') && !loginPath.startsWith('//') ? loginPath : LOGIN_PATH;
  return `${config.apiBase}${path}?redirect=${encodeURIComponent(sanitizeRedirect(redirect))}`;
};

let builder: LoginUrlBuilder = realLoginUrl;

/**
 * MOCK HOOK (phase 2b). In mock mode the sign-in must not leave the site: the
 * mock calls this once at start-up with a builder that points to its own login
 * screen on the same origin. `null` restores the real one.
 */
export function setLoginUrlBuilder(next: LoginUrlBuilder | null): void {
  builder = next ?? realLoginUrl;
}

/** `GET /lineup/auth/login?redirect=…`, to navigate to (never to fetch). */
export function loginUrl(redirect: string = window.location.href, loginPath?: string): string {
  return builder(redirect, loginPath);
}
