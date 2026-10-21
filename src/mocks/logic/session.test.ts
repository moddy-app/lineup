import {describe, expect, it} from 'vitest';

import {G, postId, U} from '../seed/ids';
import {createTestApi} from '../testing';

// Posts Camille did not write (she cannot report her own).
const FOREIGN = [1, 2, 3, 4, 5, 6, 7, 19, 20, 21, 22, 23, 24];

describe('errors, byte for byte (§0)', () => {
  it('answers 401 as a plain text for every session route', async () => {
    const api = createTestApi();
    for (const [method, path] of [
      ['GET', '/lineup/me'],
      ['GET', '/lineup/me/guilds'],
      ['POST', '/lineup/me/refresh-guilds'],
      ['GET', '/lineup/me/profile'],
      ['GET', '/lineup/me/posts'],
      ['GET', '/lineup/me/experiences'],
      ['POST', '/lineup/posts'],
      ['POST', '/lineup/reports'],
      ['POST', '/lineup/guilds/claim'],
    ] as const) {
      const response = await api.call(method, path);
      expect([response.status, response.json], `${method} ${path}`).toEqual([401, {error: 'Non authentifie'}]);
    }
  });

  it('answers the sanction of a suspended account on every session route, and not on public reads', async () => {
    const api = createTestApi('dylan');
    const expected = {
      error: {
        code: 'user_suspended',
        level: 'ban',
        subject_type: 'discord_user',
        subject_id: U.dylan,
        references: ['A7F2K9', 'M4Q8T1'],
        expires_at: null,
        message: 'Votre accès à Moddy est suspendu.',
        violations_url: 'https://moddy.app/violations',
      },
    };
    for (const [method, path, body] of [
      ['GET', '/lineup/me', undefined],
      ['GET', '/lineup/me/posts', undefined],
      ['POST', '/lineup/posts', {typo: true}],
      ['PUT', '/lineup/me/profile', {headline: 'x'}],
      ['POST', `/lineup/posts/${postId(1)}/close`, undefined],
    ] as const) {
      const response = await api.call(method, path, {body});
      expect([response.status, response.json], `${method} ${path}`).toEqual([403, expected]);
    }
    expect((await api.call('GET', '/lineup/posts')).status).toBe(200);
    expect((await api.call('GET', `/lineup/guilds/${G.cubelands}`)).status).toBe(200);
    expect((await api.call('GET', '/lineup/catalog')).status).toBe(200);
  });

  it('copies a Lineup error at the root but not a sanction', async () => {
    const api = createTestApi('camille');
    const response = await api.call('GET', '/lineup/posts/e0000000-0000-4000-8000-000000000001');
    expect(response.json).toEqual({
      error: {code: 'lineup_post_not_found', message: 'Annonce introuvable.'},
      code: 'lineup_post_not_found',
      message: 'Annonce introuvable.',
    });
  });

  it("answers Staff only as a plain text, Not Found and Method Not Allowed in FastAPI's `detail` shape", async () => {
    const api = createTestApi('camille');
    for (const path of ['/lineup/staff/experiences', '/lineup/staff/reports', '/lineup/staff/badges']) {
      expect(await api.call('GET', path)).toMatchObject({status: 403, json: {error: 'Staff only'}});
    }
    expect(await api.call('POST', `/lineup/staff/posts/${postId(1)}/hide`, {body: {}})).toMatchObject({
      status: 403,
      json: {error: 'Staff only'},
    });
    // Authentication first, as a dependency: a signed-out visitor gets 401, not 403.
    api.as(null);
    expect(await api.call('GET', '/lineup/staff/reports')).toMatchObject({status: 401});
    expect(await api.call('GET', '/lineup/nope')).toMatchObject({status: 404, json: {detail: 'Not Found'}});
    const wrong = await api.call('DELETE', '/lineup/catalog');
    expect(wrong).toMatchObject({status: 405, json: {detail: 'Method Not Allowed'}});
    expect(wrong.headers.get('Allow')).toBe('GET');
    expect((await api.call('PATCH', '/lineup/guilds/1')).headers.get('Allow')).toBe('DELETE, GET, PUT');
    expect((await api.call('GET', '/auth/logout')).headers.get('Allow')).toBe('POST');
  });

  it('puts the retry delay in the body AND in Retry-After on 429 and 503', async () => {
    const api = createTestApi('camille');
    const statuses: number[] = [];
    let last = await api.call('GET', '/lineup/me');
    for (const n of FOREIGN.slice(0, 12)) {
      last = await api.call('POST', '/lineup/reports', {
        body: {target_type: 'post', target_id: postId(n), reason: 'spam'},
      });
      statuses.push(last.status);
    }
    expect(last.status).toBe(429);
    expect(last.json).toMatchObject({code: 'lineup_rate_limited', retry_after: 3600, error: {retry_after: 3600}});
    expect(last.headers.get('Retry-After')).toBe('3600');
    expect(statuses.filter((status) => status === 201).length).toBeGreaterThan(0);
  });

  it('sets no-store when a session is present and leaves the route’s own cache header alone', async () => {
    const api = createTestApi('camille');
    expect((await api.call('GET', '/lineup/me')).headers.get('Cache-Control')).toBe('no-store');
    expect((await api.call('GET', '/lineup/catalog')).headers.get('Cache-Control')).toBe('public, max-age=3600');
    api.as(null);
    expect((await api.call('GET', '/lineup/posts/' + postId(1))).headers.get('Cache-Control')).toBeNull();
  });
});

describe('the session', () => {
  it('describes the person, with a test e-mail, never a token', async () => {
    const api = createTestApi('camille');
    const response = await api.call('GET', '/lineup/me');
    expect(response.json).toMatchObject({
      user: {
        id: U.camille,
        username: 'camille.renard',
        global_name: 'Camille',
        is_staff: false,
        banner_url: null,
        avatar_decoration_data: null,
        email: 'camille.renard@example.com',
      },
      has_lineup_scopes: true,
      login_url: '/lineup/auth/login',
      profile: {
        user_id: U.camille,
        headline: expect.any(String),
        languages: ['fr', 'en'],
        open_to_work: true,
        discord_snapshot: {id: U.camille, username: 'camille.renard', public_flags: 256},
      },
    });
    expect(JSON.stringify(response.json)).not.toMatch(/token/i);
  });

  it('tells the dashboard session apart, the staff, and the newcomer with no profile', async () => {
    const api = createTestApi();
    api.as('camille', {scopes: false});
    expect((await api.call('GET', '/lineup/me')).json.has_lineup_scopes).toBe(false);
    api.as('noe');
    expect((await api.call('GET', '/lineup/me')).json.user.is_staff).toBe(true);
    api.as('ines');
    expect((await api.call('GET', '/lineup/me')).json.profile).toBeNull();
    api.as('alex');
    expect((await api.call('GET', '/lineup/me')).json.user.avatar_decoration_data).toMatchObject({
      asset: 'a_7f3b2c91e0d44f6a8b1c',
    });
  });

  it('signs out with 200 and an empty body', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', '/auth/logout');
    expect(response.status).toBe(200);
    expect(response.json).toBeUndefined();
    expect(response.headers.get('Content-Type')).toBeNull();
    expect(api.state.session).toBeNull();
    expect((await api.call('GET', '/lineup/me')).status).toBe(401);
  });

  it('lets a suspended account sign out, and refuses logout without a valid session', async () => {
    const api = createTestApi('dylan');
    expect((await api.call('GET', '/lineup/me')).status).toBe(403);
    expect((await api.call('POST', '/auth/logout')).status).toBe(200);
    expect(api.state.session).toBeNull();
    expect(await api.call('POST', '/auth/logout')).toMatchObject({status: 401, json: {error: 'Non authentifie'}});
    api.state.expired = true;
    expect(await api.call('POST', '/auth/logout')).toMatchObject({status: 401, json: {error: 'Session expiree'}});
  });

  it('answers Session expiree when the cookie is still sent but the session is gone, until signing in again', async () => {
    const api = createTestApi('camille');
    api.state.expired = true;
    expect(await api.call('GET', '/lineup/me')).toMatchObject({status: 401, json: {error: 'Session expiree'}});
    expect(await api.call('GET', `/lineup/staff/reports`)).toMatchObject({
      status: 401,
      json: {error: 'Session expiree'},
    });
    // Public and optional routes keep working as anonymous, with no no-store.
    const feed = await api.call('GET', '/lineup/posts');
    expect(feed.status).toBe(200);
    expect(feed.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect((await api.call('GET', `/lineup/guilds/${G.atelier}`)).status).toBe(200);
    api.as('camille');
    expect((await api.call('GET', '/lineup/me')).status).toBe(200);
  });

  it('keeps its own Cache-Control on the successes of the cached routes, and no-store on their errors with a session', async () => {
    const api = createTestApi('camille');
    expect((await api.call('GET', '/lineup/catalog')).headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect((await api.call('GET', '/lineup/guilds')).headers.get('Cache-Control')).toBe('public, max-age=60');
    for (const path of ['/lineup/posts', '/lineup/guilds']) {
      const bad = await api.call('GET', path, {query: {limit: '0'}});
      expect(bad.status, path).toBe(422);
      expect(bad.headers.get('Cache-Control'), path).toBe('no-store');
    }
    api.as(null);
    const anonymous = await api.call('GET', '/lineup/posts', {query: {limit: '0'}});
    expect(anonymous.status).toBe(422);
    expect(anonymous.headers.get('Cache-Control')).toBeNull();
  });
});

describe('profiles', () => {
  it('shows a third party the public view: no rejected, pending as unverified, no proof', async () => {
    const api = createTestApi();
    const response = await api.call('GET', `/lineup/users/${U.jonas}`);
    const experiences = response.json.experiences as Array<
      Record<string, unknown> & {verification: Record<string, unknown>}
    >;
    expect(experiences).toHaveLength(1);
    expect(experiences[0]?.verification).toEqual({status: 'unverified', method: null, verified_at: null});
    expect(experiences[0]).not.toHaveProperty('created_at');
    expect(response.json).toMatchObject({is_self: false, stale: false});
    const camille = await api.call('GET', `/lineup/users/${U.camille}`);
    expect(JSON.stringify(camille.json.experiences)).not.toMatch(/evidence|rejection_reason|review_note/);
    expect(
      camille.json.experiences.map((experience: {verification: {status: string}}) => experience.verification.status),
    ).not.toContain('rejected');
    expect(
      camille.json.experiences.map((experience: {verification: {status: string}}) => experience.verification.status),
    ).not.toContain('pending');
  });

  it('shows oneself and the staff everything, in the private view', async () => {
    for (const who of ['camille', 'noe'] as const) {
      const api = createTestApi(who);
      const response = await api.call('GET', `/lineup/users/${U.camille}`);
      expect(response.json.is_self).toBe(who === 'camille');
      const statuses = response.json.experiences.map(
        (experience: {verification: {status: string}}) => experience.verification.status,
      );
      expect(new Set(statuses)).toEqual(new Set(['verified', 'unverified', 'pending', 'rejected']));
      expect(response.json.experiences[0].verification.evidence).not.toBeUndefined();
      expect(response.json.experiences[0].created_at).toBeTypeOf('string');
    }
    const mine = await createTestApi('camille').call('GET', '/lineup/me/profile');
    expect(mine.json.is_self).toBe(true);
  });

  it('lists the person’s live user posts (20 at most), not server posts', async () => {
    const api = createTestApi();
    const response = await api.call('GET', `/lineup/users/${U.camille}`);
    expect(response.json.posts.map((post: {id: string}) => post.id)).toEqual([postId(31), postId(32)]);
  });

  it('computes badges in catalog order, with Discord’s public flags', async () => {
    const api = createTestApi();
    const ids = async (user: string) =>
      ((await api.call('GET', `/lineup/users/${user}`)).json.badges as Array<{id: string; source: string}>).map(
        (badge) => `${badge.id}:${badge.source}`,
      );
    expect(await ids(U.alex)).toEqual([
      'moddy_premium:computed',
      'discord_hypesquad_house_bravery:discord',
      'discord_active_developer:discord',
      'lineup_verified:manual',
    ]);
    expect(await ids(U.noe)).toEqual([
      'moddy_premium:computed',
      'moddy_staff:computed',
      'discord_bug_hunter_level_1:discord',
      'discord_active_developer:discord',
    ]);
    expect(await ids(U.theo)).toEqual([]);
    expect(await ids(U.amira)).toContain('discord_certified_moderator:discord');
  });

  it('builds a page from Discord alone for someone with no Lineup profile', async () => {
    const api = createTestApi();
    const response = await api.call('GET', `/lineup/users/${U.theo}`);
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      username: 'theogarnier',
      headline: null,
      bio: null,
      links: [],
      languages: [],
      open_to_work: false,
      avatar_url: null,
    });
  });

  it('flags a stale snapshot, 404s the unknown and the suspended (except for themselves and the staff)', async () => {
    const api = createTestApi();
    expect((await api.call('GET', `/lineup/users/${U.marta}`)).json.stale).toBe(true);
    expect((await api.call('GET', '/lineup/users/1234567890')).json.code).toBe('lineup_user_not_found');
    expect((await api.call('GET', `/lineup/users/${U.dylan}`)).json.code).toBe('lineup_user_not_found');
    api.as('noe');
    expect((await api.call('GET', `/lineup/users/${U.dylan}`)).status).toBe(200);
    api.as('dylan');
    expect((await api.call('GET', `/lineup/users/${U.dylan}`)).json.is_self).toBe(true);
    expect((await api.call('GET', `/lineup/users/${U.camille}`)).json.is_self).toBe(false);
  });

  it('updates the profile partially and creates it on the first edit', async () => {
    const api = createTestApi('ines');
    const response = await api.call('PUT', '/lineup/me/profile', {
      body: {headline: '  Autrice et correctrice ', languages: ['fr', 'fr'], timezone: 'UTC+02:00', open_to_work: true},
    });
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      headline: 'Autrice et correctrice',
      languages: ['fr'],
      timezone: 'UTC+02:00',
      open_to_work: true,
      is_self: true,
      bio: null,
    });
    expect((await api.call('GET', '/lineup/me')).json.profile).toMatchObject({
      user_id: U.ines,
      headline: 'Autrice et correctrice',
    });
    expect((await api.call('PUT', '/lineup/me/profile', {body: {headline: null}})).json.headline).toBeNull();
  });

  it('refuses what §6.3 refuses', async () => {
    const api = createTestApi('camille');
    const types = async (body: unknown) => (await api.call('PUT', '/lineup/me/profile', {body})).json.detail?.[0]?.type;
    expect(await types({open_to_work: null})).toBe('bool_type');
    expect(await types({links: null})).toBe('list_type');
    expect(await types({languages: ['klingon']})).toBe('value_error');
    expect(await types({timezone: 'Mars/Olympus'})).toBe('value_error');
    expect(await types({headline: 'x'.repeat(121)})).toBe('string_too_long');
    expect(await types({bio: 'x'.repeat(2001)})).toBe('string_too_long');
    expect(await types({nickname: 'x'})).toBe('extra_forbidden');
  });
});

describe('reports', () => {
  const report = (
    api: ReturnType<typeof createTestApi>,
    target_type: string,
    target_id: string,
    reason = 'scam',
    details?: string,
  ) => api.call('POST', '/lineup/reports', {body: {target_type, target_id, reason, details}});

  it('creates with 201, and answers 200 created:false for a duplicate, without using the quota', async () => {
    const api = createTestApi('camille');
    const first = await report(api, 'post', postId(25));
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({status: 'open', created: true});
    for (let i = 0; i < 15; i += 1) {
      const again = await report(api, 'post', postId(25));
      expect([again.status, again.json.created, again.json.id]).toEqual([200, false, first.json.id]);
    }
    expect((await report(api, 'post', postId(1))).status).toBe(201);
  });

  it('allows 10 reports an hour, then 429', async () => {
    const api = createTestApi('camille');
    for (const n of FOREIGN.slice(0, 10))
      expect((await report(api, 'post', postId(n))).status, `report ${n}`).toBe(201);
    const eleventh = await report(api, 'post', postId(FOREIGN[10] ?? 0));
    expect([eleventh.status, eleventh.json.code]).toEqual([429, 'lineup_rate_limited']);
    api.state.now = new Date(api.state.now.getTime() + 3601_000);
    expect((await report(api, 'post', postId(FOREIGN[10] ?? 0))).status).toBe(201);
  });

  it('refuses one’s own content, unknown targets and malformed bodies', async () => {
    const api = createTestApi('camille');
    expect((await report(api, 'post', postId(8))).json.code).toBe('lineup_report_self');
    expect((await report(api, 'user', U.camille)).json.code).toBe('lineup_report_self');
    expect((await report(api, 'guild', G.atelier)).json.code).toBe('lineup_report_self');
    expect((await report(api, 'post', 'a0000000-0000-4000-8000-0000000000ff')).json.code).toBe(
      'lineup_report_target_not_found',
    );
    expect((await report(api, 'user', '123')).json.code).toBe('lineup_report_target_not_found');
    expect((await report(api, 'guild', G.cafe)).json.code).toBe('lineup_report_target_not_found');
    expect((await report(api, 'post', 'nope')).json.detail[0].loc).toEqual(['body', 'target_id']);
    expect((await report(api, 'post', postId(1), 'hate')).json.detail[0].type).toBe('literal_error');
    expect((await report(api, 'post', postId(1), 'spam', 'x'.repeat(1001))).json.detail[0].type).toBe(
      'string_too_long',
    );
  });

  it('allows a new report once the previous one was handled', async () => {
    const api = createTestApi('camille');
    const first = await report(api, 'post', postId(25));
    api.as('noe');
    expect((await api.call('POST', `/lineup/staff/reports/${first.json.id}/dismiss`)).json).toMatchObject({
      status: 'dismissed',
      handled_by: U.noe,
    });
    api.as('camille');
    const second = await report(api, 'post', postId(25));
    expect([second.status, second.json.created]).toEqual([201, true]);
  });
});

describe('the staff console', () => {
  it('lists reports newest first by status, with a cursor', async () => {
    const api = createTestApi('noe');
    const open = await api.call('GET', '/lineup/staff/reports');
    const items = open.json.items as Array<{status: string; created_at: string; target_id: string}>;
    expect(items.every((item) => item.status === 'open')).toBe(true);
    const times = items.map((item) => Date.parse(item.created_at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(
      new Set(
        (await api.call('GET', '/lineup/staff/reports', {query: {status: 'all'}})).json.items.map(
          (item: {status: string}) => item.status,
        ),
      ),
    ).toEqual(new Set(['open', 'resolved', 'dismissed']));
    const paged = await api.call('GET', '/lineup/staff/reports', {query: {status: 'all', limit: '3'}});
    expect(paged.json.items).toHaveLength(3);
    expect(paged.json.next_cursor).not.toBeNull();
    expect((await api.call('GET', '/lineup/staff/reports', {query: {status: 'nope'}})).json.detail[0].type).toBe(
      'literal_error',
    );
  });

  it('resolves and dismisses once, without touching the target', async () => {
    const api = createTestApi('noe');
    const id = 'c0000000-0000-4000-8000-000000000001';
    const resolved = await api.call('POST', `/lineup/staff/reports/${id}/resolve`);
    expect(resolved.json).toMatchObject({id, status: 'resolved', handled_by: U.noe});
    expect(api.server.db.posts[postId(25)]?.status).toBe('published');
    expect((await api.call('POST', `/lineup/staff/reports/${id}/dismiss`)).json.code).toBe(
      'lineup_report_already_handled',
    );
    expect(
      (await api.call('POST', '/lineup/staff/reports/c0000000-0000-4000-8000-0000000000ff/resolve')).json.code,
    ).toBe('lineup_report_not_found');
    expect((await api.call('POST', '/lineup/staff/reports/xyz/resolve')).json.detail[0].type).toBe('uuid_parsing');
  });

  it('hides a post from any status and unhides it to closed, never to published', async () => {
    const api = createTestApi('noe');
    const hidden = await api.call('POST', `/lineup/staff/posts/${postId(1)}/hide`, {
      body: {reason: 'Annonce signalée.'},
    });
    expect(hidden.json).toEqual({id: postId(1), status: 'hidden', hidden_reason: 'Annonce signalée.'});
    api.as(null);
    expect((await api.call('GET', `/lineup/posts/${postId(1)}`)).status).toBe(404);
    api.as('noe');
    expect((await api.call('POST', `/lineup/staff/posts/${postId(1)}/unhide`)).json).toEqual({
      id: postId(1),
      status: 'closed',
      hidden_reason: null,
    });
    expect((await api.call('POST', `/lineup/staff/posts/${postId(1)}/unhide`)).json.code).toBe(
      'lineup_post_not_hidden',
    );
    expect(
      (
        await api.call('POST', `/lineup/staff/posts/${postId(4)}/hide`, {
          body: {reason: 'Brouillon contraire aux règles.'},
        })
      ).json.status,
    ).toBe('hidden');
    expect((await api.call('POST', `/lineup/staff/posts/${postId(1)}/hide`, {body: {}})).json.detail[0].type).toBe(
      'missing',
    );
    expect(
      (await api.call('POST', `/lineup/staff/posts/${postId(1)}/hide`, {body: {reason: 'x'.repeat(501)}})).json
        .detail[0].type,
    ).toBe('string_too_long');
    expect(
      (await api.call('POST', '/lineup/staff/posts/a0000000-0000-4000-8000-0000000000ff/hide', {body: {reason: 'x'}}))
        .json.code,
    ).toBe('lineup_post_not_found');
  });

  it('grants, lists and revokes manual badges', async () => {
    const api = createTestApi('noe');
    const grant = await api.call('PUT', `/lineup/staff/badges/user/${U.camille}/lineup_verified`, {
      body: {note: 'Équipe vérifiée'},
    });
    expect(grant.json).toMatchObject({
      entity_type: 'user',
      entity_id: U.camille,
      badge: 'lineup_verified',
      granted_by: U.noe,
      note: 'Équipe vérifiée',
    });
    expect(
      (await api.call('GET', `/lineup/users/${U.camille}`)).json.badges.map((badge: {id: string}) => badge.id),
    ).toContain('lineup_verified');
    // Granting again updates the note.
    expect(
      (await api.call('PUT', `/lineup/staff/badges/user/${U.camille}/lineup_verified`, {body: {note: 'Nouvelle note'}}))
        .json.note,
    ).toBe('Nouvelle note');
    const list = await api.call('GET', '/lineup/staff/badges', {query: {entity_type: 'user'}});
    expect(
      list.json.items.filter(
        (item: {entity_id: string; badge: string}) => item.entity_id === U.camille && item.badge === 'lineup_verified',
      ),
    ).toHaveLength(1);
    expect(list.json.items.every((item: {entity_type: string}) => item.entity_type === 'user')).toBe(true);
    const times = list.json.items.map((item: {granted_at: string}) => Date.parse(item.granted_at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect((await api.call('DELETE', `/lineup/staff/badges/user/${U.camille}/lineup_verified`)).status).toBe(204);
    expect((await api.call('DELETE', `/lineup/staff/badges/user/${U.camille}/lineup_verified`)).json.code).toBe(
      'lineup_badge_not_found',
    );
  });

  it('refuses unknown entity types and badges that cannot be granted', async () => {
    const api = createTestApi('noe');
    const put = (type: string, badge: string) => api.call('PUT', `/lineup/staff/badges/${type}/${U.camille}/${badge}`);
    expect((await put('team', 'lineup_verified')).json.code).toBe('lineup_entity_type_invalid');
    expect((await put('user', 'moddy_server')).json.code).toBe('lineup_badge_invalid');
    expect((await put('guild', 'moddy_server')).status).toBe(200);
    expect((await put('guild', 'moddy_installed')).json.code).toBe('lineup_badge_invalid');
    expect((await put('user', 'discord_staff')).json.code).toBe('lineup_badge_invalid');
    expect((await put('user', 'unicorn')).json.code).toBe('lineup_badge_invalid');
    expect((await api.call('GET', '/lineup/staff/badges', {query: {entity_type: 'team'}})).json.code).toBe(
      'lineup_entity_type_invalid',
    );
    expect((await api.call('DELETE', `/lineup/staff/badges/team/${U.camille}/lineup_verified`)).json.code).toBe(
      'lineup_entity_type_invalid',
    );
    expect((await api.call('PUT', '/lineup/staff/badges/user/abc/lineup_verified')).json.detail[0].type).toBe(
      'int_parsing',
    );
  });
});
