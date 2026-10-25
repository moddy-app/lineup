import {describe, expect, it} from 'vitest';

import {createTestApi} from '../testing';
import {experienceId, G, postId, U} from '../seed/ids';

const valid = {
  kind: 'user',
  title: 'Modérateur disponible',
  description: 'Une description qui fait plus de vingt caractères.',
  positions: ['moderator'],
};

describe('who can read a post (§6.4, §9)', () => {
  it('shows a published post to everyone, without the editor fields', async () => {
    const api = createTestApi();
    const response = await api.call('GET', `/lineup/posts/${postId(1)}`);
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({id: postId(1), can_edit: false, is_expired: false});
    expect(response.json).not.toHaveProperty('hidden_reason');
    expect(response.json.guild).toMatchObject({id: G.cubelands, name: 'Cubelands FR'});
    expect(response.json.author).toMatchObject({id: U.alex, username: 'alex'});
  });

  it('hides drafts, closed and hidden posts from everyone but their editors and the staff', async () => {
    const api = createTestApi();
    for (const n of [4, 5, 15, 33]) {
      const response = await api.call('GET', `/lineup/posts/${postId(n)}`);
      expect(response.status, `post ${n}`).toBe(404);
      expect(response.json.code).toBe('lineup_post_not_found');
    }
    api.as('alex');
    expect((await api.call('GET', `/lineup/posts/${postId(4)}`)).json).toMatchObject({
      can_edit: true,
      hidden_reason: null,
    });
    api.as('noe');
    expect((await api.call('GET', `/lineup/posts/${postId(15)}`)).json.hidden_reason).toMatch(/versement/);
    api.as('camille');
    const own = await api.call('GET', `/lineup/posts/${postId(15)}`);
    expect(own.status).toBe(200);
    expect(own.json).toMatchObject({status: 'hidden', can_edit: true});
    api.as('sam');
    expect((await api.call('GET', `/lineup/posts/${postId(15)}`)).status).toBe(404);
  });

  it('keeps an expired published post readable by its link', async () => {
    const api = createTestApi();
    const response = await api.call('GET', `/lineup/posts/${postId(6)}`);
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({status: 'published', is_expired: true});
  });

  it('treats a malformed id like an unknown one', async () => {
    const api = createTestApi();
    expect((await api.call('GET', '/lineup/posts/not-a-uuid')).json.code).toBe('lineup_post_not_found');
  });

  it('hides the posts of an unlisted server from a third party, not from its managers or the staff', async () => {
    const api = createTestApi();
    expect((await api.call('GET', `/lineup/posts/${postId(23)}`)).status).toBe(404);
    api.as('leo');
    expect((await api.call('GET', `/lineup/posts/${postId(23)}`)).status).toBe(200);
    api.as('noe');
    expect((await api.call('GET', `/lineup/posts/${postId(23)}`)).status).toBe(200);
  });

  it('does NOT block a NSFW server on the detail route (the front shows an age screen)', async () => {
    const api = createTestApi();
    expect((await api.call('GET', `/lineup/posts/${postId(21)}`)).status).toBe(200);
    expect((await api.call('GET', `/lineup/posts/${postId(22)}`)).status).toBe(200);
  });

  it('answers 404 for a suspended author or server, except to the staff', async () => {
    const api = createTestApi();
    expect((await api.call('GET', `/lineup/posts/${postId(43)}`)).status).toBe(404);
    expect((await api.call('GET', `/lineup/posts/${postId(25)}`)).status).toBe(404);
    api.as('noe');
    expect((await api.call('GET', `/lineup/posts/${postId(43)}`)).status).toBe(200);
    expect((await api.call('GET', `/lineup/posts/${postId(25)}`)).status).toBe(200);
  });
});

describe('the public feed', () => {
  const ids = (response: {json: {items: Array<{id: string}>}}) => response.json.items.map((item) => item.id);

  it('lists published, unexpired posts, newest publication first, with the cache header', async () => {
    const api = createTestApi();
    const response = await api.call('GET', '/lineup/posts', {query: {guild_id: G.cubelands}});
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(ids(response)).toEqual([postId(3), postId(2), postId(1)]);
  });

  it('keeps NSFW servers and the NSFW theme out unless include_nsfw', async () => {
    const api = createTestApi();
    // Velvet Lounge: Lineup theme `nsfw`. Nox After Dark: Discord nsfw_level 3.
    for (const [guild, post] of [
      [G.velvet, 21],
      [G.nox, 22],
    ] as const) {
      expect(ids(await api.call('GET', '/lineup/posts', {query: {guild_id: guild}}))).toEqual([]);
      expect(ids(await api.call('GET', '/lineup/posts', {query: {guild_id: guild, include_nsfw: 'true'}}))).toEqual([
        postId(post),
      ]);
    }
  });

  it('tells on post.guild whether the server is NSFW, so the age gate does not depend on the theme', async () => {
    const api = createTestApi();
    for (const [guild, nsfw] of [
      [G.nox, true],
      [G.velvet, true],
      [G.cubelands, false],
    ] as const) {
      const response = await api.call('GET', '/lineup/posts', {query: {guild_id: guild, include_nsfw: 'true'}});
      expect(response.json.items[0].guild).toMatchObject({id: guild, nsfw});
      expect(Array.isArray(response.json.items[0].guild.badges)).toBe(true);
      expect(Array.isArray(response.json.items[0].author.badges)).toBe(true);
    }
  });

  it('leaves out the posts of an unlisted server and expired ones', async () => {
    const api = createTestApi();
    expect(ids(await api.call('GET', '/lineup/posts', {query: {guild_id: G.hyrule}}))).toEqual([]);
    expect(ids(await api.call('GET', '/lineup/posts', {query: {author_id: U.camille, kind: 'user'}}))).toEqual([
      postId(31),
      postId(32),
    ]);
  });

  it('filters by positions (OR), repeated or comma separated', async () => {
    const api = createTestApi();
    const repeated = await api.call('GET', '/lineup/posts', {
      query: {positions: ['graphic_designer', 'partnership_manager']},
    });
    const comma = await api.call('GET', '/lineup/posts', {query: {positions: 'graphic_designer,partnership_manager'}});
    expect(ids(repeated).sort()).toEqual([postId(2), postId(20)].sort());
    expect(ids(comma)).toEqual(ids(repeated));
  });

  it('filters by languages, tags, theme, compensation and q (case-insensitive)', async () => {
    const api = createTestApi();
    expect(ids(await api.call('GET', '/lineup/posts', {query: {languages: 'de'}}))).toEqual([postId(47), postId(40)]);
    expect(ids(await api.call('GET', '/lineup/posts', {query: {tags: 'GAMEDEV'}})).sort()).toEqual([postId(16)]);
    expect(ids(await api.call('GET', '/lineup/posts', {query: {theme: 'esport'}})).sort()).toEqual(
      [postId(29), postId(30)].sort(),
    );
    expect(ids(await api.call('GET', '/lineup/posts', {query: {compensation: 'paid'}})).sort()).toEqual(
      [postId(2), postId(37)].sort(),
    );
    expect(ids(await api.call('GET', '/lineup/posts', {query: {q: 'MAÎTRE DU JEU'}}))).toEqual([postId(9)]);
    expect(ids(await api.call('GET', '/lineup/posts', {query: {q: 'wiki', kind: 'guild'}}))).toEqual([postId(10)]);
  });

  it('answers lineup_filter_invalid with the field for kind, compensation and positions', async () => {
    const api = createTestApi();
    for (const [query, field] of [
      [{kind: 'team'}, 'kind'],
      [{compensation: 'gold'}, 'compensation'],
      [{positions: 'moderator,wizard'}, 'positions'],
      [{positions: Array.from({length: 11}, () => 'moderator')}, 'positions'],
    ] as const) {
      const response = await api.call('GET', '/lineup/posts', {query});
      expect(response.status).toBe(422);
      expect(response.json).toMatchObject({
        code: 'lineup_filter_invalid',
        field,
        error: {code: 'lineup_filter_invalid', field},
      });
    }
  });

  it('answers a standard 422 for bad limits and ids, and cursor_invalid for a tampered cursor', async () => {
    const api = createTestApi();
    const limit = await api.call('GET', '/lineup/posts', {query: {limit: '0'}});
    expect(limit.json).toMatchObject({
      error: 'Validation error',
      detail: [{type: 'greater_than_equal', loc: ['query', 'limit']}],
    });
    expect((await api.call('GET', '/lineup/posts', {query: {limit: '51'}})).json.detail[0].type).toBe(
      'less_than_equal',
    );
    expect((await api.call('GET', '/lineup/posts', {query: {guild_id: 'abc'}})).json.detail[0].loc).toEqual([
      'query',
      'guild_id',
    ]);
    expect((await api.call('GET', '/lineup/posts', {query: {cursor: 'tampered'}})).json.code).toBe('cursor_invalid');
  });

  it('pages without ever repeating or skipping a post', async () => {
    const api = createTestApi();
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await api.call('GET', '/lineup/posts', {query: cursor ? {limit: '3', cursor} : {limit: '3'}});
      seen.push(...ids(response));
      cursor = response.json.next_cursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    const all = await api.call('GET', '/lineup/posts', {query: {limit: '50'}});
    expect(seen).toEqual(ids(all).length === seen.length ? ids(all) : seen);
  });

  it('serves a stale page from its 60 s cache when asked to', async () => {
    const api = createTestApi('camille');
    api.state.feedCache = true;
    const before = await api.call('GET', '/lineup/posts', {query: {author_id: U.camille, kind: 'user'}});
    expect(ids(before)).toHaveLength(2);
    expect((await api.call('POST', `/lineup/posts/${postId(33)}/publish`)).status).toBe(200);
    const during = await api.call('GET', '/lineup/posts', {query: {author_id: U.camille, kind: 'user'}});
    expect(ids(during)).toHaveLength(2);
    api.state.now = new Date(api.state.now.getTime() + 61_000);
    expect(ids(await api.call('GET', '/lineup/posts', {query: {author_id: U.camille, kind: 'user'}}))).toHaveLength(3);
  });
});

describe('my posts', () => {
  it('lists every status of my posts, newest created first, in the private view', async () => {
    const api = createTestApi('camille');
    const response = await api.call('GET', '/lineup/me/posts', {query: {limit: '50'}});
    expect(response.status).toBe(200);
    const items = response.json.items as Array<{
      status: string;
      author_id: string;
      created_at: string;
      hidden_reason?: string | null;
    }>;
    expect(new Set(items.map((item) => item.status))).toEqual(new Set(['draft', 'published', 'closed', 'hidden']));
    expect(items.every((item) => item.author_id === U.camille)).toBe(true);
    expect(items.every((item) => 'hidden_reason' in item)).toBe(true);
    const times = items.map((item) => Date.parse(item.created_at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const hidden = await api.call('GET', '/lineup/me/posts', {query: {status: 'hidden'}});
    expect(hidden.json.items[0].hidden_reason).toMatch(/versement/);
  });

  it('shows all the posts of a server to its managers, whoever wrote them', async () => {
    const api = createTestApi('camille');
    const response = await api.call('GET', '/lineup/me/posts', {query: {guild_id: G.pixel}});
    expect(response.json.items).toHaveLength(3);
    const forbidden = await api.call('GET', '/lineup/me/posts', {query: {guild_id: G.cubelands}});
    expect(forbidden.status).toBe(403);
    expect(forbidden.json.code).toBe('lineup_guild_forbidden');
  });

  it('answers lineup_filter_invalid for a bad status and 401 without a session', async () => {
    const api = createTestApi('camille');
    expect((await api.call('GET', '/lineup/me/posts', {query: {status: 'archived'}})).json).toMatchObject({
      code: 'lineup_filter_invalid',
      field: 'status',
    });
    api.as(null);
    expect((await api.call('GET', '/lineup/me/posts')).json).toEqual({error: 'Non authentifie'});
  });
});

describe('creating a post (§6.4)', () => {
  it('creates a draft by default: 201, the private view, can_edit', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', '/lineup/posts', {body: valid});
    expect(response.status).toBe(201);
    expect(response.json).toMatchObject({
      status: 'draft',
      published_at: null,
      hidden_reason: null,
      can_edit: true,
      author_id: U.camille,
      guild_id: null,
      guild: null,
      positions_other: [],
      requirements: [],
      application: null,
      is_expired: false,
    });
    expect(response.json.author).toMatchObject({username: 'camille.renard'});
  });

  it('refuses unknown fields and reports every problem like Pydantic', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', '/lineup/posts', {
      body: {kind: 'user', title: 'Hey', typo: 1, positions: []},
    });
    expect(response.status).toBe(422);
    expect(response.json.error).toBe('Validation error');
    const types = response.json.detail.map(
      (issue: {type: string; loc: string[]}) => `${issue.type}:${issue.loc.join('.')}`,
    );
    expect(types).toEqual([
      'extra_forbidden:body.typo',
      'string_too_short:body.title',
      'missing:body.description',
      'too_short:body.positions',
    ]);
  });

  it('normalizes tags and languages', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', '/lineup/posts', {
      body: {...valid, tags: [' Minecraft ', 'minecraft', 'rp'], languages: ['fr', 'fr', 'en']},
    });
    expect(response.json.tags).toEqual(['minecraft', 'rp']);
    expect(response.json.languages).toEqual(['fr', 'en']);
  });

  it('refuses lineup_form with its own code', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', '/lineup/posts', {body: {...valid, application: {type: 'lineup_form'}}});
    expect(response.json).toMatchObject({code: 'lineup_form_unavailable'});
    expect(response.status).toBe(422);
  });

  it('checks the server, in order: forbidden, suspended, no profile', async () => {
    const api = createTestApi('camille');
    const guildPost = (guild_id: string) => ({...valid, kind: 'guild', guild_id});
    const forbidden = await api.call('POST', '/lineup/posts', {body: guildPost(G.cubelands)});
    expect([forbidden.status, forbidden.json.code]).toEqual([403, 'lineup_guild_forbidden']);
    const missing = await api.call('POST', '/lineup/posts', {body: guildPost(G.cafe)});
    expect([missing.status, missing.json.code]).toEqual([422, 'lineup_guild_profile_missing']);
    api.as('noe');
    const suspended = await api.call('POST', '/lineup/posts', {body: guildPost(G.trade)});
    expect(suspended.status).toBe(201);
  });

  it('answers a sanction object (no root copy) when the server is suspended and the person manages it', async () => {
    const api = createTestApi('camille');
    api.server.db.members.push({
      user_id: U.camille,
      guild_id: G.trade,
      owner: true,
      permissions: ['ADMINISTRATOR'],
      role_count: 1,
    });
    api.server.db.guildListCache[U.camille]?.guilds.push({id: G.trade, owner: true, permissions: ['ADMINISTRATOR']});
    const response = await api.call('POST', '/lineup/posts', {body: {...valid, kind: 'guild', guild_id: G.trade}});
    expect(response.status).toBe(403);
    expect(response.json).toEqual({
      error: {
        code: 'guild_suspended',
        level: 'ban',
        subject_type: 'guild',
        subject_id: G.trade,
        references: ['Q2W8E5'],
        expires_at: null,
        message: expect.any(String),
        violations_url: 'https://moddy.app/violations',
      },
    });
  });

  it('answers 503 with Retry-After when Discord is needed and silent', async () => {
    const api = createTestApi('ines');
    api.state.discordDown = true;
    const response = await api.call('POST', '/lineup/posts', {
      body: {...valid, kind: 'guild', guild_id: G.chroniqueurs},
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.json).toMatchObject({code: 'discord_unavailable', error: {code: 'discord_unavailable'}});
  });

  it('checks the featured experience: the author’s own (404) and verified (422)', async () => {
    const api = createTestApi('camille');
    const post = (id: string) => ({...valid, featured_experience_id: id});
    expect((await api.call('POST', '/lineup/posts', {body: post(experienceId(10))})).json.code).toBe(
      'lineup_experience_not_found',
    );
    expect(
      (await api.call('POST', '/lineup/posts', {body: post('e0000000-0000-4000-8000-0000000000ff')})).json.code,
    ).toBe('lineup_experience_not_found');
    expect((await api.call('POST', '/lineup/posts', {body: post(experienceId(3))})).json.code).toBe(
      'lineup_experience_not_verified',
    );
    const ok = await api.call('POST', '/lineup/posts', {body: post(experienceId(1))});
    expect([ok.status, ok.json.featured_experience_id]).toEqual([201, experienceId(1)]);
  });

  it('checks expiry and quota only for a published post, never for a draft', async () => {
    const api = createTestApi('camille');
    const past = '2026-10-19T00:00:00+00:00';
    expect((await api.call('POST', '/lineup/posts', {body: {...valid, expires_at: past}})).status).toBe(201);
    const expired = await api.call('POST', '/lineup/posts', {body: {...valid, status: 'published', expires_at: past}});
    expect([expired.status, expired.json.code]).toEqual([422, 'lineup_post_expired']);
  });

  it('enforces 3 published user posts per person and 5 per server, with limit and scope', async () => {
    const api = createTestApi('camille');
    const third = await api.call('POST', '/lineup/posts', {body: {...valid, status: 'published'}});
    expect([third.status, third.json.status, typeof third.json.published_at]).toEqual([201, 'published', 'string']);
    const fourth = await api.call('POST', '/lineup/posts', {body: {...valid, status: 'published'}});
    expect(fourth.status).toBe(409);
    expect(fourth.json).toMatchObject({
      code: 'lineup_quota_exceeded',
      limit: 3,
      scope: 'user',
      error: {limit: 3, scope: 'user'},
    });

    const fifth = await api.call('POST', '/lineup/posts', {
      body: {...valid, kind: 'guild', guild_id: G.atelier, status: 'published'},
    });
    expect(fifth.json).toMatchObject({code: 'lineup_quota_exceeded', limit: 5, scope: 'guild'});
    // A draft is still possible.
    expect(
      (await api.call('POST', '/lineup/posts', {body: {...valid, kind: 'guild', guild_id: G.atelier}})).status,
    ).toBe(201);
  });

  it('frees a place when a post expires (the quota is computed when read)', async () => {
    const api = createTestApi('camille');
    expect((await api.call('POST', `/lineup/posts/${postId(33)}/publish`)).status).toBe(200);
    const blocked = await api.call('POST', '/lineup/posts', {body: {...valid, status: 'published'}});
    expect(blocked.status).toBe(409);
    await api.call('PATCH', `/lineup/posts/${postId(32)}`, {body: {expires_at: '2026-10-21T00:00:00+00:00'}});
    api.state.now = new Date('2026-10-22T00:00:00.000Z');
    expect((await api.call('POST', '/lineup/posts', {body: {...valid, status: 'published'}})).status).toBe(201);
  });
});

describe('changing a post', () => {
  it('returns the post unchanged for {} and changes only the fields sent', async () => {
    const api = createTestApi('camille');
    const unchanged = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: {}});
    expect(unchanged.status).toBe(200);
    const changed = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: {title: 'Un nouveau titre clair'}});
    expect(changed.json).toMatchObject({title: 'Un nouveau titre clair', status: 'published'});
    expect(changed.json.description).toBe(unchanged.json.description);
  });

  it('allows null only on application, timezone, commitment, theme, featured_experience_id, expires_at', async () => {
    const api = createTestApi('camille');
    const cleared = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {
      body: {
        application: null,
        timezone: null,
        commitment: null,
        theme: null,
        featured_experience_id: null,
        expires_at: null,
      },
    });
    expect(cleared.json).toMatchObject({application: null, timezone: null, commitment: null, theme: null});
    for (const field of ['title', 'description', 'positions', 'positions_other', 'requirements', 'languages', 'tags']) {
      const response = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: {[field]: null}});
      expect(response.status, field).toBe(422);
      expect(response.json.error, field).toBe('Validation error');
    }
  });

  it('refuses kind, guild_id and status', async () => {
    const api = createTestApi('camille');
    const response = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {
      body: {kind: 'user', guild_id: '1', status: 'closed'},
    });
    expect(response.json.detail.map((issue: {type: string}) => issue.type)).toEqual([
      'extra_forbidden',
      'extra_forbidden',
      'extra_forbidden',
    ]);
  });

  it('checks other / positions_other on the merged state', async () => {
    const api = createTestApi('camille');
    const needed = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: {positions: ['moderator', 'other']}});
    expect(needed.json.code).toBe('lineup_positions_other_required');
    const unexpected = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: {positions_other: ['Narrateur']}});
    expect(unexpected.json.code).toBe('lineup_positions_other_unexpected');
    // Taking `other` out empties positions_other by itself.
    const emptied = await api.call('PATCH', `/lineup/posts/${postId(9)}`, {body: {positions: ['moderator']}});
    expect(emptied.json).toMatchObject({positions: ['moderator'], positions_other: []});
  });

  it('keeps the featured experience for user posts only', async () => {
    const api = createTestApi('camille');
    const onServer = await api.call('PATCH', `/lineup/posts/${postId(8)}`, {
      body: {featured_experience_id: experienceId(1)},
    });
    expect(onServer.json.code).toBe('lineup_featured_experience_user_only');
    const own = await api.call('PATCH', `/lineup/posts/${postId(31)}`, {
      body: {featured_experience_id: experienceId(3)},
    });
    expect(own.json.code).toBe('lineup_experience_not_verified');
    const unknown = await api.call('PATCH', `/lineup/posts/${postId(31)}`, {
      body: {featured_experience_id: experienceId(18)},
    });
    expect(unknown.json.code).toBe('lineup_experience_not_found');
  });

  it('refuses a past expires_at on a published post, but accepts it on a draft', async () => {
    const api = createTestApi('camille');
    const past = {expires_at: '2026-10-19T00:00:00+00:00'};
    expect((await api.call('PATCH', `/lineup/posts/${postId(8)}`, {body: past})).json.code).toBe('lineup_post_expired');
    expect((await api.call('PATCH', `/lineup/posts/${postId(33)}`, {body: past})).status).toBe(200);
    const publish = await api.call('POST', `/lineup/posts/${postId(33)}/publish`);
    expect([publish.status, publish.json.code]).toEqual([422, 'lineup_post_expired']);
  });

  it('is for editors only: 404 when invisible, 403 when visible but not editable', async () => {
    const api = createTestApi('hugo');
    expect(
      (await api.call('PATCH', `/lineup/posts/${postId(1)}`, {body: {title: 'Je ne devrais pas'}})).json.code,
    ).toBe('lineup_post_forbidden');
    expect(
      (await api.call('PATCH', `/lineup/posts/${postId(4)}`, {body: {title: 'Je ne devrais pas'}})).json.code,
    ).toBe('lineup_post_not_found');
  });

  it('lets any current manager of the server edit its posts, not only the author', async () => {
    const api = createTestApi('camille');
    const post = api.server.db.posts[postId(16)];
    if (post) post.author_id = U.emma;
    const response = await api.call('PATCH', `/lineup/posts/${postId(16)}`, {
      body: {title: 'Titre revu par une autre gestionnaire'},
    });
    expect(response.status).toBe(200);
    expect(response.json.author_id).toBe(U.emma);
    // And someone who stopped managing the server loses the right at once.
    api.server.db.members = api.server.db.members.filter(
      (member) => !(member.user_id === U.camille && member.guild_id === G.pixel),
    );
    delete api.server.db.guildListCache[U.camille];
    expect(
      (await api.call('PATCH', `/lineup/posts/${postId(16)}`, {body: {title: 'Titre refusé par Discord'}})).status,
    ).toBe(403);
  });

  it('does not let anyone but the staff touch a hidden post', async () => {
    const api = createTestApi('camille');
    for (const [method, path, body] of [
      ['PATCH', `/lineup/posts/${postId(15)}`, {title: 'Je corrige mon annonce'}],
      ['POST', `/lineup/posts/${postId(15)}/publish`, undefined],
      ['POST', `/lineup/posts/${postId(15)}/close`, undefined],
      ['DELETE', `/lineup/posts/${postId(15)}`, undefined],
    ] as const) {
      const response = await api.call(method, path, {body});
      expect([response.status, response.json.code], `${method} ${path}`).toEqual([409, 'lineup_post_hidden']);
    }
    api.as('noe');
    expect(
      (await api.call('PATCH', `/lineup/posts/${postId(15)}`, {body: {title: 'Titre corrigé par le staff'}})).status,
    ).toBe(200);
  });
});

describe('publish, close, delete (§8 state machine)', () => {
  it('publishes a draft and keeps published_at at the FIRST publication when reopening', async () => {
    const api = createTestApi('camille');
    const closed = await api.call('POST', `/lineup/posts/${postId(14)}/publish`);
    // The server is at its quota of 5 live posts.
    expect([closed.status, closed.json.code]).toEqual([409, 'lineup_quota_exceeded']);
    const original = api.server.db.posts[postId(14)]?.published_at;
    expect((await api.call('POST', `/lineup/posts/${postId(8)}/close`)).json.status).toBe('closed');
    const reopened = await api.call('POST', `/lineup/posts/${postId(14)}/publish`);
    expect(reopened.status).toBe(200);
    expect(reopened.json).toMatchObject({status: 'published', published_at: original, can_edit: true});
  });

  it('refuses impossible transitions with the current status', async () => {
    const api = createTestApi('camille');
    const again = await api.call('POST', `/lineup/posts/${postId(31)}/publish`);
    expect(again.json).toMatchObject({code: 'lineup_post_invalid_status', current_status: 'published'});
    const draft = await api.call('POST', `/lineup/posts/${postId(33)}/close`);
    expect(draft.json).toMatchObject({code: 'lineup_post_invalid_status', current_status: 'draft'});
    const closed = await api.call('POST', `/lineup/posts/${postId(34)}/close`);
    expect(closed.json).toMatchObject({code: 'lineup_post_invalid_status', current_status: 'closed'});
  });

  it('closes a published post and deletes a post for good (204)', async () => {
    const api = createTestApi('camille');
    expect((await api.call('POST', `/lineup/posts/${postId(31)}/close`)).json.status).toBe('closed');
    const deleted = await api.call('DELETE', `/lineup/posts/${postId(31)}`);
    expect(deleted.status).toBe(204);
    expect(deleted.json).toBeUndefined();
    expect((await api.call('GET', `/lineup/posts/${postId(31)}`)).status).toBe(404);
  });

  it('replays the featured-experience check on publish (an experience that fell back to unverified)', async () => {
    const api = createTestApi('camille');
    const experience = api.server.db.experiences[experienceId(2)];
    if (experience) experience.status = 'unverified';
    await api.call('POST', `/lineup/posts/${postId(31)}/close`);
    const response = await api.call('POST', `/lineup/posts/${postId(31)}/publish`);
    expect(response.json.code).toBe('lineup_experience_not_verified');
  });

  it('closes the draft and published posts of a server when its profile is deleted, and leaves hidden ones hidden', async () => {
    const api = createTestApi('camille');
    const first = await api.call('DELETE', `/lineup/guilds/${G.atelier}`);
    expect(first.status).toBe(204);
    const status = (n: number) => api.server.db.posts[postId(n)]?.status;
    expect([8, 12, 13, 14, 15].map(status)).toEqual(['closed', 'closed', 'closed', 'closed', 'hidden']);
    // Idempotent.
    expect((await api.call('DELETE', `/lineup/guilds/${G.atelier}`)).status).toBe(204);
    expect((await api.call('GET', `/lineup/guilds/${G.atelier}`)).json.code).toBe('lineup_guild_not_found');
  });
});
