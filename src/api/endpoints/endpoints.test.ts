import {afterEach, describe, expect, it, vi} from 'vitest';

import {config} from '@/config';

import lineupDoc from '../../../LINEUP.md?raw';

import * as api from './index';

interface Call {
  method: string;
  path: string;
  query: string;
  body: unknown;
}

/** Runs `fn` against a stubbed fetch that answers 200 `{}` and reports what was sent. */
async function sent(fn: () => Promise<unknown>): Promise<Call> {
  const spy = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response('{}', {status: 200}));
  vi.stubGlobal('fetch', spy);
  await fn();
  expect(spy).toHaveBeenCalledTimes(1);
  const [url, init] = spy.mock.calls[0]!;
  const parsed = new URL(String(url));
  expect(`${parsed.origin}`).toBe(config.apiBase);
  expect(init?.credentials).toBe('include');
  return {
    method: init?.method ?? 'GET',
    path: parsed.pathname,
    query: parsed.search.replace(/^\?/, ''),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

const UUID = '0b6f2c1e-3f0a-4c55-9d2a-6e9d1b0a7c11';
const SNOWFLAKE = '812345678901234567';

afterEach(() => vi.unstubAllGlobals());

/**
 * The 41 routes of LINEUP.md §6, each with what its function must send. The
 * navigation `GET /lineup/auth/login` is checked apart (it is a URL).
 */
const routes: Array<{route: string; call: () => Promise<unknown>; expected: Partial<Call>}> = [
  {route: 'GET /lineup/me', call: () => api.getMe(), expected: {method: 'GET', path: '/lineup/me'}},
  {route: 'GET /lineup/me/guilds', call: () => api.getMyGuilds(), expected: {method: 'GET', path: '/lineup/me/guilds'}},
  {
    route: 'POST /lineup/me/refresh-guilds',
    call: () => api.refreshMyGuilds(),
    expected: {method: 'POST', path: '/lineup/me/refresh-guilds', body: undefined},
  },
  {route: 'GET /lineup/catalog', call: () => api.getCatalog(), expected: {method: 'GET', path: '/lineup/catalog'}},
  {
    route: 'GET /lineup/guilds',
    call: () => api.getGuildDirectory({theme: 'gaming', q: ' mine ', include_nsfw: false}, {cursor: 'abc', limit: 24}),
    expected: {method: 'GET', path: '/lineup/guilds', query: 'theme=gaming&q=mine&limit=24&cursor=abc'},
  },
  {
    route: 'POST /lineup/guilds/claim',
    call: () => api.claimGuild({invite: 'https://discord.gg/cubelands'}),
    expected: {method: 'POST', path: '/lineup/guilds/claim', body: {invite: 'https://discord.gg/cubelands'}},
  },
  {
    route: 'GET /lineup/guilds/{guild_id}',
    call: () => api.getGuild(SNOWFLAKE),
    expected: {method: 'GET', path: `/lineup/guilds/${SNOWFLAKE}`},
  },
  {
    route: 'PUT /lineup/guilds/{guild_id}',
    call: () => api.updateGuild(SNOWFLAKE, {description: null, listed: false}),
    expected: {method: 'PUT', path: `/lineup/guilds/${SNOWFLAKE}`, body: {description: null, listed: false}},
  },
  {
    route: 'DELETE /lineup/guilds/{guild_id}',
    call: () => api.deleteGuild(SNOWFLAKE),
    expected: {method: 'DELETE', path: `/lineup/guilds/${SNOWFLAKE}`},
  },
  {
    route: 'POST /lineup/guilds/{guild_id}/refresh',
    call: () => api.refreshGuild(SNOWFLAKE),
    expected: {method: 'POST', path: `/lineup/guilds/${SNOWFLAKE}/refresh`, body: undefined},
  },
  {
    route: 'GET /lineup/users/{user_id}',
    call: () => api.getUser(SNOWFLAKE),
    expected: {method: 'GET', path: `/lineup/users/${SNOWFLAKE}`},
  },
  {
    route: 'GET /lineup/me/profile',
    call: () => api.getMyProfile(),
    expected: {method: 'GET', path: '/lineup/me/profile'},
  },
  {
    route: 'PUT /lineup/me/profile',
    call: () => api.updateMyProfile({headline: null, open_to_work: true}),
    expected: {method: 'PUT', path: '/lineup/me/profile', body: {headline: null, open_to_work: true}},
  },
  {
    route: 'GET /lineup/posts',
    call: () =>
      api.getFeed(
        {kind: 'guild', positions: ['moderator', 'admin'], tags: ['a'], include_nsfw: true, q: ''},
        {cursor: 'c1'},
      ),
    expected: {
      method: 'GET',
      path: '/lineup/posts',
      query: 'kind=guild&positions=moderator&positions=admin&tags=a&include_nsfw=true&cursor=c1',
    },
  },
  {
    route: 'GET /lineup/me/posts',
    call: () => api.getMyPosts({guildId: SNOWFLAKE, status: 'draft'}, {limit: 50}),
    expected: {method: 'GET', path: '/lineup/me/posts', query: `guild_id=${SNOWFLAKE}&status=draft&limit=50`},
  },
  {
    route: 'GET /lineup/posts/{post_id}',
    call: () => api.getPost(UUID),
    expected: {method: 'GET', path: `/lineup/posts/${UUID}`},
  },
  {
    route: 'POST /lineup/posts',
    call: () => api.createPost({kind: 'user', title: 'Titre', description: 'x'.repeat(20), positions: ['moderator']}),
    expected: {
      method: 'POST',
      path: '/lineup/posts',
      body: {kind: 'user', title: 'Titre', description: 'x'.repeat(20), positions: ['moderator']},
    },
  },
  {
    route: 'PATCH /lineup/posts/{post_id}',
    call: () => api.updatePost(UUID, {expires_at: null, application: {type: 'discord_dm'}}),
    expected: {
      method: 'PATCH',
      path: `/lineup/posts/${UUID}`,
      body: {expires_at: null, application: {type: 'discord_dm'}},
    },
  },
  {
    route: 'POST /lineup/posts/{post_id}/publish',
    call: () => api.publishPost(UUID),
    expected: {method: 'POST', path: `/lineup/posts/${UUID}/publish`, body: undefined},
  },
  {
    route: 'POST /lineup/posts/{post_id}/close',
    call: () => api.closePost(UUID),
    expected: {method: 'POST', path: `/lineup/posts/${UUID}/close`, body: undefined},
  },
  {
    route: 'DELETE /lineup/posts/{post_id}',
    call: () => api.deletePost(UUID),
    expected: {method: 'DELETE', path: `/lineup/posts/${UUID}`},
  },
  {
    route: 'POST /lineup/reports',
    call: () => api.createReport({target_type: 'post', target_id: UUID, reason: 'scam'}),
    expected: {method: 'POST', path: '/lineup/reports', body: {target_type: 'post', target_id: UUID, reason: 'scam'}},
  },
  {
    route: 'GET /lineup/me/experiences',
    call: () => api.getMyExperiences(),
    expected: {method: 'GET', path: '/lineup/me/experiences'},
  },
  {
    route: 'POST /lineup/me/experiences',
    call: () =>
      api.createExperience({kind: 'service', name: 'Twitch', position: 'moderator', start_date: '2024-03-01'}),
    expected: {
      method: 'POST',
      path: '/lineup/me/experiences',
      body: {kind: 'service', name: 'Twitch', position: 'moderator', start_date: '2024-03-01'},
    },
  },
  {
    route: 'PATCH /lineup/me/experiences/{exp_id}',
    call: () => api.updateExperience(UUID, {end_date: null}),
    expected: {method: 'PATCH', path: `/lineup/me/experiences/${UUID}`, body: {end_date: null}},
  },
  {
    route: 'PUT /lineup/me/experiences/order',
    call: () => api.reorderExperiences([UUID]),
    expected: {method: 'PUT', path: '/lineup/me/experiences/order', body: {ids: [UUID]}},
  },
  {
    route: 'DELETE /lineup/me/experiences/{exp_id}',
    call: () => api.deleteExperience(UUID),
    expected: {method: 'DELETE', path: `/lineup/me/experiences/${UUID}`},
  },
  {
    route: 'POST /lineup/me/experiences/{exp_id}/verify',
    call: () => api.verifyExperience(UUID),
    expected: {method: 'POST', path: `/lineup/me/experiences/${UUID}/verify`, body: undefined},
  },
  {
    route: 'POST /lineup/me/experiences/{exp_id}/request-review',
    call: () => api.requestExperienceReview(UUID, {note: 'Ancien serveur'}),
    expected: {method: 'POST', path: `/lineup/me/experiences/${UUID}/request-review`, body: {note: 'Ancien serveur'}},
  },
  {
    route: 'GET /lineup/staff/experiences',
    call: () => api.getStaffExperiences('pending', {limit: 50}),
    expected: {method: 'GET', path: '/lineup/staff/experiences', query: 'status=pending&limit=50'},
  },
  {
    route: 'POST /lineup/staff/experiences/{exp_id}/verify',
    call: () => api.staffVerifyExperience(UUID),
    expected: {method: 'POST', path: `/lineup/staff/experiences/${UUID}/verify`, body: undefined},
  },
  {
    route: 'POST /lineup/staff/experiences/{exp_id}/reject',
    call: () => api.staffRejectExperience(UUID, {reason: 'Preuve insuffisante'}),
    expected: {
      method: 'POST',
      path: `/lineup/staff/experiences/${UUID}/reject`,
      body: {reason: 'Preuve insuffisante'},
    },
  },
  {
    route: 'GET /lineup/staff/badges',
    call: () => api.getStaffBadges('guild', {limit: 100, offset: 200}),
    expected: {method: 'GET', path: '/lineup/staff/badges', query: 'entity_type=guild&limit=100&offset=200'},
  },
  {
    route: 'PUT /lineup/staff/badges/{entity_type}/{entity_id}/{badge}',
    call: () => api.grantBadge('guild', SNOWFLAKE, 'moddy_partner', {note: 'Partenariat signé'}),
    expected: {
      method: 'PUT',
      path: `/lineup/staff/badges/guild/${SNOWFLAKE}/moddy_partner`,
      body: {note: 'Partenariat signé'},
    },
  },
  {
    route: 'DELETE /lineup/staff/badges/{entity_type}/{entity_id}/{badge}',
    call: () => api.revokeBadge('user', SNOWFLAKE, 'lineup_verified'),
    expected: {method: 'DELETE', path: `/lineup/staff/badges/user/${SNOWFLAKE}/lineup_verified`},
  },
  {
    route: 'POST /lineup/staff/posts/{post_id}/hide',
    call: () => api.hidePost(UUID, {reason: 'Arnaque'}),
    expected: {method: 'POST', path: `/lineup/staff/posts/${UUID}/hide`, body: {reason: 'Arnaque'}},
  },
  {
    route: 'POST /lineup/staff/posts/{post_id}/unhide',
    call: () => api.unhidePost(UUID),
    expected: {method: 'POST', path: `/lineup/staff/posts/${UUID}/unhide`, body: undefined},
  },
  {
    route: 'GET /lineup/staff/reports',
    call: () => api.getStaffReports('open'),
    expected: {method: 'GET', path: '/lineup/staff/reports', query: 'status=open'},
  },
  {
    route: 'POST /lineup/staff/reports/{report_id}/resolve',
    call: () => api.resolveReport(UUID),
    expected: {method: 'POST', path: `/lineup/staff/reports/${UUID}/resolve`, body: undefined},
  },
  {
    route: 'POST /lineup/staff/reports/{report_id}/dismiss',
    call: () => api.dismissReport(UUID),
    expected: {method: 'POST', path: `/lineup/staff/reports/${UUID}/dismiss`, body: undefined},
  },
];

describe('endpoints', () => {
  it('covers 40 requests plus the sign-in navigation: the 41 routes', () => {
    expect(routes).toHaveLength(40);
    expect(new Set(routes.map((r) => r.route)).size).toBe(40);
  });

  for (const {route, call, expected} of routes) {
    it(route, async () => {
      const call_ = await sent(call);
      expect(call_.method).toBe(expected.method);
      expect(call_.path).toBe(expected.path);
      expect(call_.query).toBe(expected.query ?? '');
      expect(call_.body).toEqual(expected.body);
    });
  }

  it('matches the routes documented in LINEUP.md', () => {
    const doc = lineupDoc;
    const documented = new Set<string>();
    for (const [, method, path] of doc.matchAll(/^#### `(GET|POST|PUT|PATCH|DELETE) (\/lineup\/[^`]*)`/gm)) {
      documented.add(`${method} ${path}`);
      // "…/resolve` · `…/dismiss`": the second route shares the heading.
      if (path!.endsWith('/resolve')) documented.add(`${method} ${path!.replace(/resolve$/, 'dismiss')}`);
    }
    documented.delete('GET /lineup/auth/login');
    const implemented = new Set(
      routes.map((r) => r.route.replace(/\{entity_type\}\/\{entity_id\}/, '{entity_type}/{entity_id}')),
    );
    expect([...documented].sort()).toEqual([...implemented].sort());
    expect(documented.size).toBe(40);
  });

  it('encodes path parameters', async () => {
    const call = await sent(() => api.getPost('a/b c'));
    expect(call.path).toBe('/lineup/posts/a%2Fb%20c');
  });

  it('sends nothing for an empty note', async () => {
    const call = await sent(() => api.requestExperienceReview(UUID));
    expect(call.body).toBeUndefined();
  });

  it('puts snowflakes in bodies and queries as strings, untouched', async () => {
    const call = await sent(() =>
      api.createReport({target_type: 'user', target_id: '1234567890123456789', reason: 'spam'}),
    );
    expect(call.body).toEqual({target_type: 'user', target_id: '1234567890123456789', reason: 'spam'});
  });
});

describe('the sign-in URL (GET /lineup/auth/login)', () => {
  afterEach(() => api.setLoginUrlBuilder(null));

  it('goes to the API with the encoded destination', () => {
    expect(api.loginUrl('https://lineup.moddy.app/posts/abc?x=1')).toBe(
      `${config.apiBase}/lineup/auth/login?redirect=${encodeURIComponent('https://lineup.moddy.app/posts/abc?x=1')}`,
    );
  });

  it('passes a path of the site', () => {
    expect(api.loginUrl('/me/experiences')).toBe(
      `${config.apiBase}/lineup/auth/login?redirect=${encodeURIComponent('/me/experiences')}`,
    );
  });

  it('uses the login_url of a reauth error, relative to the API, but only a path', () => {
    expect(api.loginUrl('/me', '/lineup/auth/login')).toContain('/lineup/auth/login?redirect=');
    expect(api.loginUrl('/me', 'https://evil.example/x')).toBe(api.loginUrl('/me'));
    expect(api.loginUrl('/me', '//evil.example/x')).toBe(api.loginUrl('/me'));
  });

  it('lets the mock replace the builder', () => {
    api.setLoginUrlBuilder((redirect) => `/__mock/login?redirect=${encodeURIComponent(redirect)}`);
    expect(api.loginUrl('/me')).toBe('/__mock/login?redirect=%2Fme');
  });
});

describe('sanitizeRedirect (LINEUP.md §2)', () => {
  const site = 'https://lineup.moddy.app';

  it('keeps an https URL on moddy.app or a subdomain', () => {
    expect(api.sanitizeRedirect('https://lineup.moddy.app/posts/1?x=2#y', site)).toBe(
      'https://lineup.moddy.app/posts/1?x=2#y',
    );
    expect(api.sanitizeRedirect('https://moddy.app/violations', site)).toBe('https://moddy.app/violations');
    expect(api.sanitizeRedirect('https://a.b.moddy.app:443/x', site)).toBe('https://a.b.moddy.app/x');
  });

  it('keeps a path starting with a single slash', () => {
    expect(api.sanitizeRedirect('/me/experiences', site)).toBe('/me/experiences');
    expect(api.sanitizeRedirect('/guilds?q=a&b=c#d', site)).toBe('/guilds?q=a&b=c#d');
  });

  it('refuses other hosts, look-alikes, http, credentials, other ports and odd schemes', () => {
    for (const bad of [
      'https://evil.example/x',
      'https://evilmoddy.app/x',
      'https://moddy.app.evil.example/x',
      'http://lineup.moddy.app/x',
      'https://user:pass@lineup.moddy.app/x',
      'https://lineup.moddy.app:8443/x',
      'javascript:alert(1)',
      '//evil.example/x',
      '/\\evil.example',
      'https://lineup.moddy.app/\u0000x',
      'not a url',
      '',
    ]) {
      expect(api.sanitizeRedirect(bad, 'http://localhost:5173'), bad).toBe('/');
    }
  });

  it('turns an URL on the current (development) origin into its path', () => {
    expect(api.sanitizeRedirect('http://localhost:5173/posts/9?x=1#h', 'http://localhost:5173')).toBe('/posts/9?x=1#h');
    expect(api.sanitizeRedirect('http://localhost:5173/a', 'https://lineup.moddy.app')).toBe('/');
  });
});
