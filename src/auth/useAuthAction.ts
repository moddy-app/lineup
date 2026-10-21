import {useCallback} from 'react';

import {hasCode} from '@/api/client';

import {useSession} from './session';

export interface AuthAction {
  /**
   * Runs a protected action for a person who may not be signed in.
   *
   *  - signed out: starts the sign-in for the current page and does not run it;
   *  - suspended: does nothing (the notice already says why);
   *  - otherwise runs it; if the session turns out to have expired in the
   *    meantime (the API answers 401), starts the sign-in for the current page.
   *    Other errors are re-thrown for the caller.
   *
   * Resolves with the action's result, or `undefined` when it was not run or was
   * interrupted by the sign-in. "Starts the sign-in" saves drafts first
   * (registerBeforeLogin).
   */
  run: <T>(action: () => T | Promise<T>) => Promise<T | undefined>;
  /**
   * For callers that handle errors themselves (a mutation's `onError`): if
   * `error` is a 401, starts the sign-in and returns true.
   */
  handleError: (error: unknown) => boolean;
}

export function useAuthAction(): AuthAction {
  const {status, login} = useSession();

  const handleError = useCallback(
    (error: unknown) => {
      if (!hasCode(error, 'unauthenticated')) return false;
      login(window.location.href);
      return true;
    },
    [login],
  );

  const run = useCallback(
    async <T>(action: () => T | Promise<T>): Promise<T | undefined> => {
      if (status === 'anonymous') {
        login(window.location.href);
        return undefined;
      }
      if (status === 'suspended') return undefined;
      try {
        return await action();
      } catch (error) {
        if (handleError(error)) return undefined;
        throw error;
      }
    },
    [status, login, handleError],
  );

  return {run, handleError};
}
