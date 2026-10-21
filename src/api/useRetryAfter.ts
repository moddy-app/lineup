import {useCallback, useSyncExternalStore} from 'react';

import {isApiError} from './client';

/** Whole seconds left before `error` can be tried again (0 when it carries no delay, or it has passed). */
export function secondsLeft(error: unknown, now: number): number {
  if (!isApiError(error) || error.retryAfter === null) return 0;
  return Math.max(0, Math.ceil((error.receivedAt + error.retryAfter * 1000 - now) / 1000));
}

export interface RetryAfter {
  /** Seconds left; 0 when none (or elapsed). */
  seconds: number;
  /** A wait is running: disable the action. */
  active: boolean;
}

/**
 * The countdown of a 429 `lineup_rate_limited` or a 503 `discord_unavailable`
 * (LINEUP.md §0): disable the action while it runs and show the seconds left.
 * It counts from the moment the error was received, so it stays right when the
 * component mounts later or the tab was in the background, and it ticks once a
 * second only while a wait is running.
 */
export function useRetryAfter(error: unknown): RetryAfter {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (secondsLeft(error, Date.now()) === 0) return () => {};
      const timer = setInterval(() => {
        notify();
        if (secondsLeft(error, Date.now()) === 0) clearInterval(timer);
      }, 1000);
      return () => clearInterval(timer);
    },
    [error],
  );
  const seconds = useSyncExternalStore(
    subscribe,
    () => secondsLeft(error, Date.now()),
    () => 0,
  );
  return {seconds, active: seconds > 0};
}

/** Short countdown for a button: "45 s" up to two minutes, then "12 min". */
export function formatCountdown(seconds: number): string {
  return seconds < 120 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
}
