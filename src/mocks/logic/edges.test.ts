import {describe, expect, it, vi} from 'vitest';

import {experienceId as x, G, postId, U} from '../seed/ids';
import {dispatch} from '../server/dispatch';
import {createTestApi, type TestApi} from '../testing';
import {iso} from '../time';

const code = (response: {json: {code?: string}}) => response.json.code;

/** Clones a seeded post `count` times, published one minute apart, to fill a profile past 20. */
function addPosts(api: TestApi, template: string, count: number, patch: Record<string, unknown> = {}) {
  const base = api.server.db.posts[template];
  if (!base) throw new Error(`no post ${template}`);
  const at = api.state.now.getTime();
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `d0000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`;
    api.server.db.posts[id] = {
      ...base,
      id,
      status: 'published',
      expires_at: null,
      published_at: iso(at - (i + 1) * 60_000),
      created_at: iso(at - (i + 1) * 60_000 - 1000),
      hidden_reason: null,
      ...patch,
    } as never;
    ids.push(id);
  }
  return ids;
}

describe('profiles show 20 posts at most', () => {
  it('cuts a server profile at 20, newest first, NSFW included', async () => {
    const api = createTestApi();
    const ids = addPosts(api, postId(1), 25);
    const response = await api.call('GET', `/lineup/guilds/${G.cubelands}`);
    expect(response.json.posts).toHaveLength(20);
    expect(response.json.posts[0].id).toBe(ids[0]);
    // The same cut on a NSFW server (Nox After Dark): its posts are on its profile too.
    const nox = Object.values(api.server.db.posts).find(
      (post) => post.guild_id === G.nox && post.status === 'published',
    );
    if (!nox) throw new Error('no nox post');
    addPosts(api, nox.id, 22, {guild_id: G.nox});
    const noxProfile = await api.call('GET', `/lineup/guilds/${G.nox}`);
    expect(noxProfile.json.posts).toHaveLength(20);
  });

  it('cuts a person profile at 20 and leaves out expired, closed, draft and hidden posts', async () => {
    const api = createTestApi();
    const mine = Object.values(api.server.db.posts).find((post) => post.kind === 'user' && post.author_id === U.sam);
    if (!mine) throw new Error('no post');
    addPosts(api, mine.id, 21);
    const before = await api.call('GET', `/lineup/users/${U.sam}`);
    expect(before.json.posts).toHaveLength(20);
    const [one] = addPosts(api, mine.id, 1, {status: 'hidden', hidden_reason: 'x', published_at: iso(api.state.now)});
    expect(
      (await api.call('GET', `/lineup/users/${U.sam}`)).json.posts.map((post: {id: string}) => post.id),
    ).not.toContain(one);
  });
});

describe('every paginated route', () => {
  const tampered = ['%%%', 'abc', btoa('["x"]'), btoa('["2026-10-20T00:00:00+00:00","zzz"]'), btoa('{}')];

  it('answers 422 cursor_invalid to a tampered cursor, in shape 1', async () => {
    const api = createTestApi('noe');
    for (const path of [
      '/lineup/posts',
      '/lineup/guilds',
      '/lineup/me/posts',
      '/lineup/staff/experiences',
      '/lineup/staff/reports',
    ]) {
      for (const cursor of tampered) {
        const response = await api.call('GET', path, {query: {cursor}});
        expect([response.status, code(response), response.json.error?.code], `${path} ${cursor}`).toEqual([
          422,
          'cursor_invalid',
          'cursor_invalid',
        ]);
      }
    }
  });

  it('walks the staff review queue by cursor, oldest first, without repeating', async () => {
    const api = createTestApi('noe');
    const all = (await api.call('GET', '/lineup/staff/experiences', {query: {limit: '100'}})).json.items;
    expect(all.length).toBeGreaterThanOrEqual(3);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: {json: {items: Array<{id: string}>; next_cursor: string | null}} = await api.call(
        'GET',
        '/lineup/staff/experiences',
        {query: {limit: '1', ...(cursor ? {cursor} : {})}},
      );
      expect(page.json.items.length).toBeLessThanOrEqual(1);
      seen.push(...page.json.items.map((item) => item.id));
      cursor = page.json.next_cursor;
    } while (cursor);
    expect(seen).toEqual(all.map((item: {id: string}) => item.id));
  });

  it('bounds the limits: 1 to 100 for the staff lists, 1 to 200 and an offset for the badges', async () => {
    const api = createTestApi('noe');
    for (const path of ['/lineup/staff/experiences', '/lineup/staff/reports']) {
      for (const limit of ['0', '101', 'x']) {
        expect((await api.call('GET', path, {query: {limit}})).json.detail[0].loc, `${path} ${limit}`).toEqual([
          'query',
          'limit',
        ]);
      }
      expect((await api.call('GET', path, {query: {limit: '100'}})).status).toBe(200);
    }
    for (const limit of ['0', '201']) {
      expect((await api.call('GET', '/lineup/staff/badges', {query: {limit}})).json.detail[0].loc).toEqual([
        'query',
        'limit',
      ]);
    }
    expect((await api.call('GET', '/lineup/staff/badges', {query: {offset: '-1'}})).json.detail[0].type).toBe(
      'greater_than_equal',
    );
    const page1 = await api.call('GET', '/lineup/staff/badges', {query: {limit: '2'}});
    const page2 = await api.call('GET', '/lineup/staff/badges', {query: {limit: '2', offset: '2'}});
    expect(page1.json.items).toHaveLength(2);
    expect(page1.json).not.toHaveProperty('next_cursor');
    expect(page2.json.items.map((item: {badge: string}) => item.badge)).not.toEqual(
      page1.json.items.map((item: {badge: string}) => item.badge),
    );
  });
});

describe('what a hidden or reopened post goes through', () => {
  it('goes back to closed on unhide, and the author reopens it keeping the first publication date', async () => {
    const api = createTestApi('noe');
    const before = api.server.db.posts[postId(8)];
    const firstPublished = before?.published_at;
    expect(firstPublished).toBeTruthy();
    await api.call('POST', `/lineup/staff/posts/${postId(8)}/hide`, {body: {reason: 'Contenu douteux.'}});
    api.as('camille');
    expect((await api.call('GET', `/lineup/posts/${postId(8)}`)).json).toMatchObject({
      status: 'hidden',
      hidden_reason: 'Contenu douteux.',
      can_edit: true,
    });
    expect(code(await api.call('POST', `/lineup/posts/${postId(8)}/publish`))).toBe('lineup_post_hidden');
    expect(code(await api.call('POST', `/lineup/posts/${postId(8)}/close`))).toBe('lineup_post_hidden');
    expect(code(await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: {title: 'Nouveau titre'}}))).toBe(
      'lineup_post_hidden',
    );
    expect(code(await api.call('DELETE', `/lineup/posts/${postId(8)}`))).toBe('lineup_post_hidden');
    // Hiding is not undone by the author, and a second hide only changes the reason.
    api.as('noe');
    expect(
      (await api.call('POST', `/lineup/staff/posts/${postId(8)}/hide`, {body: {reason: 'Autre motif.'}})).json
        .hidden_reason,
    ).toBe('Autre motif.');
    await api.call('POST', `/lineup/staff/posts/${postId(8)}/unhide`);
    api.as('camille');
    const closed = await api.call('GET', `/lineup/posts/${postId(8)}`);
    expect(closed.json).toMatchObject({status: 'closed', hidden_reason: null});
    // Quota: hiding freed a place (4 live posts left at Atelier du Phénix); a new post takes it.
    const filler = await api.call('POST', '/lineup/posts', {
      body: {
        kind: 'guild',
        guild_id: G.atelier,
        title: 'Une cinquième annonce',
        description: 'a'.repeat(30),
        positions: ['moderator'],
        status: 'published',
      },
    });
    expect(filler.status).toBe(201);
    const republish = await api.call('POST', `/lineup/posts/${postId(8)}/publish`);
    expect([republish.status, republish.json.limit, republish.json.scope]).toEqual([409, 5, 'guild']);
    await api.call('POST', `/lineup/posts/${filler.json.id}/close`);
    const reopened = await api.call('POST', `/lineup/posts/${postId(8)}/publish`);
    expect(reopened.status).toBe(200);
    expect(reopened.json.published_at).toBe(firstPublished);
  });

  it('lets the staff touch a hidden post, and a third party still gets a 404', async () => {
    const api = createTestApi('noe');
    await api.call('POST', `/lineup/staff/posts/${postId(1)}/hide`, {body: {reason: 'Motif.'}});
    expect((await api.call('PATCH', `/lineup/posts/${postId(1)}`, {body: {title: 'Titre corrigé ici'}})).status).toBe(
      200,
    );
    api.as('sam');
    expect(code(await api.call('GET', `/lineup/posts/${postId(1)}`))).toBe('lineup_post_not_found');
    expect(code(await api.call('PATCH', `/lineup/posts/${postId(1)}`, {body: {title: 'Titre piraté ici'}}))).toBe(
      'lineup_post_not_found',
    );
  });

  it('keeps reports open on a hidden post, and lets two people report the same target', async () => {
    const api = createTestApi('camille');
    const target = {target_type: 'post', target_id: postId(1), reason: 'scam'};
    api.as('noe');
    await api.call('POST', `/lineup/staff/posts/${postId(1)}/hide`, {body: {reason: 'Motif.'}});
    api.as('camille');
    expect((await api.call('POST', '/lineup/reports', {body: target})).status).toBe(201);
    api.as('sam');
    expect((await api.call('POST', '/lineup/reports', {body: target})).status).toBe(201);
    api.as('noe');
    const open = (await api.call('GET', '/lineup/staff/reports')).json.items.filter(
      (item: {target_id: string}) => item.target_id === postId(1),
    );
    expect(open.map((item: {reporter_id: string}) => item.reporter_id).sort()).toEqual([U.camille, U.sam].sort());
    expect(open.every((item: {details: string | null}) => item.details === null)).toBe(true);
  });
});

describe('the dev panel’s "Discord unavailable"', () => {
  it('fails only the routes that really call Discord (a person with no cached server list)', async () => {
    const api = createTestApi('ines');
    api.state.discordDown = true;
    const down = async (method: string, path: string, body?: unknown) => {
      const response = await api.call(method, path, {body});
      return [response.status, response.headers.get('Retry-After'), response.json?.code ?? null];
    };
    const fail = [503, '30', 'discord_unavailable'];
    expect(await down('POST', '/lineup/guilds/claim', {invite: 'chroniqueurs'})).toEqual(fail);
    expect(await down('GET', `/lineup/me/posts?guild_id=${G.chroniqueurs}`)).toEqual(fail);
    expect(
      await down('POST', '/lineup/posts', {
        kind: 'guild',
        guild_id: G.chroniqueurs,
        title: 'Annonce de test',
        description: 'a'.repeat(30),
        positions: ['moderator'],
      }),
    ).toEqual(fail);
    expect(
      await down('POST', '/lineup/me/experiences', {
        kind: 'guild',
        invite: 'chroniqueurs',
        position: 'moderator',
        start_date: '2024-01-01',
      }),
    ).toEqual(fail);
    // No Discord needed:
    expect(
      (
        await down('POST', '/lineup/me/experiences', {
          kind: 'service',
          name: 'Un forum',
          position: 'moderator',
          start_date: '2024-01-01',
        })
      )[0],
    ).toBe(201);
    expect((await down('GET', '/lineup/me/guilds'))[0]).toBe(200);
    expect((await down('POST', '/lineup/me/refresh-guilds'))[0]).toBe(200);
    expect((await down('PUT', '/lineup/me/profile', {headline: 'Autrice'}))[0]).toBe(200);
    expect((await down('GET', '/lineup/posts'))[0]).toBe(200);
    expect((await down('GET', '/lineup/guilds'))[0]).toBe(200);
    expect((await down('GET', `/lineup/guilds/${G.cubelands}`))[0]).toBe(200);
    expect((await down('GET', `/lineup/users/${U.camille}`))[0]).toBe(200);
    expect((await down('GET', '/lineup/catalog'))[0]).toBe(200);
    expect(
      (await down('POST', '/lineup/reports', {target_type: 'user', target_id: U.camille, reason: 'spam'}))[0],
    ).toBe(201);
    api.as('noe');
    expect((await down('GET', '/lineup/staff/reports'))[0]).toBe(200);
    expect((await down('POST', `/lineup/staff/posts/${postId(1)}/hide`, {reason: 'x'}))[0]).toBe(200);
  });

  it('does not touch a rights decision the session already makes (Moddy on the server, or the staff)', async () => {
    const api = createTestApi('camille');
    api.state.discordDown = true;
    // Atelier du Phénix has Moddy and is in the session's list: no Discord call needed.
    expect((await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {listed: true}})).status).toBe(200);
    api.as('noe');
    expect((await api.call('PUT', `/lineup/guilds/${G.pixel}`, {body: {listed: true}})).status).toBe(200);
  });

  it('reads the claim, an invitation and a verification as a doubt, never as a "no"', async () => {
    const api = createTestApi('camille');
    api.state.discordDown = true;
    api.state.verifyOutcome = 'not_member';
    for (const [path, body] of [
      ['/lineup/guilds/claim', {invite: 'cafe-des-mods'}],
      [`/lineup/me/experiences/${x(3)}/verify`, undefined],
    ] as const) {
      const response = await api.call('POST', path, {body});
      expect([response.status, response.json.code], path).toEqual([503, 'discord_unavailable']);
    }
  });
});

describe('the router', () => {
  it('persists after a write that succeeded, never after a read or a refused write', async () => {
    const api = createTestApi('camille');
    const persist = vi.spyOn(api.server, 'persist');
    await api.call('GET', '/lineup/me');
    await api.call('POST', '/lineup/posts', {body: {typo: 1}});
    expect(persist).not.toHaveBeenCalled();
    await api.call('PUT', '/lineup/me/profile', {body: {headline: 'Modératrice'}});
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('turns an unexpected failure into a plain 500, not a crash', async () => {
    const api = createTestApi('camille');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.server.session = () => {
      throw new Error('boom');
    };
    const response = await dispatch(api.server, new Request('https://api.moddy.app/lineup/me'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error: 'Internal Server Error'});
    log.mockRestore();
  });

  it('answers a 200 with an empty body and no content type (logout)', async () => {
    const api = createTestApi('camille');
    const response = await dispatch(api.server, new Request('https://api.moddy.app/auth/logout', {method: 'POST'}));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Content-Type')).toBeNull();
  });

  it('answers malformed JSON with the standard 422, at the root of the body', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', '/lineup/posts', {rawBody: '{"kind": '});
    expect(response.status).toBe(422);
    expect(response.json.error).toBe('Validation error');
    expect(response.json.detail[0]).toMatchObject({
      type: 'json_invalid',
      loc: ['body', expect.any(Number)],
      msg: 'JSON decode error',
    });
    const notObject = await api.call('POST', '/lineup/posts', {rawBody: '[1]'});
    expect(notObject.json.detail[0]).toMatchObject({type: 'model_attributes_type', loc: ['body']});
  });

  it('refuses unknown fields on every write that takes a body, with extra_forbidden and the field in loc', async () => {
    const api = createTestApi('camille');
    const cases: Array<[string, string, unknown]> = [
      ['POST', '/lineup/guilds/claim', {invite: 'cafe-des-mods', x: 1}],
      ['PUT', `/lineup/guilds/${G.atelier}`, {x: 1}],
      ['PUT', '/lineup/me/profile', {x: 1}],
      [
        'POST',
        '/lineup/posts',
        {kind: 'user', title: 'Titre valide', description: 'a'.repeat(30), positions: ['moderator'], x: 1},
      ],
      ['PATCH', `/lineup/posts/${postId(31)}`, {x: 1}],
      ['POST', '/lineup/reports', {target_type: 'user', target_id: U.alex, reason: 'spam', x: 1}],
      [
        'POST',
        '/lineup/me/experiences',
        {kind: 'service', name: 'Forum', position: 'moderator', start_date: '2024-01-01', x: 1},
      ],
      ['PATCH', `/lineup/me/experiences/${x(1)}`, {x: 1}],
      ['PUT', '/lineup/me/experiences/order', {ids: [], x: 1}],
      ['POST', `/lineup/me/experiences/${x(4)}/request-review`, {x: 1}],
    ];
    for (const [method, path, body] of cases) {
      const response = await api.call(method, path, {body});
      expect(response.status, `${method} ${path}`).toBe(422);
      expect(response.json.detail, `${method} ${path}`).toContainEqual(
        expect.objectContaining({
          type: 'extra_forbidden',
          loc: ['body', 'x'],
          msg: 'Extra inputs are not permitted',
          input: 1,
        }),
      );
    }
    api.as('noe');
    const staffCases: Array<[string, string, unknown]> = [
      ['POST', `/lineup/staff/posts/${postId(1)}/hide`, {reason: 'x', x: 1}],
      ['POST', `/lineup/staff/experiences/${x(4)}/verify`, {x: 1}],
      ['POST', `/lineup/staff/experiences/${x(4)}/reject`, {reason: 'x', x: 1}],
      ['PUT', `/lineup/staff/badges/user/${U.alex}/lineup_verified`, {x: 1}],
    ];
    for (const [method, path, body] of staffCases) {
      const response = await api.call(method, path, {body});
      expect(response.json.detail?.[0]?.type, `${method} ${path}`).toBe('extra_forbidden');
    }
  });
});

describe('a suspended server, on every write that reaches it', () => {
  function manageTrade() {
    const api = createTestApi('camille');
    api.server.db.members.push({
      user_id: U.camille,
      guild_id: G.trade,
      owner: true,
      permissions: ['ADMINISTRATOR'],
      role_count: 1,
    });
    api.server.db.guildListCache[U.camille]?.guilds.push({id: G.trade, owner: true, permissions: ['ADMINISTRATOR']});
    return api;
  }

  it('answers 403 guild_suspended (shape 2) to PUT, DELETE and refresh, and lets the staff through', async () => {
    const api = manageTrade();
    for (const [method, path, body] of [
      ['PUT', `/lineup/guilds/${G.trade}`, {listed: false}],
      ['DELETE', `/lineup/guilds/${G.trade}`, undefined],
      ['POST', `/lineup/guilds/${G.trade}/refresh`, undefined],
    ] as const) {
      const response = await api.call(method, path, {body});
      expect([response.status, response.json.error.code, 'code' in response.json], `${method} ${path}`).toEqual([
        403,
        'guild_suspended',
        false,
      ]);
    }
    expect(api.server.db.profiles[G.trade]).toBeDefined();
    api.as('noe');
    expect((await api.call('PUT', `/lineup/guilds/${G.trade}`, {body: {listed: false}})).status).toBe(200);
  });

  it('answers 403 guild_suspended to PATCH, publish, close and DELETE of its posts, and lets the staff through', async () => {
    const api = manageTrade();
    const post = Object.values(api.server.db.posts).find(
      (entry) => entry.guild_id === G.trade && entry.status === 'published',
    );
    if (!post) throw new Error('no post of the suspended server');
    for (const [method, path, body] of [
      ['PATCH', `/lineup/posts/${post.id}`, {title: 'Un nouveau titre'}],
      ['POST', `/lineup/posts/${post.id}/publish`, undefined],
      ['POST', `/lineup/posts/${post.id}/close`, undefined],
      ['DELETE', `/lineup/posts/${post.id}`, undefined],
    ] as const) {
      const response = await api.call(method, path, {body});
      expect([response.status, response.json.error?.code], `${method} ${path}`).toEqual([403, 'guild_suspended']);
    }
    // The public does not see it at all, and the manager's own detail read is still allowed (they can see, not edit).
    api.as(null);
    expect(code(await api.call('GET', `/lineup/posts/${post.id}`))).toBe('lineup_post_not_found');
    api.as('noe');
    expect((await api.call('POST', `/lineup/posts/${post.id}/close`)).status).toBe(200);
  });
});

describe('the writes on a post, when Discord cannot say who manages the server', () => {
  it('answers 503 to PATCH, publish, close and DELETE of a server post, never a 403 or a 404', async () => {
    const api = createTestApi('camille');
    // No cached list of her servers, and Pixel Forge has no Moddy: only Discord can tell.
    delete api.server.db.guildListCache[U.camille];
    api.state.discordDown = true;
    const post = Object.values(api.server.db.posts).find(
      (entry) => entry.guild_id === G.pixel && entry.status === 'published',
    );
    if (!post) throw new Error('no post');
    for (const [method, path, body] of [
      ['PATCH', `/lineup/posts/${post.id}`, {title: 'Un nouveau titre'}],
      ['POST', `/lineup/posts/${post.id}/publish`, undefined],
      ['POST', `/lineup/posts/${post.id}/close`, undefined],
      ['DELETE', `/lineup/posts/${post.id}`, undefined],
      ['POST', `/lineup/guilds/${G.pixel}/refresh`, undefined],
      ['PUT', `/lineup/guilds/${G.pixel}`, {listed: true}],
      ['DELETE', `/lineup/guilds/${G.pixel}`, undefined],
    ] as const) {
      const response = await api.call(method, path, {body});
      expect([response.status, response.headers.get('Retry-After'), response.json.code], `${method} ${path}`).toEqual([
        503,
        '30',
        'discord_unavailable',
      ]);
    }
    // A read is only quieter: can_manage / can_edit are false on a doubt.
    const read = await api.call('GET', `/lineup/posts/${post.id}`);
    expect([read.status, read.json.can_edit]).toEqual([200, false]);
  });
});

describe('path parameters keep the names of LINEUP.md in `detail[].loc`', () => {
  it('points at guild_id, user_id, exp_id, post_id, report_id and entity_id', async () => {
    const api = createTestApi('noe');
    const loc = async (method: string, path: string) =>
      (await api.call(method, path, {body: method === 'GET' ? undefined : {reason: 'x'}})).json.detail?.[0]?.loc;
    expect(await loc('GET', '/lineup/guilds/abc')).toEqual(['path', 'guild_id']);
    expect(await loc('PUT', '/lineup/guilds/abc')).toEqual(['path', 'guild_id']);
    expect(await loc('DELETE', '/lineup/guilds/abc')).toEqual(['path', 'guild_id']);
    expect(await loc('POST', '/lineup/guilds/abc/refresh')).toEqual(['path', 'guild_id']);
    expect(await loc('GET', '/lineup/users/abc')).toEqual(['path', 'user_id']);
    expect(await loc('PATCH', '/lineup/me/experiences/abc')).toEqual(['path', 'exp_id']);
    expect(await loc('DELETE', '/lineup/me/experiences/abc')).toEqual(['path', 'exp_id']);
    expect(await loc('POST', '/lineup/me/experiences/abc/verify')).toEqual(['path', 'exp_id']);
    expect(await loc('POST', '/lineup/staff/experiences/abc/reject')).toEqual(['path', 'exp_id']);
    expect(await loc('POST', '/lineup/staff/posts/abc/hide')).toEqual(['path', 'post_id']);
    expect(await loc('POST', '/lineup/staff/posts/abc/unhide')).toEqual(['path', 'post_id']);
    expect(await loc('POST', '/lineup/staff/reports/abc/resolve')).toEqual(['path', 'report_id']);
    expect(await loc('PUT', '/lineup/staff/badges/user/abc/lineup_verified')).toEqual(['path', 'entity_id']);
    expect(await loc('DELETE', '/lineup/staff/badges/user/abc/lineup_verified')).toEqual(['path', 'entity_id']);
  });
});
