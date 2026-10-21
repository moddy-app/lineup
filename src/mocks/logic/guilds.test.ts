import {describe, expect, it} from 'vitest';

import {G, postId, U} from '../seed/ids';
import {createTestApi} from '../testing';

const code = (response: {json: {code?: string}}) => response.json.code;

describe('the directory', () => {
  const names = (response: {json: {items: Array<{name: string}>}}) => response.json.items.map((item) => item.name);

  it('lists listed profiles, newest claim first, without NSFW and unlisted servers, with the cache header', async () => {
    const api = createTestApi();
    const response = await api.call('GET', '/lineup/guilds');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(names(response)).toEqual(['Dev Corner', 'Arena Esport FR', 'Lumen Study', 'Pixel Forge']);
    expect(response.json.next_cursor).not.toBeNull();
  });

  it('puts NSFW servers back with include_nsfw, never the unlisted one', async () => {
    const api = createTestApi();
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await api.call('GET', '/lineup/guilds', {
        query: cursor ? {include_nsfw: '1', cursor} : {include_nsfw: '1'},
      });
      seen.push(...names(page));
      cursor = page.json.next_cursor;
    } while (cursor);
    expect(seen).toContain('Velvet Lounge');
    expect(seen).toContain('Nox After Dark');
    expect(seen).not.toContain("Terres d'Hyrule RP");
    expect(seen.some((name) => /#\d+$/.test(name) || name === 'Trade Hub Gains')).toBe(false);
    expect(seen).toHaveLength(10);
  });

  it('filters by theme and q (name, Lineup description, Discord description), case-insensitively', async () => {
    const api = createTestApi();
    expect(names(await api.call('GET', '/lineup/guilds', {query: {theme: 'esport'}}))).toEqual(['Arena Esport FR']);
    expect(names(await api.call('GET', '/lineup/guilds', {query: {q: 'CUBELANDS'}}))).toEqual(['Cubelands FR']);
    expect(names(await api.call('GET', '/lineup/guilds', {query: {q: 'ellandre'}}))).toEqual(['Atelier du Phénix']);
    expect(names(await api.call('GET', '/lineup/guilds', {query: {q: 'game developers'}}))).toEqual(['Pixel Forge']);
  });

  it('answers theme_invalid, cursor_invalid and standard 422s', async () => {
    const api = createTestApi();
    expect((await api.call('GET', '/lineup/guilds', {query: {theme: 'cooking'}})).json).toMatchObject({
      code: 'theme_invalid',
    });
    expect(code(await api.call('GET', '/lineup/guilds', {query: {cursor: 'x'}}))).toBe('cursor_invalid');
    expect((await api.call('GET', '/lineup/guilds', {query: {limit: '51'}})).json.detail[0].type).toBe(
      'less_than_equal',
    );
    expect((await api.call('GET', '/lineup/guilds', {query: {q: 'x'.repeat(101)}})).json.detail[0].type).toBe(
      'string_too_long',
    );
  });

  it('leaves moddy_premium out of the cards but not out of the profile', async () => {
    const api = createTestApi();
    const cards = await api.call('GET', '/lineup/guilds', {query: {limit: '50', include_nsfw: 'true'}});
    const all = JSON.stringify(cards.json);
    expect(all).not.toContain('moddy_premium');
    expect(all).toContain('moddy_installed');
    const profile = await api.call('GET', `/lineup/guilds/${G.cubelands}`);
    expect(profile.json.badges.map((badge: {id: string}) => badge.id)).toEqual([
      'moddy_installed',
      'moddy_premium',
      'lineup_verified',
    ]);
  });
});

describe('a server profile', () => {
  it('builds the full profile of §6.2', async () => {
    const api = createTestApi();
    const response = await api.call('GET', `/lineup/guilds/${G.atelier}`);
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      id: G.atelier,
      name: 'Atelier du Phénix',
      icon_url: null,
      invite: {code: 'atelier-phenix', url: 'https://discord.gg/atelier-phenix', valid: true},
      theme: 'roleplay',
      boosts: 5,
      boost_tier: 1,
      member_count: 1860,
      has_moddy: true,
      listed: true,
      stale: false,
      can_manage: false,
      discord_description: "Serveur de jeu de rôle textuel dans le royaume d'Ellandre.",
    });
    expect(response.json.description).toMatch(/^Un jeu de rôle textuel/);
    // The server's creation date is read back from its snowflake.
    expect(response.json.created_at).toBe('2022-06-03T12:00:07.000000+00:00');
    expect(response.json.posts).toHaveLength(5);
    expect(response.json.team).toMatchObject([
      {user: {id: U.camille, display_name: 'Camille'}, position: 'admin', since: '2022-06-03'},
    ]);
  });

  it('falls back on the Discord description when there is no Lineup one', async () => {
    const api = createTestApi('camille');
    await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {description: null}});
    const response = await api.call('GET', `/lineup/guilds/${G.atelier}`);
    expect(response.json.description).toBe(response.json.discord_description);
  });

  it('computes can_manage from the session, quietly when Discord is silent', async () => {
    const api = createTestApi('camille');
    expect((await api.call('GET', `/lineup/guilds/${G.atelier}`)).json.can_manage).toBe(true);
    expect((await api.call('GET', `/lineup/guilds/${G.pixel}`)).json.can_manage).toBe(true);
    expect((await api.call('GET', `/lineup/guilds/${G.cubelands}`)).json.can_manage).toBe(false);
    api.as('ines');
    api.state.discordDown = true;
    expect((await api.call('GET', `/lineup/guilds/${G.atelier}`)).json.can_manage).toBe(false);
  });

  it('computes the team: verified, current, usable and not suspended; one line per person, oldest first', async () => {
    const api = createTestApi();
    const team = (await api.call('GET', `/lineup/guilds/${G.cubelands}`)).json.team;
    expect(team.map((member: {user: {id: string}}) => member.user.id)).toEqual([U.alex, U.hugo, U.lucie]);
    expect(team[0]).toMatchObject({
      user: {username: 'alex', display_name: 'Alex', avatar_decoration: {asset: 'a_7f3b2c91e0d44f6a8b1c'}},
      position: 'admin',
      since: '2021-02-14',
    });
    // Ending an experience takes the person off the team.
    const experience = Object.values(api.server.db.experiences).find(
      (row) => row.user_id === U.hugo && row.guild_id === G.cubelands,
    );
    if (experience) experience.end_date = '2026-01-01';
    const after = (await api.call('GET', `/lineup/guilds/${G.cubelands}`)).json.team;
    expect(after.map((member: {user: {id: string}}) => member.user.id)).toEqual([U.alex, U.lucie]);
  });

  it('hides an unlisted server from visitors, shows it to its managers and the staff', async () => {
    const api = createTestApi();
    expect(code(await api.call('GET', `/lineup/guilds/${G.hyrule}`))).toBe('lineup_guild_not_found');
    api.as('leo');
    expect((await api.call('GET', `/lineup/guilds/${G.hyrule}`)).json).toMatchObject({listed: false, can_manage: true});
    api.as('noe');
    expect((await api.call('GET', `/lineup/guilds/${G.hyrule}`)).status).toBe(200);
  });

  it('answers 404 for a suspended server, except to the staff', async () => {
    const api = createTestApi();
    expect(code(await api.call('GET', `/lineup/guilds/${G.trade}`))).toBe('lineup_guild_not_found');
    api.as('noe');
    expect((await api.call('GET', `/lineup/guilds/${G.trade}`)).status).toBe(200);
  });

  it('does not block a NSFW server, and gives it the nsfw badge when Discord says so', async () => {
    const api = createTestApi();
    const velvet = await api.call('GET', `/lineup/guilds/${G.velvet}`);
    expect([velvet.status, velvet.json.theme]).toEqual([200, 'nsfw']);
    const nox = await api.call('GET', `/lineup/guilds/${G.nox}`);
    expect(nox.json.badges.map((badge: {id: string}) => badge.id)).toContain('nsfw');
    expect(velvet.json.badges.map((badge: {id: string}) => badge.id)).not.toContain('nsfw');
  });

  it('reports a deleted invitation, a stale snapshot and unknown or malformed ids', async () => {
    const api = createTestApi();
    expect((await api.call('GET', `/lineup/guilds/${G.lumen}`)).json.invite.valid).toBe(false);
    const stale = await api.call('GET', `/lineup/guilds/${G.devcorner}`);
    expect([stale.json.stale, stale.json.has_moddy]).toEqual([true, true]);
    expect(code(await api.call('GET', '/lineup/guilds/123'))).toBe('lineup_guild_not_found');
    expect((await api.call('GET', '/lineup/guilds/abc')).json.detail[0]).toMatchObject({
      type: 'int_parsing',
      loc: ['path', 'guild_id'],
    });
  });

  it('serves an old snapshot with stale: true when Discord is silent, an error never', async () => {
    const api = createTestApi();
    const profile = api.server.db.profiles[G.pixel];
    if (profile) profile.snapshot_at = '2026-10-19T00:00:00.000000+00:00';
    api.state.discordDown = true;
    const down = await api.call('GET', `/lineup/guilds/${G.pixel}`);
    expect([down.status, down.json.stale]).toEqual([200, true]);
    api.state.discordDown = false;
    expect((await api.call('GET', `/lineup/guilds/${G.pixel}`)).json.stale).toBe(false);
  });

  it('lists only the live posts: published, unexpired, 20 at most, NSFW included', async () => {
    const api = createTestApi();
    const velvet = await api.call('GET', `/lineup/guilds/${G.velvet}`);
    expect(velvet.json.posts.map((post: {id: string}) => post.id)).toEqual([postId(21)]);
    const cubelands = await api.call('GET', `/lineup/guilds/${G.cubelands}`);
    expect(cubelands.json.posts.map((post: {id: string}) => post.id)).toEqual([postId(3), postId(2), postId(1)]);
  });
});

describe('claiming a server by invitation (§3)', () => {
  const claim = (api: ReturnType<typeof createTestApi>, invite: string) =>
    api.call('POST', '/lineup/guilds/claim', {body: {invite}});

  it('claims with 201 and the full profile, whatever the form of the invitation', async () => {
    for (const form of [
      'cafe-des-mods',
      'https://discord.gg/cafe-des-mods',
      'https://discord.com/invite/cafe-des-mods',
      'https://discordapp.com/invite/cafe-des-mods',
    ]) {
      const api = createTestApi('camille');
      const response = await claim(api, form);
      expect(response.status, form).toBe(201);
      expect(response.json).toMatchObject({
        id: G.cafe,
        name: 'Café des Mods',
        can_manage: true,
        listed: true,
        posts: [],
        team: [],
        has_moddy: true,
      });
      expect(response.json.invite).toEqual({
        code: 'cafe-des-mods',
        url: 'https://discord.gg/cafe-des-mods',
        valid: true,
      });
    }
  });

  it('claims a server without Moddy, and accepts a vanity URL', async () => {
    const api = createTestApi('camille');
    expect((await claim(api, 'studio-nocturne')).json).toMatchObject({id: G.studio, has_moddy: false});
    const vanity = createTestApi('camille');
    vanity.server.db.members.push({
      user_id: U.camille,
      guild_id: G.anime,
      owner: false,
      permissions: ['MANAGE_GUILD'],
      role_count: 1,
    });
    delete vanity.server.db.guildListCache[U.camille];
    delete vanity.server.db.profiles[G.anime];
    expect((await claim(vanity, 'animeplaza')).status).toBe(201);
  });

  it('checks in the documented order: invitation, then rights, then duplicate', async () => {
    const api = createTestApi('camille');
    expect(code(await claim(api, 'not a code!!'))).toBe('invite_invalid');
    expect(code(await claim(api, 'http://discord.gg/cafe-des-mods'))).toBe('invite_invalid');
    expect(code(await claim(api, 'https://example.com/invite/cafe'))).toBe('invite_invalid');
    expect(code(await claim(api, 'groupe-mp'))).toBe('invite_invalid');
    expect((await claim(api, 'ami-ouvert')).status).toBe(422);
    expect(code(await claim(api, 'zzz999'))).toBe('invite_not_found');
    expect(code(await claim(api, 'vieux-code'))).toBe('invite_not_found');
    expect(code(await claim(api, 'nocturne-temp'))).toBe('invite_expiring');
    // Rights come before the duplicate: Camille does not manage Cubelands, which is claimed.
    expect(code(await claim(api, 'cubelands'))).toBe('lineup_guild_forbidden');
    // Not a member at all.
    expect(code(await claim(api, 'lumiere'))).toBe('lineup_guild_forbidden');
    const duplicate = await claim(api, 'atelier-phenix');
    expect(duplicate.status).toBe(409);
    expect(duplicate.json).toMatchObject({
      code: 'lineup_guild_already_claimed',
      guild_id: G.atelier,
      error: {guild_id: G.atelier},
    });
  });

  it('answers a sanction object for a suspended server the person manages (the seed has one for Camille)', async () => {
    const api = createTestApi('camille');
    const response = await claim(api, 'marche-arcanes');
    expect(response.status).toBe(403);
    expect(response.json).toEqual({
      error: {
        code: 'guild_suspended',
        level: 'ban',
        subject_type: 'guild',
        subject_id: G.marche,
        references: ['R5T3N7'],
        expires_at: null,
        message: 'Ce serveur est suspendu.',
        violations_url: 'https://moddy.app/violations',
      },
    });
    // The staff pass the sanction (a server nobody claimed yet becomes claimable for them).
    const staff = createTestApi('noe');
    expect((await claim(staff, 'marche-arcanes')).status).toBe(201);
  });

  it('shows the stale-cache flow: forbidden until the list is refreshed', async () => {
    const api = createTestApi('camille');
    expect(code(await claim(api, 'corbeau-guilde'))).toBe('lineup_guild_forbidden');
    const before = (await api.call('GET', '/lineup/me/guilds')).json as Array<{id: string}>;
    expect(before.map((entry) => entry.id)).not.toContain(G.corbeau);
    const refreshed = await api.call('POST', '/lineup/me/refresh-guilds');
    expect(refreshed.json.stale).toBe(false);
    expect(refreshed.json.guilds.map((entry: {id: string}) => entry.id)).toContain(G.corbeau);
    expect((await claim(api, 'corbeau-guilde')).status).toBe(201);
  });

  it('answers 503 when Discord is needed, but a malformed invitation is still refused first', async () => {
    const api = createTestApi('camille');
    api.state.discordDown = true;
    const down = await claim(api, 'cafe-des-mods');
    expect([down.status, down.headers.get('Retry-After'), code(down)]).toEqual([503, '30', 'discord_unavailable']);
    expect(code(await claim(api, 'not a code!!'))).toBe('invite_invalid');
  });

  it('validates the body', async () => {
    const api = createTestApi('camille');
    expect((await api.call('POST', '/lineup/guilds/claim', {body: {invite: 'a'}})).json.detail[0].type).toBe(
      'string_too_short',
    );
    expect(
      (await api.call('POST', '/lineup/guilds/claim', {body: {invite: 'a'.repeat(201)}})).json.detail[0].type,
    ).toBe('string_too_long');
    expect(
      (await api.call('POST', '/lineup/guilds/claim', {body: {invite: 'abc', extra: 1}})).json.detail[0].type,
    ).toBe('extra_forbidden');
    expect((await api.call('POST', '/lineup/guilds/claim', {body: {}})).json.detail[0].type).toBe('missing');
    expect((await api.call('POST', '/lineup/guilds/claim')).json.detail[0]).toMatchObject({
      type: 'missing',
      loc: ['body'],
    });
  });
});

describe('editing, refreshing and my servers', () => {
  it('changes only the fields sent, and normalizes them', async () => {
    const api = createTestApi('camille');
    const response = await api.call('PUT', `/lineup/guilds/${G.atelier}`, {
      body: {
        tags: ['  RP  ', 'rp', 'fantasy'],
        theme: 'art',
        listed: false,
        links: [{label: 'Site', url: 'https://x.example.com'}],
      },
    });
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      tags: ['rp', 'fantasy'],
      theme: 'art',
      listed: false,
      languages: ['fr'],
      can_manage: true,
    });
    expect((await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {theme: null}})).json.theme).toBeNull();
  });

  it('refuses nulls on links, tags, languages and listed, and more than 5 links', async () => {
    const api = createTestApi('camille');
    for (const field of ['links', 'tags', 'languages', 'listed']) {
      expect((await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {[field]: null}})).status, field).toBe(422);
    }
    const links = Array.from({length: 6}, (_, i) => ({label: `L${i}`, url: 'https://x.example.com'}));
    expect((await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {links}})).json.detail[0].type).toBe(
      'too_long',
    );
    expect(
      (
        await api.call('PUT', `/lineup/guilds/${G.atelier}`, {
          body: {links: [{label: 'x', url: 'http://x.example.com'}]},
        })
      ).json.detail[0].loc,
    ).toEqual(['body', 'links', 0, 'url']);
  });

  it('changes the invitation to a permanent one of the SAME server', async () => {
    const api = createTestApi('camille');
    const ok = await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {invite: 'https://discord.gg/atelier'}});
    expect(ok.json.invite).toMatchObject({code: 'atelier', valid: true});
    expect(code(await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {invite: 'cubelands'}}))).toBe(
      'invite_guild_mismatch',
    );
    await api.call('POST', '/lineup/guilds/claim', {body: {invite: 'studio-nocturne'}});
    expect(code(await api.call('PUT', `/lineup/guilds/${G.studio}`, {body: {invite: 'nocturne-temp'}}))).toBe(
      'invite_expiring',
    );
    expect(code(await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {invite: 'zzz999'}}))).toBe(
      'invite_not_found',
    );
    expect((await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {invite: null}})).status).toBe(200);
  });

  it('checks a PUT in the documented order when several conditions fail together', async () => {
    const put = (api: ReturnType<typeof createTestApi>, id: string, body: unknown) =>
      api.call('PUT', `/lineup/guilds/${id}`, {body});
    const api = createTestApi();
    // 1. Validation before the session.
    expect((await put(api, G.atelier, {description: 5})).status).toBe(422);
    expect((await api.call('PUT', '/lineup/guilds/not-a-snowflake', {body: {}})).status).toBe(422);
    expect((await put(api, G.atelier, {})).status).toBe(401);
    // 3. An unknown invite on a server she does not manage: forbidden first.
    api.as('camille');
    expect(code(await put(api, G.cubelands, {invite: 'zzz999'}))).toBe('lineup_guild_forbidden');
    // Discord silent: undecidable rights (not in the session list) give 503 before anything else.
    api.state.discordDown = true;
    api.server.db.guildListCache = {};
    expect((await put(api, G.cubelands, {invite: 'zzz999'})).status).toBe(503);
    // 4. No profile before the invitation.
    api.state.discordDown = false;
    expect(code(await put(api, G.cafe, {invite: 'zzz999'}))).toBe('lineup_guild_not_found');
    // 5. Unreadable format before Discord's silence, then 503, then the rest; nothing is written on a failure.
    expect(code(await put(api, G.atelier, {invite: 'not a code!!', listed: false}))).toBe('invite_invalid');
    api.state.discordDown = true;
    expect((await put(api, G.atelier, {invite: 'zzz999', listed: false})).status).toBe(503);
    api.state.discordDown = false;
    expect(code(await put(api, G.atelier, {invite: 'groupe-mp', listed: false}))).toBe('invite_invalid');
    expect(code(await put(api, G.atelier, {invite: 'cubelands', listed: false}))).toBe('invite_guild_mismatch');
    expect((await api.call('GET', `/lineup/guilds/${G.atelier}`)).json.listed).toBe(true);
    // 6. Success writes.
    expect((await put(api, G.atelier, {invite: 'atelier', listed: false})).json.listed).toBe(false);
  });

  it('checks the rights again on every write: 401, 403, 404 without a profile', async () => {
    const api = createTestApi();
    expect((await api.call('PUT', `/lineup/guilds/${G.atelier}`, {body: {}})).status).toBe(401);
    api.as('camille');
    expect(code(await api.call('PUT', `/lineup/guilds/${G.cubelands}`, {body: {listed: false}}))).toBe(
      'lineup_guild_forbidden',
    );
    expect(code(await api.call('PUT', `/lineup/guilds/${G.cafe}`, {body: {listed: false}}))).toBe(
      'lineup_guild_not_found',
    );
    expect(code(await api.call('DELETE', `/lineup/guilds/${G.cubelands}`))).toBe('lineup_guild_forbidden');
    api.as('noe');
    expect((await api.call('PUT', `/lineup/guilds/${G.cubelands}`, {body: {listed: false}})).status).toBe(200);
  });

  it('answers 503 on a write when the rights cannot be decided', async () => {
    const api = createTestApi('ines');
    api.state.discordDown = true;
    const response = await api.call('PUT', `/lineup/guilds/${G.chroniqueurs}`, {body: {listed: false}});
    expect([response.status, response.headers.get('Retry-After')]).toEqual([503, '30']);
  });

  it('refreshes once a minute per server, rights first', async () => {
    const api = createTestApi('camille');
    const first = await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`);
    expect([first.status, first.json.stale]).toEqual([200, false]);
    const second = await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`);
    expect(second.status).toBe(429);
    expect(second.json.code).toBe('lineup_rate_limited');
    expect(second.json.retry_after).toBeGreaterThanOrEqual(1);
    expect(second.json.retry_after).toBeLessThanOrEqual(60);
    expect(second.headers.get('Retry-After')).toBe(String(second.json.retry_after));
    // The limit is per server, and the rights check comes first.
    expect((await api.call('POST', `/lineup/guilds/${G.pixel}/refresh`)).status).toBe(200);
    expect(code(await api.call('POST', `/lineup/guilds/${G.cubelands}/refresh`))).toBe('lineup_guild_forbidden');
    api.state.now = new Date(api.state.now.getTime() + 61_000);
    expect((await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`)).status).toBe(200);
    expect(code(await api.call('POST', `/lineup/guilds/${G.cafe}/refresh`))).toBe('lineup_guild_not_found');
  });

  it('answers stale: true when Discord does not answer the refresh', async () => {
    const api = createTestApi('camille');
    api.state.discordDown = true;
    expect((await api.call('POST', `/lineup/guilds/${G.atelier}/refresh`)).json.stale).toBe(true);
    const blocked = createTestApi('leo');
    expect((await blocked.call('POST', `/lineup/guilds/${G.devcorner}/refresh`)).json.stale).toBe(true);
  });

  it('lists my servers by name, claimed or not, with the live state of the bot', async () => {
    const api = createTestApi('camille');
    const response = await api.call('GET', '/lineup/me/guilds');
    expect(response.json).toEqual([
      {id: G.atelier, name: 'Atelier du Phénix', icon_url: null, has_moddy: true, claimed: true},
      {id: G.cafe, name: 'Café des Mods', icon_url: null, has_moddy: true, claimed: false},
      {id: G.marche, name: 'Marché des Arcanes', icon_url: null, has_moddy: false, claimed: false},
      {id: G.pixel, name: 'Pixel Forge', icon_url: null, has_moddy: false, claimed: true},
      {id: G.studio, name: 'Studio Nocturne', icon_url: null, has_moddy: false, claimed: false},
    ]);
  });

  it('degrades to the session’s Moddy servers when Discord is silent, and says so on refresh-guilds', async () => {
    const api = createTestApi('ines');
    api.state.discordDown = true;
    expect((await api.call('GET', '/lineup/me/guilds')).json).toEqual([]);
    const refreshed = await api.call('POST', '/lineup/me/refresh-guilds');
    expect(refreshed.json).toEqual({guilds: [], stale: true});
    api.state.discordDown = false;
    expect((await api.call('GET', '/lineup/me/guilds')).json).toEqual([
      {id: G.chroniqueurs, name: 'Les Chroniqueurs', icon_url: null, has_moddy: false, claimed: false},
    ]);
  });
});
