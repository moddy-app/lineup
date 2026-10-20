import {describe, expect, it} from 'vitest';

import {experienceId as x, G, postId, U} from '../seed/ids';
import {createTestApi} from '../testing';
import {RateLimiter} from './rateLimiter';

describe('the limiter itself', () => {
  it('counts each key on its own', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 3; i += 1) limiter.hit('a', 3, 1000, 0);
    expect(limiter.hit('a', 3, 1000, 0).allowed).toBe(false);
    expect(limiter.hit('b', 3, 1000, 0).allowed).toBe(true);
  });

  it('does not stretch the window with refused attempts', () => {
    const limiter = new RateLimiter();
    limiter.hit('a', 1, 10_000, 0);
    expect(limiter.hit('a', 1, 10_000, 4_000)).toMatchObject({allowed: false, retryAfter: 6});
    expect(limiter.hit('a', 1, 10_000, 9_000)).toMatchObject({allowed: false, retryAfter: 1});
    expect(limiter.hit('a', 1, 10_000, 10_000).allowed).toBe(true);
  });

  it('always answers a delay of at least one whole second', () => {
    const limiter = new RateLimiter();
    limiter.hit('a', 1, 1_000, 0);
    expect(limiter.hit('a', 1, 1_000, 999).retryAfter).toBe(1);
    expect(limiter.hit('a', 1, 1_000, 200).retryAfter).toBe(1);
    expect(Number.isInteger(limiter.hit('a', 1, 1_500, 100).retryAfter)).toBe(true);
  });

  it('reports the remaining ttl, 0 when there is no live window, and forgets everything on reset', () => {
    const limiter = new RateLimiter();
    expect(limiter.ttl('a', 0)).toBe(0);
    limiter.hit('a', 1, 60_000, 0);
    expect(limiter.ttl('a', 30_000)).toBe(30);
    expect(limiter.ttl('a', 60_000)).toBe(0);
    limiter.reset();
    expect(limiter.hit('a', 1, 60_000, 1).allowed).toBe(true);
  });
});

describe('the limits of the API (LINEUP.md section 0)', () => {
  const reportOn = (api: ReturnType<typeof createTestApi>, n: number) =>
    api.call('POST', '/lineup/reports', {body: {target_type: 'post', target_id: postId(n), reason: 'spam'}});

  it('keeps the reports quota per person, not per target nor for everybody', async () => {
    const camille = createTestApi('camille');
    const foreign = [1, 2, 3, 4, 5, 6, 7, 19, 20, 21, 22, 23];
    for (const n of foreign.slice(0, 10)) expect((await reportOn(camille, n)).status).toBe(201);
    const refused = await reportOn(camille, foreign[10] ?? 0);
    expect([refused.status, refused.json.retry_after, refused.headers.get('Retry-After')]).toEqual([429, 3600, '3600']);
    // Somebody else has their own counter (same server, same limiter state).
    camille.as('noe');
    expect((await reportOn(camille, 8)).status).toBe(201);
    camille.as('camille');
    // Time passes inside the window: the delay shrinks.
    camille.state.now = new Date(camille.state.now.getTime() + 600_000);
    const later = await reportOn(camille, foreign[10] ?? 0);
    expect([later.status, later.json.retry_after]).toEqual([429, 3000]);
  });

  it('does not charge a refused or invalid report to the quota', async () => {
    const api = createTestApi('camille');
    for (let i = 0; i < 15; i += 1) {
      expect(
        (await api.call('POST', '/lineup/reports', {body: {target_type: 'post', target_id: 'nope', reason: 'spam'}}))
          .status,
      ).toBe(422);
      expect((await reportOn(api, 8)).json.code).toBe('lineup_report_self');
    }
    expect((await reportOn(api, 1)).status).toBe(201);
  });

  it('allows 5 verifications per 10 minutes and person, and starts again after the window', async () => {
    const api = createTestApi('camille');
    api.state.verifyOutcome = 'not_member';
    const attempt = () => api.call('POST', `/lineup/me/experiences/${x(3)}/verify`);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await attempt()).status);
    expect(statuses).toEqual([422, 422, 422, 422, 422, 429]);
    const refused = await attempt();
    expect([refused.json.retry_after, refused.headers.get('Retry-After')]).toEqual([600, '600']);
    api.state.now = new Date(api.state.now.getTime() + 601_000);
    expect((await attempt()).status).toBe(422);
  });

  it('counts only the attempts that reach the check: not a service, an ended experience, nor a dashboard session', async () => {
    const api = createTestApi();
    api.as('camille', {scopes: false});
    for (let i = 0; i < 8; i += 1) {
      expect((await api.call('POST', `/lineup/me/experiences/${x(3)}/verify`)).json.code).toBe(
        'lineup_reauth_required',
      );
    }
    api.as('camille');
    api.state.verifyOutcome = 'not_member';
    expect((await api.call('POST', `/lineup/me/experiences/${x(3)}/verify`)).status).toBe(422);
  });

  it('allows one refresh per minute and per server, whoever asks, checking the rights first', async () => {
    const api = createTestApi('camille');
    expect((await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`)).status).toBe(200);
    // Another server has its own counter.
    expect((await api.call('POST', `/lineup/guilds/${G.pixel}/refresh`)).status).toBe(200);
    const refused = await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`);
    expect(refused.status).toBe(429);
    expect(refused.json).toMatchObject({code: 'lineup_rate_limited', error: {code: 'lineup_rate_limited'}});
    expect(refused.json.retry_after).toBeGreaterThanOrEqual(1);
    expect(refused.json.retry_after).toBeLessThanOrEqual(60);
    expect(refused.headers.get('Retry-After')).toBe(String(refused.json.retry_after));
    // Somebody who does not manage the server gets the 403, never the 429 (and does not use the counter).
    api.as('ines');
    expect((await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`)).json.code).toBe('lineup_guild_forbidden');
    // After the minute, again.
    api.as('camille');
    api.state.now = new Date(api.state.now.getTime() + 61_000);
    expect((await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`)).status).toBe(200);
  });

  it('lets the staff refresh a server they do not manage, and shares the counter', async () => {
    const api = createTestApi('noe');
    expect((await api.call('POST', `/lineup/guilds/${G.pixel}/refresh`)).status).toBe(200);
    expect((await api.call('POST', `/lineup/guilds/${G.pixel}/refresh`)).status).toBe(429);
    api.as('camille');
    expect((await api.call('POST', `/lineup/guilds/${G.pixel}/refresh`)).status).toBe(429);
  });

  it('keeps the counters in the runtime, not in the persisted database', () => {
    const api = createTestApi('camille');
    expect(Object.keys(api.server.db.rt)).toEqual(['limiter', 'feedCache']);
    expect(U.camille).toBeTruthy();
  });
});
