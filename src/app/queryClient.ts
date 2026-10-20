import {MutationCache, QueryCache, QueryClient} from '@tanstack/react-query';

import {retryDelay, shouldRetry} from '@/api/retry';
import {routeApiError} from '@/api/sessionSnapshot';

/**
 * The app's one QueryClient.
 *
 *  - Reads are retried only for a network failure and a 503 `discord_unavailable`
 *    (twice, honoring `Retry-After`, 30 s at most); a 4xx never. Writes are never
 *    retried. See src/api/retry.ts.
 *  - Nothing refetches on window focus (the feed has 60 s of server cache and
 *    lists must not jump under the reader) except the session, which asks for it
 *    in `useMe`.
 *  - Every failed query and mutation passes through `routeApiError`: a suspension
 *    anywhere suspends the session, a 401 on a protected request signs it out
 *    (without redirecting: only an action of the person does that).
 */
export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => routeApiError(queryClient, error, query.meta?.requiresAuth === true),
    }),
    mutationCache: new MutationCache({
      // Every write needs a session.
      onError: (error) => routeApiError(queryClient, error, true),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
      },
      mutations: {retry: false},
    },
  });
  return queryClient;
}
