import {describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';

import {G, U} from '../seed/ids';
import {createTestApi} from '../testing';
import {DISCORD_FLAG_BADGES} from './badges';

const ids = (badges: Array<{id: string}>) => badges.map((badge) => badge.id);
const CATALOG_ORDER = catalogFixture.badges.map((badge) => badge.id as string);
const inCatalogOrder = (list: string[]) =>
  [...list].sort((a, b) => CATALOG_ORDER.indexOf(a) - CATALOG_ORDER.indexOf(b));

async function guildBadges(api: ReturnType<typeof createTestApi>, id: string) {
  return (await api.call('GET', `/lineup/guilds/${id}`)).json.badges as Array<{id: string; source: string}>;
}

describe('server badges (§10)', () => {
  it('computes Discord verified and partner from the features, Moddy from the snapshot, premium from the server', async () => {
    const api = createTestApi();
    const db = api.server.db;
    const guild = db.guilds[G.pixel];
    if (!guild) throw new Error('no guild');
    expect(ids(await guildBadges(api, G.pixel))).toEqual([]);
    guild.features = ['VERIFIED', 'PARTNERED'];
    expect(ids(await guildBadges(api, G.pixel))).toEqual(['discord_verified', 'discord_partner']);
    const profile = db.profiles[G.pixel];
    if (!profile) throw new Error('no profile');
    profile.has_moddy = true;
    guild.premium_effective = true;
    expect(ids(await guildBadges(api, G.pixel))).toEqual([
      'discord_verified',
      'discord_partner',
      'moddy_installed',
      'moddy_premium',
    ]);
    guild.premium_effective = false;
    expect(ids(await guildBadges(api, G.pixel))).not.toContain('moddy_premium');
  });

  it('gives the nsfw badge for Discord level 1 or 3 only, not for the Lineup theme', async () => {
    const api = createTestApi();
    expect(ids(await guildBadges(api, G.velvet))).not.toContain('nsfw');
    expect(api.server.db.profiles[G.velvet]?.theme).toBe('nsfw');
    expect(ids(await guildBadges(api, G.nox))).toContain('nsfw');
    const velvet = api.server.db.guilds[G.velvet];
    if (!velvet) throw new Error('no guild');
    for (const level of [1, 3] as const) {
      velvet.nsfw_level = level;
      expect(ids(await guildBadges(api, G.velvet))).toContain('nsfw');
    }
    velvet.nsfw_level = 2;
    expect(ids(await guildBadges(api, G.velvet))).not.toContain('nsfw');
  });

  it('keeps moddy_installed as old as the snapshot, and drops it once the snapshot is refreshed after the bot left', async () => {
    const api = createTestApi('leo');
    // Dev Corner: the bot left, the 3-day-old snapshot cannot be refreshed.
    expect(ids(await guildBadges(api, G.devcorner))).toContain('moddy_installed');
    const profile = api.server.db.profiles[G.devcorner];
    if (!profile) throw new Error('no profile');
    profile.refresh_blocked = false;
    const refreshed = await api.call('POST', `/lineup/guilds/${G.devcorner}/refresh`);
    expect(ids(refreshed.json.badges)).not.toContain('moddy_installed');
    expect(refreshed.json.has_moddy).toBe(false);
  });

  it('renders computed and manual badges together, always in the catalog order', async () => {
    const api = createTestApi();
    const db = api.server.db;
    const guild = db.guilds[G.pixel];
    const profile = db.profiles[G.pixel];
    if (!guild || !profile) throw new Error('no guild');
    guild.features = ['VERIFIED', 'PARTNERED'];
    guild.nsfw_level = 1;
    guild.premium_effective = true;
    profile.has_moddy = true;
    // Granted in the "wrong" order on purpose.
    for (const badge of ['moddy_server', 'lineup_verified', 'moddy_partner']) {
      db.badges.push({
        entity_type: 'guild',
        entity_id: G.pixel,
        badge,
        granted_by: U.noe,
        granted_at: '2026-10-01T10:00:00.000000+00:00',
        note: null,
      });
    }
    const badges = await guildBadges(api, G.pixel);
    expect(ids(badges)).toEqual([
      'discord_verified',
      'discord_partner',
      'moddy_installed',
      'moddy_premium',
      'nsfw',
      'lineup_verified',
      'moddy_partner',
      'moddy_server',
    ]);
    expect(badges.map((badge) => badge.source)).toEqual([
      'computed',
      'computed',
      'computed',
      'computed',
      'computed',
      'manual',
      'manual',
      'manual',
    ]);
    // The directory card has them all but moddy_premium (follow the cursors: pages can be short or empty).
    let found: Array<{id: string}> | undefined;
    let cursor: string | null = null;
    do {
      const page = await api.call('GET', '/lineup/guilds', {
        query: {limit: '50', include_nsfw: 'true', ...(cursor ? {cursor} : {})},
      });
      found ??= (page.json.items as Array<{id: string; badges: Array<{id: string}>}>).find(
        (item) => item.id === G.pixel,
      )?.badges;
      cursor = page.json.next_cursor;
    } while (cursor);
    expect(ids(found ?? [])).toEqual([
      'discord_verified',
      'discord_partner',
      'moddy_installed',
      'nsfw',
      'lineup_verified',
      'moddy_partner',
      'moddy_server',
    ]);
  });

  it('shows a manual badge on the server the moment the staff grants it, and removes it with the grant', async () => {
    const api = createTestApi('noe');
    expect(ids(await guildBadges(api, G.arena))).not.toContain('moddy_partner');
    await api.call('PUT', `/lineup/staff/badges/guild/${G.arena}/moddy_partner`, {body: {note: 'Partenariat'}});
    expect(ids(await guildBadges(api, G.arena))).toContain('moddy_partner');
    await api.call('DELETE', `/lineup/staff/badges/guild/${G.arena}/moddy_partner`);
    expect(ids(await guildBadges(api, G.arena))).not.toContain('moddy_partner');
  });
});

describe('person badges (§10, §5)', () => {
  const badgesOf = async (api: ReturnType<typeof createTestApi>, user: string) =>
    (await api.call('GET', `/lineup/users/${user}`)).json.badges as Array<{id: string; source: string}>;

  it('puts Moddy’s computed badges first, then Discord’s public flags, then the manual ones', async () => {
    const api = createTestApi();
    const noe = api.server.db.users[U.noe];
    if (!noe) throw new Error('no user');
    noe.public_flags = 1 << 0; // discord_staff
    api.server.db.badges.push({
      entity_type: 'user',
      entity_id: U.noe,
      badge: 'moddy_partner',
      granted_by: U.noe,
      granted_at: '2026-10-01T10:00:00.000000+00:00',
      note: null,
    });
    expect((await badgesOf(api, U.noe)).map((badge) => `${badge.id}:${badge.source}`)).toEqual([
      'moddy_premium:computed',
      'moddy_staff:computed',
      'discord_staff:discord',
      'moddy_partner:manual',
    ]);
  });

  it('maps every public flag to its badge, and ignores the bits the catalog leaves out', async () => {
    const api = createTestApi();
    const person = api.server.db.users[U.theo];
    if (!person) throw new Error('no user');
    expect(DISCORD_FLAG_BADGES.map(([, badge]) => badge).sort()).toEqual(
      catalogFixture.badges
        .filter((badge) => badge.source === 'discord')
        .map((badge) => badge.id as string)
        .sort(),
    );
    for (const [bit, badge] of DISCORD_FLAG_BADGES) {
      person.public_flags = bit;
      expect(ids(await badgesOf(api, U.theo)), badge).toEqual([badge]);
    }
    // TEAM_PSEUDO_USER (1 << 10) and BOT_HTTP_INTERACTIONS (1 << 19) are not badges.
    person.public_flags = (1 << 10) | (1 << 19);
    expect(await badgesOf(api, U.theo)).toEqual([]);
  });

  it('renders all of them in the catalog order whatever the flag bits order', async () => {
    const api = createTestApi();
    const person = api.server.db.users[U.theo];
    if (!person) throw new Error('no user');
    person.public_flags = DISCORD_FLAG_BADGES.reduce((all, [bit]) => all | bit, 0);
    person.premium = true;
    const list = ids(await badgesOf(api, U.theo));
    expect(list).toEqual(inCatalogOrder(list));
    expect(list[0]).toBe('moddy_premium');
    expect(list).toHaveLength(1 + DISCORD_FLAG_BADGES.length);
  });

  it('cuts Moddy Premium on a global sanction', async () => {
    const api = createTestApi('noe');
    const dylan = api.server.db.users[U.dylan];
    if (!dylan) throw new Error('no user');
    dylan.premium = true;
    expect(ids(await badgesOf(api, U.dylan))).not.toContain('moddy_premium');
    dylan.sanction = null;
    expect(ids(await badgesOf(api, U.dylan))).toContain('moddy_premium');
  });

  it('never lets the staff grant a computed or a Discord badge', async () => {
    const api = createTestApi('noe');
    for (const badge of ['moddy_premium', 'moddy_staff', 'nsfw', 'discord_staff', 'discord_verified']) {
      const response = await api.call('PUT', `/lineup/staff/badges/user/${U.camille}/${badge}`);
      expect([response.status, response.json.code], badge).toEqual([422, 'lineup_badge_invalid']);
    }
  });
});

describe('badges on summaries (post.guild, post.author, team, me)', () => {
  type Item = {
    kind: string;
    guild: {id: string; badges?: Array<{id: string}>} | null;
    author: {id: string; badges?: Array<{id: string}>};
  };

  async function feed(api: ReturnType<typeof createTestApi>): Promise<Item[]> {
    const items: Item[] = [];
    let cursor: string | null = null;
    do {
      const response: Awaited<ReturnType<typeof api.call>> = await api.call('GET', '/lineup/posts', {
        query: cursor ? {cursor} : {},
      });
      items.push(...response.json.items);
      cursor = response.json.next_cursor;
    } while (cursor);
    return items;
  }

  it('gives the verification badges of a server and of an author in the feed, never Discord’s', async () => {
    const api = createTestApi();
    const items = await feed(api);
    const moddyPost = items.find((item) => item.guild?.id === G.moddy);
    expect(ids(moddyPost?.guild?.badges ?? [])).toEqual(expect.arrayContaining(['moddy_server', 'lineup_verified']));
    expect(ids(moddyPost?.author.badges ?? [])).toContain('moddy_staff');
    const cubelands = items.find((item) => item.guild?.id === G.cubelands);
    expect(ids(cubelands?.guild?.badges ?? [])).toContain('lineup_verified');
    for (const item of items) {
      for (const entry of [...(item.guild?.badges ?? []), ...(item.author.badges ?? [])]) {
        expect(entry.id.startsWith('discord_')).toBe(false);
      }
    }
  });

  it('has a personal post by a verified account in the feed', async () => {
    const items = await feed(createTestApi());
    const verifiedPersonal = items.filter(
      (item) => item.kind === 'user' && ids(item.author.badges ?? []).includes('lineup_verified'),
    );
    expect(verifiedPersonal.length).toBeGreaterThan(0);
  });

  it('gives badges to the team of a server and to the session', async () => {
    const api = createTestApi('noe');
    const me = await api.call('GET', '/lineup/me');
    expect(ids(me.json.user.badges)).toContain('moddy_staff');
    const camille = createTestApi('camille');
    expect((await camille.call('GET', '/lineup/me')).json.user.badges).toEqual([]);
    const team = (await api.call('GET', `/lineup/guilds/${G.cubelands}`)).json.team as Array<{
      user: {id: string; badges?: Array<{id: string}>};
    }>;
    expect(team.length).toBeGreaterThan(0);
    for (const member of team) expect(Array.isArray(member.user.badges)).toBe(true);
  });
});
