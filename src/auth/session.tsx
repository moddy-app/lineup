/**
 * PLACEHOLDER for phase 2 (session, API client, login). Phase 2 replaces the
 * body of this file and keeps its exports: `SessionProvider`, `useSession`
 * and the `Session` shape, which the app shell already consumes.
 *
 * What exists now: everyone is anonymous, `login` sends to the real Lineup
 * login (LINEUP.md §2), `logout` does nothing yet. For looking at the signed-in
 * shell during development, `localStorage['lineup-dev-session']` can be set to
 * `user` or `staff` (development builds only).
 */

import {createContext, type ReactNode, use, useCallback, useMemo} from 'react';

import {config} from '@/config';
import {getString, removeItem} from '@/lib/storage';

/** `GET /lineup/me` → `user` (LINEUP.md §6.1). No e-mail, ever. */
export interface SessionUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
  is_staff: boolean;
}

export interface SessionMe {
  user: SessionUser;
  /** False: the session comes from the dashboard; automatic verification needs a Lineup login. */
  has_lineup_scopes: boolean;
}

export interface Session {
  status: 'loading' | 'anonymous' | 'authenticated';
  me?: SessionMe;
  /** Sends the browser to Discord through the API; comes back to `redirect`. */
  login: (redirect?: string) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

function developmentSession(): SessionMe | undefined {
  if (!import.meta.env.DEV) return undefined;
  const kind = getString('lineup-dev-session');
  if (kind !== 'user' && kind !== 'staff') return undefined;
  return {
    user: {
      id: '345678901234567890',
      username: 'alex',
      global_name: 'Alex',
      avatar_url: null,
      is_staff: kind === 'staff',
    },
    has_lineup_scopes: true,
  };
}

export function SessionProvider({children}: {children: ReactNode}) {
  const login = useCallback((redirect: string = window.location.href) => {
    window.location.assign(`${config.apiBase}/lineup/auth/login?redirect=${encodeURIComponent(redirect)}`);
  }, []);

  const logout = useCallback(async () => {
    // Phase 2: POST /auth/logout, then clear the cached session.
    if (developmentSession()) {
      removeItem('lineup-dev-session');
      window.location.reload();
    }
  }, []);

  const value = useMemo<Session>(() => {
    const me = developmentSession();
    return me ? {status: 'authenticated', me, login, logout} : {status: 'anonymous', login, logout};
  }, [login, logout]);

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession needs a <SessionProvider>.');
  return session;
}
