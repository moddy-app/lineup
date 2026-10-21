import {describe, expect, it} from 'vitest';

import {G, U} from './seed/ids';
import {createTestApi} from './testing';

describe('the seed', () => {
  it('serves the catalog', async () => {
    const api = createTestApi();
    const response = await api.call('GET', '/lineup/catalog');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(response.json.positions).toHaveLength(11);
  });

  it('walks the feed to the end, with a short page then an empty page that still has a cursor', async () => {
    const api = createTestApi();
    const sizes: number[] = [];
    const cursors: Array<string | null> = [];
    let cursor: string | null = null;
    let total = 0;
    do {
      const response = await api.call('GET', '/lineup/posts', {query: cursor ? {cursor} : {}});
      expect(response.status).toBe(200);
      sizes.push(response.json.items.length);
      cursors.push(response.json.next_cursor);
      total += response.json.items.length;
      cursor = response.json.next_cursor;
    } while (cursor);
    expect(sizes.some((size) => size === 0)).toBe(true);
    const emptyAt = sizes.findIndex((size) => size === 0);
    expect(cursors[emptyAt]).not.toBeNull();
    expect(sizes[0]).toBeLessThan(20);
    expect(total).toBeGreaterThan(15);
  });

  it('walks the directory with an empty page that carries a cursor', async () => {
    const api = createTestApi();
    const sizes: number[] = [];
    const cursors: Array<string | null> = [];
    let cursor: string | null = null;
    do {
      const response = await api.call('GET', '/lineup/guilds', {query: cursor ? {cursor} : {}});
      expect(response.status).toBe(200);
      sizes.push(response.json.items.length);
      cursors.push(response.json.next_cursor);
      cursor = response.json.next_cursor;
    } while (cursor);
    const emptyAt = sizes.findIndex((size) => size === 0);
    expect(emptyAt).toBeGreaterThanOrEqual(0);
    expect(cursors[emptyAt]).not.toBeNull();
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(8);
  });
});

describe('the seed’s integrity', () => {
  it('has the cast the brief asks for', () => {
    const {server} = createTestApi();
    const db = server.db;
    expect(Object.values(db.users).length).toBeGreaterThanOrEqual(16);
    const realProfiles = Object.values(db.profiles).filter((profile) => !/^spam-/.test(profile.invite_code));
    expect(realProfiles).toHaveLength(12);
    const statuses = new Set(Object.values(db.posts).map((post) => post.status));
    expect(statuses).toEqual(new Set(['draft', 'published', 'closed', 'hidden']));
    expect(
      Object.values(db.posts)
        .filter((post) => post.hidden_reason)
        .every((post) => post.status === 'hidden'),
    ).toBe(true);
    expect(new Set(Object.values(db.experiences).map((row) => row.status))).toEqual(
      new Set(['unverified', 'pending', 'verified', 'rejected']),
    );
    expect(new Set(Object.values(db.reports).map((report) => report.status))).toEqual(
      new Set(['open', 'resolved', 'dismissed']),
    );
    expect(Object.values(db.guilds).some((guild) => guild.nsfw_level === 3)).toBe(true);
    expect(Object.values(db.profiles).some((profile) => profile.theme === 'nsfw')).toBe(true);
    expect(Object.values(db.profiles).some((profile) => !profile.listed)).toBe(true);
    expect(Object.values(db.profiles).some((profile) => profile.invite_invalid)).toBe(true);
    expect(Object.values(db.users).filter((user) => user.sanction)).toHaveLength(2);
    expect(Object.values(db.users).some((user) => user.profile === null)).toBe(true);
    expect(db.badges.map((grant) => grant.badge)).toEqual(
      expect.arrayContaining(['lineup_verified', 'moddy_partner', 'moddy_server']),
    );
  });

  it('only references rows that exist, and features verified experiences of their author', () => {
    const {server} = createTestApi();
    const db = server.db;
    expect(new Set(Object.keys(db.posts)).size).toBe(Object.keys(db.posts).length);
    for (const post of Object.values(db.posts)) {
      expect(db.users[post.author_id], post.id).toBeDefined();
      if (post.kind === 'guild') {
        expect(post.guild_id, post.id).not.toBeNull();
        expect(db.guilds[post.guild_id ?? ''], post.id).toBeDefined();
        expect(db.profiles[post.guild_id ?? ''], post.id).toBeDefined();
        expect(post.featured_experience_id, post.id).toBeNull();
      }
      if (post.featured_experience_id) {
        const experience = db.experiences[post.featured_experience_id];
        expect(experience?.user_id, post.id).toBe(post.author_id);
        expect(experience?.status, post.id).toBe('verified');
      }
      expect(post.positions.includes('other'), post.id).toBe(post.positions_other.length > 0);
      expect(
        (post.status === 'published') === (post.published_at !== null) || post.status !== 'published',
        post.id,
      ).toBe(true);
    }
    for (const row of Object.values(db.experiences)) {
      expect(db.users[row.user_id], row.id).toBeDefined();
      if (row.kind === 'guild') expect(db.guilds[row.guild_id ?? ''], row.id).toBeDefined();
      if (row.status === 'verified') expect(row.method, row.id).not.toBeNull();
      if (row.end_date) expect(row.end_date >= row.start_date, row.id).toBe(true);
    }
    for (const invite of Object.values(db.invites)) {
      if (invite.kind === 'guild') expect(db.guilds[invite.guild_id ?? ''], invite.code).toBeDefined();
    }
    for (const profile of Object.values(db.profiles)) {
      expect(db.guilds[profile.guild_id], profile.guild_id).toBeDefined();
    }
  });

  it('keeps every quota example in range', () => {
    const {server} = createTestApi();
    const live = Object.values(server.db.posts).filter(
      (post) =>
        post.status === 'published' &&
        !(post.expires_at && Date.parse(post.expires_at) <= Date.parse('2026-10-20T14:00:00Z')),
    );
    expect(live.filter((post) => post.guild_id === G.atelier)).toHaveLength(5);
    expect(live.filter((post) => post.kind === 'user' && post.author_id === U.camille)).toHaveLength(2);
    for (const guild of Object.values(G)) {
      expect(live.filter((post) => post.guild_id === guild).length, guild).toBeLessThanOrEqual(5);
    }
  });
});
