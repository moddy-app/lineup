/**
 * The mock API's router. It speaks `Request` → `Response` and knows nothing of
 * MSW or the browser, so the same code runs behind the service worker and in
 * the unit tests. It does what the real app's middleware does, in order:
 *
 *   1. route (404 `{"detail": "Not Found"}`, 405 `{"detail": "Method Not Allowed"}` + `Allow`,
 *      FastAPI's own shape)
 *   2. authentication, as a dependency would (401 / 403 sanction / 403 Staff only)
 *      BEFORE the request is validated, like FastAPI. A route can ask for its
 *      validation to come first (`validateFirst`: `PUT /lineup/guilds/{id}`).
 *   3. the handler (validation, then business rules)
 *   4. `Cache-Control: no-store` whenever a session cookie is present and the
 *      route set no cache header of its own (§0)
 */

import type {Snowflake} from '@/api/types';

import {ApiFailure, methodNotAllowed, notFoundRoute, sanctionError, staffOnly, unauthenticated} from '../errors';
import type {Actor, Db, Env, VerifyOutcome, Viewer} from '../env';
import {toResponse, type Reply} from './http';
import {routes, type Route} from './routes';

/** A session, as the cookie would identify it. */
export interface Session {
  userId: Snowflake;
  /** False: born from the dashboard (LINEUP.md §2). */
  hasLineupScopes: boolean;
}

export interface ServerContext {
  db: Db;
  now: () => Date;
  /** The current session, or null for an anonymous visitor. */
  session: () => Session | null;
  /** A cookie is still sent but its session is gone: session routes answer `Session expiree`. */
  expired: () => boolean;
  discordDown: () => boolean;
  verifyOutcome: () => VerifyOutcome;
  feedCache: () => boolean;
  /** `POST /auth/logout`. */
  logout: () => void;
  /** Called after every write, to persist the database. */
  persist: () => void;
}

export interface RouteContext {
  env: Env;
  server: ServerContext;
  /** Present on `session` and `staff` routes. */
  actor: Actor | null;
  /** Present on `optional` routes when someone is signed in (maybe suspended). */
  viewer: Viewer | null;
  params: Record<string, string>;
  query: URLSearchParams;
  rawBody: string;
}

type Compiled = {route: Route; regex: RegExp; names: string[]};

const compiled: Compiled[] = routes.map((route) => {
  const names: string[] = [];
  const source = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z_]+)/g, (_match, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return {route, regex: new RegExp(`^${source}$`), names};
});

function match(
  method: string,
  pathname: string,
): {route: Route; params: Record<string, string>} | {allow: string[]} | null {
  const allow = new Set<string>();
  for (const {route, regex, names} of compiled) {
    const found = regex.exec(pathname);
    if (!found) continue;
    allow.add(route.method);
    if (route.method !== method) continue;
    const params: Record<string, string> = {};
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(found[index + 1] ?? '');
    });
    return {route, params};
  }
  return allow.size > 0 ? {allow: [...allow].sort()} : null;
}

function actorFor(server: ServerContext, db: Db): {actor: Actor; suspended: boolean} | null {
  const session = server.session();
  const user = session ? db.users[session.userId] : undefined;
  if (!session || !user) return null;
  return {
    actor: {id: user.id, user, is_staff: user.is_staff, has_lineup_scopes: session.hasLineupScopes},
    suspended: Boolean(user.sanction),
  };
}

/** Runs one request against the mock API. Never throws: failures become responses. */
export async function dispatch(server: ServerContext, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const found = match(method, url.pathname);
  let reply: Reply;
  let hasSession = false;

  try {
    if (found === null) throw notFoundRoute();
    if ('allow' in found) throw methodNotAllowed(found.allow);
    const {route, params} = found;
    const env: Env = {
      db: server.db,
      now: server.now(),
      discordDown: server.discordDown(),
      verifyOutcome: server.verifyOutcome(),
    };

    const resolved = actorFor(server, server.db);
    hasSession = resolved !== null;
    let actor: Actor | null = null;
    let viewer: Viewer | null = null;
    const rawBody = method === 'GET' || method === 'DELETE' ? '' : await request.text();
    const context: RouteContext = {env, server, actor: null, viewer: null, params, query: url.searchParams, rawBody};
    if (route.validateFirst) route.validateFirst(context);
    if (route.auth === 'any_session') {
      // Signing out: a suspended account may still do it.
      if (!resolved) throw unauthenticated(server.expired());
      actor = resolved.actor;
    } else if (route.auth === 'session' || route.auth === 'staff') {
      if (!resolved) throw unauthenticated(server.expired());
      if (resolved.suspended && resolved.actor.user.sanction) {
        throw sanctionError('user_suspended', resolved.actor.id, resolved.actor.user.sanction);
      }
      if (route.auth === 'staff' && !resolved.actor.is_staff) throw staffOnly();
      actor = resolved.actor;
    } else if (route.auth === 'optional' && resolved) {
      viewer = {...resolved.actor, suspended: resolved.suspended};
    }

    reply = await route.handler({...context, actor, viewer});
    if (method !== 'GET') server.persist();
  } catch (error) {
    if (error instanceof ApiFailure) {
      reply = {status: error.status, body: error.body, headers: error.headers};
    } else {
      console.error('[mock api] unexpected error', error);
      reply = {status: 500, body: {error: 'Internal Server Error'}};
    }
  }

  if (hasSession && !reply.headers?.['Cache-Control']) {
    reply = {...reply, headers: {...reply.headers, 'Cache-Control': 'no-store'}};
  }
  return toResponse(reply);
}
