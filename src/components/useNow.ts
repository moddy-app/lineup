/**
 * "Now", to the minute, shared by every component that shows a relative date
 * or a clock (RelativeTime, ExpiryLabel, TimezoneLabel). One timer for the
 * whole page, running only while something is mounted; a component renders
 * again only when the minute changes.
 */

import {useSyncExternalStore} from 'react';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

const currentMinute = () => Math.floor(Date.now() / 60_000);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Checked every 10 s so the display flips within seconds of the minute, whatever the mount time.
  if (listeners.size === 1) timer = setInterval(() => listeners.forEach((notify) => notify()), 10_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The current time in milliseconds, truncated to the minute; changes once a minute. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, currentMinute, currentMinute) * 60_000;
}
