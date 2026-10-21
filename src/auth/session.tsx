/**
 * The session: who is using the site, built on the `['me']` query.
 *
 *   loading        the first answer has not come yet
 *   anonymous      no session (401), or the API could not be asked (`error` is then set)
 *   authenticated  `me` is there
 *   suspended      403 `user_suspended`: no sign-in loop, the sanction is shown (`sanction`)
 *
 * A signed-out visitor reads every public page; only an action sends them to
 * sign in (`login`, `useAuthAction`). A 401 met by a background query never
 * redirects anywhere (see routeApiError).
 */

import {useQueryClient} from '@tanstack/react-query';
import {createContext, type ReactNode, use, useCallback, useEffect, useMemo} from 'react';
import {useNavigate} from 'react-router';

import {hasCode} from '@/api/client';
import {logout as requestLogout, loginUrl} from '@/api/endpoints';
import {errorMessage} from '@/api/errors';
import {useMe} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import {ANONYMOUS} from '@/api/sessionSnapshot';
import type {ApiError} from '@/api/client';
import type {Me, SanctionInfo} from '@/api/types';
import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {browser} from '@/lib/browser';
import {useSnackbar} from '@/ui';

import {takeAuthError} from './authError';
import {runBeforeLogin} from './beforeLogin';
import {deriveSession, type SessionStatus} from './status';

export interface Session {
  status: SessionStatus;
  /** The signed-in person (`GET /lineup/me`). */
  me?: Me;
  /** The sanction behind a `suspended` session, for the screen. */
  sanction?: SanctionInfo;
  /** The session could not be read (network, 5xx). The person is then `anonymous`. */
  error?: ApiError;
  /**
   * False while the account is suspended: every write action (buttons, forms) is
   * disabled app-wide, and the suspension notice says why. True otherwise, even
   * signed out: the action then sends the person to sign in (`useAuthAction`).
   */
  canWrite: boolean;
  /**
   * Sends the browser to Discord through the API and back to `redirect` (the
   * current page by default). Runs the "save my draft" callbacks first
   * (registerBeforeLogin).
   */
  login: (redirect?: string) => void;
  /** Ends the session, forgets the person's data and goes home. */
  logout: () => Promise<void>;
  /**
   * For a protected action: true when the person is signed in. Otherwise
   * starts the sign-in for the current page (unless suspended or still
   * loading) and returns false.
   */
  requireAuth: () => boolean;
  /** Asks the API for the session again (after `error`). */
  refresh: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({children}: {children: ReactNode}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const {t} = useT('common');
  const {t: tErrors} = useT('errors');
  const {data, error, isPending, refetch} = useMe();

  const derived = useMemo(() => deriveSession({data, error, isPending}), [data, error, isPending]);
  const {status} = derived;

  // A refused sign-in brought the person back with `?auth_error=` (read before the router started).
  const showMessage = snackbar.show;
  const cancelled = t('auth.cancelled');
  const failed = t('auth.failed');
  useEffect(() => {
    const code = takeAuthError();
    if (code !== null) showMessage({message: code === 'access_denied' ? cancelled : failed});
  }, [showMessage, cancelled, failed]);

  const login = useCallback((redirect: string = window.location.href) => {
    runBeforeLogin();
    browser.navigate(loginUrl(redirect));
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestLogout();
    } catch (failure) {
      // Already signed out is the goal reached; anything else is shown and nothing is forgotten.
      if (!hasCode(failure, 'unauthenticated')) {
        showMessage({message: errorMessage(failure, tErrors)});
        return;
      }
    }
    // Everything personal goes, and public pages keep no trace of who looked (`can_edit`,
    // `is_self`…). Not `queryClient.clear()`: that detaches the mounted observers. The
    // session query stays, now anonymous, and so does the public catalog.
    const kept = [queryKeys.me(), queryKeys.catalog()].map((key) => key.join('/'));
    queryClient.removeQueries({predicate: (query) => !kept.includes(query.queryKey.join('/'))});
    queryClient.setQueryData(queryKeys.me(), ANONYMOUS);
    void navigate(paths.home());
    showMessage({message: t('auth.loggedOut')});
  }, [queryClient, navigate, showMessage, t, tErrors]);

  const requireAuth = useCallback(() => {
    if (status === 'authenticated') return true;
    if (status === 'anonymous') login();
    return false;
  }, [status, login]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<Session>(
    () => ({...derived, canWrite: status !== 'suspended', login, logout, requireAuth, refresh}),
    [derived, status, login, logout, requireAuth, refresh],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession needs a <SessionProvider>.');
  return session;
}
