/**
 * The session, as the `['me']` query holds it. `GET /lineup/me` answers three
 * ways and all three are data, not errors, so they live in the cache:
 *
 *   200                     → authenticated, with the `Me` object
 *   401                     → anonymous
 *   403 user_suspended      → suspended, with the sanction to show
 *
 * Any other failure (network, 5xx) is a query error: the session is unknown,
 * public pages still work, and the person is treated as anonymous.
 *
 * Because the snapshot is cache data, any other part of the app can change it
 * with `setQueryData`: a 401 on a protected request makes it anonymous, a
 * `user_suspended` on any request makes it suspended (routeApiError).
 */

import type {QueryClient} from '@tanstack/react-query';

import {hasCode, isApiError} from './client';
import {getMe} from './endpoints/auth';
import {queryKeys} from './queryKeys';
import type {Me, SanctionInfo} from './types';

export type SessionSnapshot =
  {status: 'authenticated'; me: Me} | {status: 'anonymous'} | {status: 'suspended'; sanction: SanctionInfo};

export const ANONYMOUS: SessionSnapshot = {status: 'anonymous'};

/** The `queryFn` of `['me']`. */
export async function fetchSession(signal?: AbortSignal): Promise<SessionSnapshot> {
  try {
    return {status: 'authenticated', me: await getMe({signal})};
  } catch (error) {
    if (hasCode(error, 'unauthenticated')) return ANONYMOUS;
    if (isApiError(error) && error.code === 'user_suspended' && error.sanction) {
      return {status: 'suspended', sanction: error.sanction};
    }
    throw error;
  }
}

/** The id of the signed-in person, from the cache; undefined when not signed in (or not known yet). */
export function cachedMyId(queryClient: QueryClient): string | undefined {
  const snapshot = queryClient.getQueryData<SessionSnapshot>(queryKeys.me());
  return snapshot?.status === 'authenticated' ? snapshot.me.user.id : undefined;
}

/**
 * What a failed request means for the session, whoever made it. Called for
 * every failed query and mutation (queryClient.ts):
 *
 *  - `user_suspended` on ANY route: the account is suspended. Writes stop and
 *    the suspension notice shows, wherever the person is.
 *  - `unauthenticated` on a request that needs a session: the session is gone
 *    (expired, signed out in another tab). It becomes anonymous. There is NO
 *    redirect here: a background query must not yank the person away. Only an
 *    action they take sends them to sign in (useAuthAction).
 *  - `lineup_guild_forbidden`: the person's rights over a server changed. Their
 *    list of servers and the server profiles (`can_manage`) are read again
 *    (LINEUP.md §13: "recharger /lineup/me/guilds").
 */
export function routeApiError(queryClient: QueryClient, error: unknown, requiresAuth: boolean): void {
  if (!isApiError(error)) return;

  if (error.code === 'user_suspended' && error.sanction) {
    const suspended: SessionSnapshot = {status: 'suspended', sanction: error.sanction};
    queryClient.setQueryData(queryKeys.me(), suspended);
    return;
  }

  if (error.code === 'lineup_guild_forbidden') {
    void queryClient.invalidateQueries({queryKey: queryKeys.myGuilds()});
    void queryClient.invalidateQueries({queryKey: queryKeys.guildDetails()});
    return;
  }

  if (error.code === 'unauthenticated' && requiresAuth) {
    const current = queryClient.getQueryData<SessionSnapshot>(queryKeys.me());
    if (current?.status === 'authenticated') queryClient.setQueryData(queryKeys.me(), ANONYMOUS);
  }
}
