import {QueryClient} from '@tanstack/react-query';

/**
 * Shared defaults. Phase 2 refines the retry policy once the API client
 * exists (no retry on a 4xx, `Retry-After` on 429/503).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
