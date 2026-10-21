/** A test harness: the mock API without MSW or a browser. Used by the unit tests only. */

import type {VerifyOutcome} from './env';
import {dispatch, type ServerContext, type Session} from './server/dispatch';
import {createSeedDb} from './seed';
import {U} from './seed/ids';

export const NOW = new Date('2026-10-20T14:00:00.000Z');

export interface TestApi {
  server: ServerContext;
  state: {session: Session | null; expired: boolean; discordDown: boolean; verifyOutcome: VerifyOutcome; feedCache: boolean; now: Date};
  call: (
    method: string,
    path: string,
    options?: {body?: unknown; rawBody?: string; query?: Record<string, string | string[]>},
  ) => Promise<TestResponse>;
  as: (who: keyof typeof U | null, options?: {scopes?: boolean}) => void;
}

export interface TestResponse {
  status: number;
  /** The parsed JSON body (undefined for a 204). */
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  headers: Headers;
}

export function createTestApi(initial: keyof typeof U | null = null): TestApi {
  const db = createSeedDb(NOW);
  const state: TestApi['state'] = {
    session: null,
    expired: false,
    discordDown: false,
    verifyOutcome: 'auto',
    feedCache: false,
    now: NOW,
  };
  const server: ServerContext = {
    db,
    now: () => state.now,
    session: () => (state.expired ? null : state.session),
    expired: () => state.expired,
    discordDown: () => state.discordDown,
    verifyOutcome: () => state.verifyOutcome,
    feedCache: () => state.feedCache,
    logout: () => {
      state.session = null;
    },
    persist: () => {},
  };
  const as: TestApi['as'] = (who, options = {}) => {
    state.expired = false;
    state.session = who ? {userId: U[who], hasLineupScopes: options.scopes ?? true} : null;
  };
  as(initial);
  return {
    server,
    state,
    as,
    async call(method, path, options = {}) {
      const url = new URL(`https://api.moddy.app${path}`);
      for (const [name, value] of Object.entries(options.query ?? {})) {
        for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(name, item);
      }
      const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
      const response = await dispatch(
        server,
        new Request(url, {
          method,
          body,
          headers: body === undefined ? undefined : {'Content-Type': 'application/json'},
        }),
      );
      const text = await response.text();
      return {status: response.status, json: text ? JSON.parse(text) : undefined, headers: response.headers};
    },
  };
}
