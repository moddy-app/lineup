/**
 * `?auth_error=` (LINEUP.md §2). When someone clicks "Cancel" on Discord, the
 * API brings them back to the page they came from with `?auth_error=access_denied`
 * (a Discord code, 64 characters at most) and the other parameters unchanged.
 * It is read once at start-up, before the router exists, and removed from the
 * address bar with `history.replaceState`, keeping every other parameter.
 */

/** The query string without `auth_error`, and its value (null when absent). */
export function stripAuthError(search: string): {code: string | null; search: string} {
  const params = new URLSearchParams(search);
  if (!params.has('auth_error')) return {code: null, search};
  const code = params.get('auth_error') ?? '';
  params.delete('auth_error');
  const rest = params.toString();
  // An empty value still means a refused sign-in: it is reported as the generic failure.
  return {code: code.slice(0, 64) || 'unknown', search: rest ? `?${rest}` : ''};
}

let pending: string | null = null;

/** Reads `auth_error` from the address, removes it, and remembers it for `takeAuthError`. */
export function consumeAuthError(): void {
  const {pathname, search, hash} = window.location;
  const stripped = stripAuthError(search);
  if (stripped.code === null) return;
  pending = stripped.code;
  window.history.replaceState(window.history.state, '', `${pathname}${stripped.search}${hash}`);
}

/** The code found at start-up, once: the first caller gets it, later ones get null. */
export function takeAuthError(): string | null {
  const code = pending;
  pending = null;
  return code;
}
