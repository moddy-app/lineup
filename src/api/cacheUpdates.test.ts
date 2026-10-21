import {describe, expect, it} from 'vitest';

import {
  belongsToMyPosts,
  closedWithGuild,
  comparePostsCreatedDesc,
  compareByUpdatedAsc,
  compareIso,
  mapItems,
  removeItems,
  removeExperience,
  toGuildCard,
  toPublicPost,
  unclaimMyGuild,
  upsertExperience,
  upsertItem,
  upsertMyGuild,
  upsertPublicPost,
  withBadgeGrant,
  withExperience,
  withExperienceOrder,
  withGuildInDirectory,
  withManualBadge,
  withModeration,
  withoutBadgeGrant,
  withoutExperience,
  withoutFeaturedExperience,
  withPostInGuildProfile,
  withPostInUserProfile,
  withReplacedExperience,
} from './cacheUpdates';
import {catalogFixture} from './catalog.fixture';
import {
  GUILD_ID,
  ME_ID,
  infinite,
  makeExperience,
  makeGuildProfile,
  makeMyGuild,
  makePost,
  makePrivatePost,
  makeUserProfile,
  page,
  postCreatedAt,
} from './fixtures';
import type {GuildCard, ManualBadgeGrant, PrivatePost} from './types';

const ids = (data: {pages: Array<{items: Array<{id: string}>}>} | undefined) =>
  data?.pages.map((p) => p.items.map((item) => item.id));

const mineOptions = (matches = true) => ({matches, compare: comparePostsCreatedDesc});

describe('removeItems and mapItems', () => {
  it('removes across pages and keeps the cursors', () => {
    const [a, b, c] = [postCreatedAt(3), postCreatedAt(2), postCreatedAt(1)];
    const data = infinite(page([a, b], 'x'), page([c]));
    const next = removeItems(data, (post) => post.id === b.id)!;
    expect(ids(next)).toEqual([[a.id], [c.id]]);
    expect(next.pages[0]!.next_cursor).toBe('x');
    expect(next.pageParams).toBe(data.pageParams);
  });

  it('returns the same object when nothing matches (no render for nothing)', () => {
    const data = infinite(page([postCreatedAt(1)]));
    expect(removeItems(data, () => false)).toBe(data);
    expect(mapItems(data, (post) => post)).toBe(data);
    expect(removeItems(undefined, () => true)).toBeUndefined();
  });

  it('replaces the items it is asked to', () => {
    const a = postCreatedAt(1);
    const data = infinite(page([a]));
    const next = mapItems(data, (post) => ({...post, title: 'Nouveau'}))!;
    expect(next.pages[0]!.items[0]!.title).toBe('Nouveau');
  });
});

describe('upsertItem: a list ordered by creation, newest first', () => {
  const newest = postCreatedAt(30);
  const middle = postCreatedAt(20);
  const oldest = postCreatedAt(10);

  it('inserts a new post first when it is the newest', () => {
    const data = infinite(page([middle, oldest]));
    const created = postCreatedAt(40);
    expect(ids(upsertItem(data, created, mineOptions()))).toEqual([[created.id, middle.id, oldest.id]]);
  });

  it('inserts inside the loaded pages at its place, even on the second page', () => {
    const data = infinite(page([newest, postCreatedAt(25)], 'c1'), page([postCreatedAt(15), oldest], 'c2'));
    const between = postCreatedAt(12);
    const result = upsertItem(data, between, mineOptions())!;
    expect(result.pages[1]!.items.map((p) => p.id)).toEqual([data.pages[1]!.items[0]!.id, between.id, oldest.id]);
    expect(result.pages[0]!.items).toBe(data.pages[0]!.items);
  });

  it('leaves out a post older than everything loaded while the list has more pages', () => {
    const data = infinite(page([newest, middle], 'more'));
    expect(upsertItem(data, postCreatedAt(1), mineOptions())).toBe(data);
  });

  it('puts it last when the list is complete', () => {
    const data = infinite(page([newest, middle], null));
    const old = postCreatedAt(1);
    expect(ids(upsertItem(data, old, mineOptions()))).toEqual([[newest.id, middle.id, old.id]]);
  });

  it('fills an empty complete list', () => {
    const first = postCreatedAt(1);
    expect(ids(upsertItem(infinite(page<PrivatePost>([])), first, mineOptions()))).toEqual([[first.id]]);
  });

  it('does not touch an empty list that has more pages behind it', () => {
    const data = infinite(page<PrivatePost>([], 'more'));
    expect(upsertItem(data, postCreatedAt(1), mineOptions())).toBe(data);
  });

  it('replaces a post in place when it is already listed and still belongs', () => {
    const data = infinite(page([newest, middle, oldest]));
    const edited = {...middle, title: 'Modifié'};
    const result = upsertItem(data, edited, mineOptions())!;
    expect(ids(result)).toEqual([[newest.id, middle.id, oldest.id]]);
    expect(result.pages[0]!.items[1]!.title).toBe('Modifié');
  });

  it('removes a post that no longer belongs (it changed status tab)', () => {
    const data = infinite(page([newest, middle, oldest]));
    expect(ids(upsertItem(data, middle, mineOptions(false)))).toEqual([[newest.id, oldest.id]]);
  });

  it('does not insert a post that does not belong', () => {
    const data = infinite(page([newest]));
    expect(upsertItem(data, postCreatedAt(99), mineOptions(false))).toBe(data);
  });

  it('keeps an uncached list uncached', () => {
    expect(upsertItem(undefined, newest, mineOptions())).toBeUndefined();
  });
});

describe('moving a post between the status tabs', () => {
  const tabs = ['draft', 'published', 'closed'] as const;
  const draft = postCreatedAt(5, {status: 'draft'});
  const other = postCreatedAt(9, {status: 'published'});

  /** What each tab holds after a write, starting from `before`. */
  function apply(post: PrivatePost, before: Record<(typeof tabs)[number], PrivatePost[]>) {
    return Object.fromEntries(
      tabs.map((status) => {
        const next = upsertItem(infinite(page(before[status])), post, {
          matches: belongsToMyPosts(post, {status}, ME_ID),
          compare: comparePostsCreatedDesc,
        });
        return [status, next?.pages[0]!.items.map((p) => p.id)];
      }),
    );
  }

  it('publishing moves a draft from the draft tab to the published tab', () => {
    const published = {...draft, status: 'published' as const};
    expect(apply(published, {draft: [draft], published: [other], closed: []})).toEqual({
      draft: [],
      published: [other.id, draft.id],
      closed: [],
    });
  });

  it('closing moves a published post to the closed tab', () => {
    const closed = {...other, status: 'closed' as const};
    expect(apply(closed, {draft: [], published: [other], closed: []})).toEqual({
      draft: [],
      published: [],
      closed: [other.id],
    });
  });
});

describe('belongsToMyPosts', () => {
  const post = makePrivatePost({author_id: ME_ID, guild_id: GUILD_ID, status: 'draft'});

  it('my posts are those I wrote', () => {
    expect(belongsToMyPosts(post, {}, ME_ID)).toBe(true);
    expect(belongsToMyPosts(post, {}, '999')).toBe(false);
    expect(belongsToMyPosts(post, {}, undefined)).toBe(false);
  });

  it('a server list holds every post of the server, whoever wrote it', () => {
    expect(belongsToMyPosts({...post, author_id: '1'}, {guildId: GUILD_ID}, ME_ID)).toBe(true);
    expect(belongsToMyPosts(post, {guildId: '5'}, ME_ID)).toBe(false);
  });

  it('a status filter keeps only that status', () => {
    expect(belongsToMyPosts(post, {status: 'draft'}, ME_ID)).toBe(true);
    expect(belongsToMyPosts(post, {status: 'published'}, ME_ID)).toBe(false);
  });
});

describe('compareIso', () => {
  it('orders instants, with or without microseconds', () => {
    expect(compareIso('2026-10-20T14:03:11+00:00', '2026-10-20T14:03:11.482913+00:00')).toBeLessThan(0);
    expect(compareIso('2026-10-20T14:03:12+00:00', '2026-10-20T14:03:11.482913+00:00')).toBeGreaterThan(0);
    expect(compareIso('2026-10-20T14:03:11+00:00', '2026-10-20T14:03:11+00:00')).toBe(0);
  });
});

describe('public post lists on profiles', () => {
  const older = makePost({published_at: '2026-10-01T10:00:00+00:00'});
  const newer = makePost({published_at: '2026-10-10T10:00:00+00:00'});

  it('inserts a newly published post by publication date, without its private fields', () => {
    const posts = upsertPublicPost([newer, older], makePrivatePost({published_at: '2026-10-05T10:00:00+00:00'}));
    expect(posts.map((p) => p.published_at)).toEqual([
      newer.published_at,
      '2026-10-05T10:00:00+00:00',
      older.published_at,
    ]);
    expect('hidden_reason' in posts[1]!).toBe(false);
  });

  it('replaces an edited post in place', () => {
    const edited = {...newer, title: 'Modifiée'};
    expect(upsertPublicPost([newer, older], edited).map((p) => p.title)).toEqual(['Modifiée', older.title]);
  });

  it('removes a post that is closed, hidden, a draft or expired', () => {
    for (const change of [{status: 'closed'}, {status: 'hidden'}, {status: 'draft'}, {is_expired: true}] as const) {
      expect(upsertPublicPost([newer, older], {...newer, ...change})).toEqual([older]);
    }
  });

  it('is the same list when a non-public post was never there', () => {
    const posts = [newer];
    expect(upsertPublicPost(posts, makePost({status: 'draft'}))).toBe(posts);
  });

  it('keeps at most 20, the newest', () => {
    const full = Array.from({length: 20}, (_, i) =>
      makePost({published_at: `2026-10-${String(i + 2).padStart(2, '0')}T10:00:00+00:00`}),
    ).reverse();
    const tooOld = makePost({published_at: '2026-09-01T10:00:00+00:00'});
    expect(upsertPublicPost(full, tooOld)).toBe(full);
    const fresh = makePost({published_at: '2026-11-01T10:00:00+00:00'});
    const result = upsertPublicPost(full, fresh);
    expect(result).toHaveLength(20);
    expect(result[0]!.id).toBe(fresh.id);
  });

  it('only touches the profile the post belongs to', () => {
    const post = makePost({kind: 'guild', guild_id: GUILD_ID});
    const guild = makeGuildProfile();
    expect(withPostInGuildProfile(guild, post).posts).toHaveLength(1);
    expect(withPostInGuildProfile(makeGuildProfile({id: '1'}), post)).toEqual(makeGuildProfile({id: '1'}));
    const own = makePost({kind: 'user', guild_id: null, author_id: ME_ID});
    expect(withPostInUserProfile(makeUserProfile(), own).posts).toHaveLength(1);
    expect(withPostInUserProfile(makeUserProfile({id: '2'}), own).posts).toHaveLength(0);
    // A server post never appears on a person's profile.
    expect(withPostInUserProfile(makeUserProfile(), post).posts).toHaveLength(0);
  });

  it('strips the private fields', () => {
    const publicPost = toPublicPost({...makePrivatePost(), can_edit: true} as PrivatePost);
    expect('hidden_reason' in publicPost).toBe(false);
    expect('can_edit' in publicPost).toBe(false);
  });
});

describe('post state helpers', () => {
  it('applies a moderation, keeping the same object when nothing changes', () => {
    const post = makePrivatePost({status: 'published'});
    const hidden = withModeration(post, {id: post.id, status: 'hidden', hidden_reason: 'Arnaque'});
    expect(hidden).toMatchObject({status: 'hidden', hidden_reason: 'Arnaque'});
    expect(withModeration(hidden, {id: post.id, status: 'hidden', hidden_reason: 'Arnaque'})).toBe(hidden);
    expect(withModeration(hidden, {id: post.id, status: 'closed', hidden_reason: null})).toMatchObject({
      status: 'closed',
      hidden_reason: null,
    });
  });

  it('closes the draft and published posts of a deleted server, not the hidden ones', () => {
    expect(closedWithGuild(makePost({status: 'draft'}), GUILD_ID).status).toBe('closed');
    expect(closedWithGuild(makePost({status: 'published'}), GUILD_ID).status).toBe('closed');
    const hidden = makePost({status: 'hidden'});
    expect(closedWithGuild(hidden, GUILD_ID)).toBe(hidden);
    const closed = makePost({status: 'closed'});
    expect(closedWithGuild(closed, GUILD_ID)).toBe(closed);
    const elsewhere = makePost({guild_id: '5'});
    expect(closedWithGuild(elsewhere, GUILD_ID)).toBe(elsewhere);
  });

  it('clears a featured experience that was deleted', () => {
    const post = makePost({featured_experience_id: 'exp-1'});
    expect(withoutFeaturedExperience(post, 'exp-1').featured_experience_id).toBeNull();
    expect(withoutFeaturedExperience(post, 'other')).toBe(post);
  });
});

describe('experiences', () => {
  const a = makeExperience();
  const b = makeExperience();

  it('a new one goes last, a changed one stays in place', () => {
    const c = makeExperience();
    expect(upsertExperience([a, b], c).map((e) => e.id)).toEqual([a.id, b.id, c.id]);
    const edited = {...a, position: 'admin'};
    expect(upsertExperience([a, b], edited)).toEqual([edited, b]);
  });

  it('removes one, or returns the same list', () => {
    expect(removeExperience([a, b], a.id)).toEqual([b]);
    const list = [a];
    expect(removeExperience(list, 'x')).toBe(list);
  });

  it('syncs into a profile: added, replaced, removed, reordered', () => {
    const profile = makeUserProfile({experiences: [a, b]});
    const c = makeExperience();
    expect(withExperience(profile, c).experiences.map((e) => e.id)).toEqual([a.id, b.id, c.id]);

    const verified = {...b, verification: {...b.verification, status: 'verified' as const}};
    expect(withExperience(profile, verified).experiences[1]).toBe(verified);
    expect(withReplacedExperience(profile, verified).experiences[1]).toBe(verified);

    // `withReplacedExperience` never adds (a staff action on an experience the cached profile does not list).
    expect(withReplacedExperience(profile, c)).toBe(profile);

    expect(withoutExperience(profile, a.id).experiences.map((e) => e.id)).toEqual([b.id]);
    expect(withoutExperience(profile, 'x')).toBe(profile);

    expect(withExperienceOrder(profile, [b, a]).experiences.map((e) => e.id)).toEqual([b.id, a.id]);
  });
});

describe('servers', () => {
  it('claims a server in the list, keeping it sorted by name', () => {
    const list = [makeMyGuild({id: '1', name: 'Alpha'}), makeMyGuild({id: '3', name: 'Zeta'})];
    const profile = makeGuildProfile({id: '2', name: 'Mu'});
    expect(upsertMyGuild(list, profile).map((g) => [g.id, g.claimed])).toEqual([
      ['1', false],
      ['2', true],
      ['3', false],
    ]);
  });

  it('marks an existing one claimed with its fresh name, or leaves the list alone when identical', () => {
    const list = [makeMyGuild({id: GUILD_ID, name: 'Old'})];
    const result = upsertMyGuild(list, makeGuildProfile({name: 'New'}));
    expect(result[0]).toMatchObject({name: 'New', claimed: true, listed: true});
    // An unlisted profile is claimed but not listed.
    expect(upsertMyGuild(result, makeGuildProfile({name: 'New', listed: false}))[0]).toMatchObject({listed: false});
    expect(upsertMyGuild(result, makeGuildProfile({name: 'New'}))).toBe(result);
  });

  it('unclaims a deleted server and keeps it in the list', () => {
    const list = [makeMyGuild({claimed: true})];
    expect(unclaimMyGuild(list, GUILD_ID)).toEqual([makeMyGuild({claimed: false, listed: false})]);
    const already = [makeMyGuild({claimed: false})];
    expect(unclaimMyGuild(already, GUILD_ID)).toBe(already);
  });

  it('cuts a card description at 160 characters and flags a NSFW server', () => {
    expect(toGuildCard(makeGuildProfile({description: 'Court.'})).description).toBe('Court.');
    expect(toGuildCard(makeGuildProfile({description: null})).description).toBeNull();
    expect(toGuildCard(makeGuildProfile({description: 'x'.repeat(200)})).description).toBe(`${'x'.repeat(160)}…`);
    expect(toGuildCard(makeGuildProfile({description: 'x'.repeat(160)})).description).toBe('x'.repeat(160));
    expect(toGuildCard(makeGuildProfile()).nsfw).toBe(false);
    expect(toGuildCard(makeGuildProfile({theme: 'nsfw'})).nsfw).toBe(true);
    expect(
      toGuildCard(makeGuildProfile({badges: [{id: 'nsfw', label: {fr: 'a', en: 'a'}, source: 'computed'}]})).nsfw,
    ).toBe(true);
  });

  it('makes a directory card without the premium badge', () => {
    const profile = makeGuildProfile({
      badges: [
        {id: 'moddy_installed', label: {fr: 'a', en: 'a'}, source: 'computed'},
        {id: 'moddy_premium', label: {fr: 'b', en: 'b'}, source: 'computed'},
      ],
    });
    expect(toGuildCard(profile).badges.map((b) => b.id)).toEqual(['moddy_installed']);
    const withDiscord = makeGuildProfile({
      badges: [
        {id: 'discord_verified', label: {fr: 'v', en: 'v'}, source: 'discord'},
        {id: 'moddy_installed', label: {fr: 'a', en: 'a'}, source: 'computed'},
      ],
    });
    expect(toGuildCard(withDiscord).badges.map((b) => b.id)).toEqual(['moddy_installed']);
  });

  it('updates a listed card in the directory and removes an unlisted one', () => {
    const card: GuildCard = toGuildCard(makeGuildProfile({tags: ['old']}));
    const other = toGuildCard(makeGuildProfile({id: '2'}));
    const data = infinite(page([card, other]));
    const updated = withGuildInDirectory(data, makeGuildProfile({tags: ['new']}))!;
    expect(updated.pages[0]!.items[0]!.tags).toEqual(['new']);
    expect(updated.pages[0]!.items[1]).toBe(other);
    expect(ids(withGuildInDirectory(data, makeGuildProfile({listed: false})))).toEqual([['2']]);
    expect(withGuildInDirectory(undefined, makeGuildProfile())).toBeUndefined();
  });
});

describe('badges', () => {
  const computed = {
    id: 'moddy_installed',
    label: {fr: 'Moddy installé', en: 'Moddy installed'},
    source: 'computed' as const,
  };

  it('adds a granted manual badge at its catalog place, with the catalog label', () => {
    const partner = {id: 'moddy_partner', label: {fr: 'x', en: 'x'}, source: 'manual' as const};
    const result = withManualBadge([partner, computed], 'lineup_verified', true, catalogFixture);
    // lineup_verified comes before moddy_partner in the catalog; moddy_installed comes first of all.
    expect(result.map((b) => b.id)).toEqual(['moddy_installed', 'lineup_verified', 'moddy_partner']);
    expect(result[1]).toMatchObject({source: 'manual', label: {fr: 'Vérifié par Lineup', en: 'Verified by Lineup'}});
  });

  it('does nothing without the catalog, or for a badge already there', () => {
    const badges = [computed];
    expect(withManualBadge(badges, 'lineup_verified', true, undefined)).toBe(badges);
    expect(withManualBadge(badges, 'nope', true, catalogFixture)).toBe(badges);
    const has = [{id: 'lineup_verified', label: {fr: '', en: ''}, source: 'manual' as const}];
    expect(withManualBadge(has, 'lineup_verified', true, catalogFixture)).toBe(has);
  });

  it('removes a revoked manual badge but never a computed one', () => {
    const manual = {id: 'moddy_partner', label: {fr: '', en: ''}, source: 'manual' as const};
    expect(withManualBadge([computed, manual], 'moddy_partner', false, catalogFixture)).toEqual([computed]);
    const only = [computed];
    expect(withManualBadge(only, 'moddy_installed', false, catalogFixture)).toBe(only);
  });

  const grant = (badge: string, at: string, note: string | null = null): ManualBadgeGrant => ({
    entity_type: 'guild',
    entity_id: GUILD_ID,
    entity_name: null,
    entity_icon_url: null,
    badge,
    granted_by: '1',
    granted_at: at,
    note,
  });

  it('puts a grant first in the list, replacing the same grant given earlier', () => {
    const first = grant('moddy_partner', '2026-10-01T00:00:00+00:00');
    const second = grant('lineup_verified', '2026-10-02T00:00:00+00:00');
    const data = infinite(page([second, first], null));
    const regranted = grant('moddy_partner', '2026-10-03T00:00:00+00:00', 'Nouveau');
    const result = withBadgeGrant(data, regranted)!;
    expect(result.pages[0]!.items).toEqual([regranted, second]);
  });

  it('removes a revoked grant', () => {
    const first = grant('moddy_partner', '2026-10-01T00:00:00+00:00');
    const data = infinite(page([first]));
    expect(withoutBadgeGrant(data, first)!.pages[0]!.items).toEqual([]);
  });
});

describe('queue ordering', () => {
  it('lists the staff experience queue oldest change first', () => {
    const early = makeExperience({updated_at: '2026-10-01T00:00:00+00:00'});
    const late = makeExperience({updated_at: '2026-10-02T00:00:00+00:00'});
    expect([late, early].sort(compareByUpdatedAsc)).toEqual([early, late]);
  });
});
