import {describe, expect, it} from 'vitest';

import {experienceId, G, postId, reportId, U} from '../seed/ids';
import {createTestApi} from '../testing';
import {routes} from './routes';

/**
 * LINEUP.md section 6, route by route: method, path and who may call it. 41 routes, of which
 * `GET /lineup/auth/login` is a browser navigation (never a request), plus the dashboard's `POST /auth/logout`.
 */
const DOC: ReadonlyArray<readonly [method: string, path: string, auth: 'public' | 'optional' | 'session' | 'staff' | 'any_session']> = [
  ['GET', '/lineup/me', 'session'],
  ['GET', '/lineup/me/guilds', 'session'],
  ['POST', '/lineup/me/refresh-guilds', 'session'],
  ['GET', '/lineup/catalog', 'public'],
  ['GET', '/lineup/guilds', 'public'],
  ['POST', '/lineup/guilds/claim', 'session'],
  ['GET', '/lineup/guilds/{guild_id}', 'optional'],
  ['PUT', '/lineup/guilds/{guild_id}', 'session'],
  ['DELETE', '/lineup/guilds/{guild_id}', 'session'],
  ['POST', '/lineup/guilds/{guild_id}/refresh', 'session'],
  ['GET', '/lineup/users/{user_id}', 'optional'],
  ['GET', '/lineup/me/profile', 'session'],
  ['PUT', '/lineup/me/profile', 'session'],
  ['GET', '/lineup/posts', 'public'],
  ['GET', '/lineup/me/posts', 'session'],
  ['GET', '/lineup/posts/{post_id}', 'optional'],
  ['POST', '/lineup/posts', 'session'],
  ['PATCH', '/lineup/posts/{post_id}', 'session'],
  ['POST', '/lineup/posts/{post_id}/publish', 'session'],
  ['POST', '/lineup/posts/{post_id}/close', 'session'],
  ['DELETE', '/lineup/posts/{post_id}', 'session'],
  ['POST', '/lineup/reports', 'session'],
  ['GET', '/lineup/me/experiences', 'session'],
  ['POST', '/lineup/me/experiences', 'session'],
  ['PATCH', '/lineup/me/experiences/{exp_id}', 'session'],
  ['PUT', '/lineup/me/experiences/order', 'session'],
  ['DELETE', '/lineup/me/experiences/{exp_id}', 'session'],
  ['POST', '/lineup/me/experiences/{exp_id}/verify', 'session'],
  ['POST', '/lineup/me/experiences/{exp_id}/request-review', 'session'],
  ['GET', '/lineup/staff/experiences', 'staff'],
  ['POST', '/lineup/staff/experiences/{exp_id}/verify', 'staff'],
  ['POST', '/lineup/staff/experiences/{exp_id}/reject', 'staff'],
  ['GET', '/lineup/staff/badges', 'staff'],
  ['PUT', '/lineup/staff/badges/{entity_type}/{entity_id}/{badge}', 'staff'],
  ['DELETE', '/lineup/staff/badges/{entity_type}/{entity_id}/{badge}', 'staff'],
  ['POST', '/lineup/staff/posts/{post_id}/hide', 'staff'],
  ['POST', '/lineup/staff/posts/{post_id}/unhide', 'staff'],
  ['GET', '/lineup/staff/reports', 'staff'],
  ['POST', '/lineup/staff/reports/{report_id}/resolve', 'staff'],
  ['POST', '/lineup/staff/reports/{report_id}/dismiss', 'staff'],
  ['POST', '/auth/logout', 'any_session'],
];

const VALUES: Record<string, string> = {
  guild_id: G.cubelands,
  user_id: U.alex,
  post_id: postId(1),
  exp_id: experienceId(1),
  report_id: reportId(1),
  entity_type: 'user',
  entity_id: U.alex,
  badge: 'lineup_verified',
};

const concrete = (path: string) => path.replace(/\{(\w+)\}/g, (_match, name: string) => VALUES[name] ?? '1');
const normalized = (path: string) => path.replace(/\{\w+\}|:\w+/g, ':p');

describe('the table of routes', () => {
  it('serves the 40 routes of LINEUP.md section 6 that are requests, plus the dashboard logout', () => {
    expect(DOC).toHaveLength(41);
    expect(DOC.some(([, path]) => path === '/lineup/auth/login')).toBe(false);
    const served = routes.map((route) => `${route.method} ${normalized(route.path)} ${route.auth}`).sort();
    const documented = DOC.map(([method, path, auth]) => `${method} ${normalized(path)} ${auth}`).sort();
    expect(served).toEqual(documented);
  });

  it('answers every route, on its own method, with the right gate for anonymous visitors', async () => {
    const api = createTestApi();
    for (const [method, path, auth] of DOC) {
      const response = await api.call(method, concrete(path), {body: method === 'GET' ? undefined : {}});
      const label = `${method} ${path}`;
      // Never the "unknown route" of the router.
      expect(response.json, label).not.toEqual({detail: 'Not Found'});
      expect(response.json, label).not.toEqual({detail: 'Method Not Allowed'});
      if (auth === 'session' || auth === 'staff' || auth === 'any_session') {
        expect([response.status, response.json], label).toEqual([401, {error: 'Non authentifie'}]);
      } else {
        expect(response.status, label).not.toBe(401);
      }
    }
  });

  it('gives a signed-in non-staff person `403 {"error": "Staff only"}` on every staff route, and only there', async () => {
    const api = createTestApi('camille');
    for (const [method, path, auth] of DOC) {
      const response = await api.call(method, concrete(path), {body: method === 'GET' ? undefined : {}});
      if (auth === 'staff') {
        expect([response.status, response.json], `${method} ${path}`).toEqual([403, {error: 'Staff only'}]);
      } else {
        expect(response.json, `${method} ${path}`).not.toEqual({error: 'Staff only'});
      }
    }
  });

  it('answers the sanction (shape 2) on every session and staff route for a suspended account, and nothing on the others', async () => {
    const api = createTestApi('dylan');
    for (const [method, path, auth] of DOC) {
      const response = await api.call(method, concrete(path), {body: method === 'GET' ? undefined : {}});
      const label = `${method} ${path}`;
      if (auth === 'session' || auth === 'staff') {
        expect(response.status, label).toBe(403);
        expect(response.json.error.code, label).toBe('user_suspended');
        expect(response.json, label).not.toHaveProperty('code');
      } else {
        expect(response.json?.error?.code, label).not.toBe('user_suspended');
      }
    }
  });

  it('does not answer the 401 of a missing session to a public route, and 404s what is not a route', async () => {
    const api = createTestApi();
    expect((await api.call('GET', '/lineup/auth/login')).json).toEqual({detail: 'Not Found'});
    expect((await api.call('GET', '/lineup')).json).toEqual({detail: 'Not Found'});
    expect((await api.call('GET', '/lineup/posts/')).status).toBe(404);
    expect((await api.call('PATCH', '/lineup/guilds/claim')).status).toBe(405);
    expect((await api.call('GET', '/lineup/me/experiences/order')).status).toBe(405);
  });
});
