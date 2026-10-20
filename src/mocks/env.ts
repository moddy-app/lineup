/**
 * What the logic functions run against: the database, the clock and the dev
 * toggles. Nothing here touches the browser, so the logic is unit-testable.
 */

import type {Snowflake} from '@/api/types';

import type {DbData, DbUser} from './model';
import {RateLimiter} from './logic/rateLimiter';

/** The dev panel's choice for the automatic verification of an experience (LINEUP.md §7). */
export type VerifyOutcome = 'auto' | 'success' | 'not_member' | 'no_staff_permission';

/** State that lives only as long as the page (Redis in the real backend): counters and the feed cache. */
export interface Runtime {
  limiter: RateLimiter;
  feedCache: Map<string, {at: number; body: unknown}>;
}

export interface Db extends DbData {
  rt: Runtime;
}

export const newRuntime = (): Runtime => ({limiter: new RateLimiter(), feedCache: new Map()});

export interface Env {
  db: Db;
  now: Date;
  /** The dev panel's "Discord unavailable": every route that calls Discord answers 503. */
  discordDown: boolean;
  verifyOutcome: VerifyOutcome;
}

/** The person making a request on a session route (`current_user`). */
export interface Actor {
  id: Snowflake;
  user: DbUser;
  is_staff: boolean;
  /** False: the session comes from the dashboard (LINEUP.md §2). */
  has_lineup_scopes: boolean;
}

/** Who is looking at an optional-auth route: a person, maybe suspended (they can read, not write). */
export interface Viewer extends Actor {
  suspended: boolean;
}

export const persisted = (db: Db): DbData => {
  const {rt: _rt, ...data} = db;
  return data;
};
