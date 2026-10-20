/** The dev panel's toggles, kept in localStorage (`lineup-mock-settings`) so a reload keeps them. */

import {getItem, setItem} from '@/lib/storage';

import type {VerifyOutcome} from './env';

export interface MockSettings {
  /** Base latency of every answer, in ms (±40% jitter). */
  latency: 0 | 300 | 1200;
  /** Every route that calls Discord answers 503 `discord_unavailable`. */
  discordDown: boolean;
  /** The next request fails with a network error, once. */
  failNext: boolean;
  /** What the automatic verification of an experience returns. */
  verifyOutcome: VerifyOutcome;
  /** Emulate the feed's 60-second server cache. */
  feedCache: boolean;
}

const KEY = 'lineup-mock-settings';

export const DEFAULT_SETTINGS: MockSettings = {
  latency: 300,
  discordDown: false,
  failNext: false,
  verifyOutcome: 'auto',
  feedCache: false,
};

const listeners = new Set<() => void>();
let cache: MockSettings | null = null;

export function getSettings(): MockSettings {
  cache ??= {...DEFAULT_SETTINGS, ...getItem<Partial<MockSettings>>(KEY, {})};
  return cache;
}

export function updateSettings(patch: Partial<MockSettings>): MockSettings {
  cache = {...getSettings(), ...patch};
  setItem(KEY, cache);
  for (const listener of listeners) listener();
  return cache;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Consumes the one-shot "next request fails". */
export function takeFailNext(): boolean {
  if (!getSettings().failNext) return false;
  updateSettings({failNext: false});
  return true;
}
