import {useCallback} from 'react';

import {isApiError} from '@/api/client';
import {loginUrl} from '@/api/endpoints';
import {useT} from '@/i18n/useT';
import {browser} from '@/lib/browser';
import {useSnackbar} from '@/ui';

import {runBeforeLogin} from './beforeLogin';

/** How long the explanation stays readable before the browser leaves for Discord. */
export const REAUTH_DELAY_MS = 1600;

/**
 * The sign-in URL after a `403 lineup_reauth_required` (LINEUP.md §2): the
 * session comes from the dashboard and lacks the scope that reads the person's
 * servers. `login_url` is relative to the API; it is followed only if it is a
 * path (loginUrl checks), and the person comes back to `redirect`.
 */
export function reauthUrl(error: unknown, redirect: string): string {
  const path = isApiError(error) && typeof error.context.login_url === 'string' ? error.context.login_url : undefined;
  return loginUrl(redirect, path);
}

/**
 * `reauthenticate(error?)`: says "Allow Lineup to read your servers", then
 * sends the person to the Lineup sign-in and back to this page. Drafts are
 * saved first. Meant for a click on "Verify automatically" or for a
 * `lineup_reauth_required` error; the experiences page uses it.
 */
export function useReauthenticate(): (error?: unknown) => void {
  const {show} = useSnackbar();
  const {t} = useT('errors');
  const message = t('codes.lineup_reauth_required');
  return useCallback(
    (error?: unknown) => {
      runBeforeLogin();
      show({message});
      const url = reauthUrl(error, window.location.href);
      window.setTimeout(() => browser.navigate(url), REAUTH_DELAY_MS);
    },
    [show, message],
  );
}
