/**
 * When a failed query is tried again (LINEUP.md §0, §12). Reads only: a write
 * is never retried on its own, the person decides.
 *
 *  - A 4xx is never retried: the answer would be the same.
 *  - A 503 `discord_unavailable` and a network failure are, twice, waiting at
 *    least what `Retry-After` asks (30 s for Discord), at most 30 s, and with
 *    an exponential backoff when no delay was given.
 *  - Anything else (a 5xx with no code, a bug) fails at once.
 */

import {isApiError} from './client';

export const MAX_RETRIES = 2;

/** The longest a retry is ever delayed. */
export const MAX_RETRY_DELAY_MS = 30_000;

const BASE_DELAY_MS = 1_000;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (!isApiError(error)) return false;
  return error.kind === 'network' || error.code === 'discord_unavailable';
}

/** `failureCount` is 0 for the first retry. */
export function retryDelay(failureCount: number, error: unknown): number {
  const backoff = BASE_DELAY_MS * 2 ** failureCount;
  const asked = isApiError(error) && error.retryAfter !== null ? error.retryAfter * 1000 : 0;
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(backoff, asked));
}
