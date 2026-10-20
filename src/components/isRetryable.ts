import {isApiError} from '@/api/client';

/** Whether trying again can help: a lost connection, a server fault, a wait. A 4xx will answer the same. */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}
