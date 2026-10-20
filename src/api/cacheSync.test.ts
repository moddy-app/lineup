import {type InfiniteData, QueryClient} from '@tanstack/react-query';
import {beforeEach, describe, expect, it} from 'vitest';

import {
  syncBadgeGrant,
  syncBadgeRevoked,
  syncExperienceDeleted,
  syncExperiencesReordered,
  syncExperienceWritten,
  syncGuildDeleted,
  syncGuildProfile,
  syncMyGuildsRefreshed,
  syncMyProfile,
  syncPostDeleted,
  syncPostModerated,
  syncPostWritten,
  syncReportHandled,
  syncStaffExperience,
} from './cacheSync';
import {catalogFixture} from './catalog.fixture';
import {
  GUILD_ID,
  ME_ID,
  infinite,
  makeExperience,
  makeGuildProfile,
  makeMe,
  makeMyGuild,
  makePost,
  makeReport,
  makeStaffExperience,
  makeUserProfile,
  makeWrittenPost,
  page,
  postCreatedAt,
} from './fixtures';
import {queryKeys} from './queryKeys';
import {routeApiError, type SessionSnapshot} from './sessionSnapshot';
import {ApiError} from './client';
import type {
  ExperienceList,
  GuildProfile,
  ManualBadgeGrant,
  Paginated,
  Post,
  PostDetail,
  PrivatePost,
  Report,
  StaffExperience,
  UserProfile,
} from './types';

let qc: QueryClient;

const signedIn = (me = makeMe()): SessionSnapshot => ({status: 'authenticated', me});

beforeEach(() => {
  qc = new QueryClient();
  qc.setQueryData(queryKeys.me(), signedIn());
});

type Pages<T> = InfiniteData<Paginated<T>, string | null>;
const ids = <T extends {id: string}>(key: readonly unknown[]) =>
  qc.getQueryData<Pages<T>>(key)?.pages.map((p) => p.items.map((item) => item.id));

/** The caches a post lives in, filled the way a session that browsed around would have them. */
function seedPosts(posts: {draft?: PrivatePost[]; published?: PrivatePost[]; closed?: PrivatePost[]} = {}) {
  const all = [...(posts.draft ?? []), ...(posts.published ?? []), ...(posts.closed ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  qc.setQueryData(queryKeys.myPosts({}), infinite(page(all)));
  qc.setQueryData(queryKeys.myPosts({status: 'draft'}), infinite(page(posts.draft ?? [])));
  qc.setQueryData(queryKeys.myPosts({status: 'published'}), infinite(page(posts.published ?? [])));
  qc.setQueryData(queryKeys.myPosts({status: 'closed'}), infinite(page(posts.closed ?? [])));
  qc.setQueryData(queryKeys.myPosts({guildId: GUILD_ID}), infinite(page(all)));
}

describe('a post is created or published', () => {
  it('lands first in the lists it belongs to, and in no other status tab', () => {
    const older = postCreatedAt(1, {status: 'published'});
    seedPosts({published: [older]});

    const created = {...makeWrittenPost(postCreatedAt(20, {status: 'draft'}))};
    syncPostWritten(qc, created);

    expect(ids(queryKeys.myPosts({}))).toEqual([[created.id, older.id]]);
    expect(ids(queryKeys.myPosts({status: 'draft'}))).toEqual([[created.id]]);
    expect(ids(queryKeys.myPosts({status: 'published'}))).toEqual([[older.id]]);
    expect(ids(queryKeys.myPosts({guildId: GUILD_ID}))).toEqual([[created.id, older.id]]);
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(created.id))).toEqual(created);
  });

  it('does not create a list that was never loaded', () => {
    syncPostWritten(qc, makeWrittenPost());
    expect(qc.getQueryCache().findAll({queryKey: queryKeys.myPostsLists()})).toHaveLength(0);
  });

  it('moves a draft to the published tab when it is published', () => {
    const draft = postCreatedAt(5, {status: 'draft'});
    const other = postCreatedAt(9, {status: 'published'});
    seedPosts({draft: [draft], published: [other]});

    syncPostWritten(qc, makeWrittenPost({...draft, status: 'published'}));

    expect(ids(queryKeys.myPosts({status: 'draft'}))).toEqual([[]]);
    expect(ids(queryKeys.myPosts({status: 'published'}))).toEqual([[other.id, draft.id]]);
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(draft.id))?.status).toBe('published');
  });

  it('does not insert it into the feed (filters and server cache decide what the feed shows)', () => {
    const feed = infinite(page([makePost()], 'next'));
    qc.setQueryData(queryKeys.feed({}), feed);
    syncPostWritten(qc, makeWrittenPost({status: 'published'}));
    expect(qc.getQueryData(queryKeys.feed({}))).toBe(feed);
  });

  it('updates a published post where the feed already shows it', () => {
    const post = makePost();
    qc.setQueryData(queryKeys.feed({}), infinite(page([post])));
    syncPostWritten(qc, makeWrittenPost({...post, title: 'Nouveau titre'}));
    expect(qc.getQueryData<Pages<Post>>(queryKeys.feed({}))!.pages[0]!.items[0]!.title).toBe('Nouveau titre');
    expect('hidden_reason' in qc.getQueryData<Pages<Post>>(queryKeys.feed({}))!.pages[0]!.items[0]!).toBe(false);
  });

  it('appears on the public profile of its server, and on mine for a personal post', () => {
    qc.setQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID), makeGuildProfile());
    qc.setQueryData<UserProfile>(queryKeys.myProfile(), makeUserProfile());
    qc.setQueryData<UserProfile>(queryKeys.userDetail(ME_ID), makeUserProfile());

    syncPostWritten(qc, makeWrittenPost({kind: 'guild'}));
    syncPostWritten(qc, makeWrittenPost({kind: 'user', guild_id: null, guild: null}));

    expect(qc.getQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID))!.posts).toHaveLength(1);
    expect(qc.getQueryData<UserProfile>(queryKeys.myProfile())!.posts).toHaveLength(1);
    expect(qc.getQueryData<UserProfile>(queryKeys.userDetail(ME_ID))!.posts).toHaveLength(1);
  });
});

describe('a post is closed', () => {
  it('leaves the feed and the profile, and moves from the published tab to the closed tab', () => {
    const post = postCreatedAt(5, {status: 'published'});
    seedPosts({published: [post]});
    qc.setQueryData(queryKeys.feed({kind: 'guild'}), infinite(page([post, makePost()])));
    qc.setQueryData(queryKeys.feed({}), infinite(page([makePost(), post], 'more')));
    qc.setQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID), makeGuildProfile({posts: [post]}));

    syncPostWritten(qc, makeWrittenPost({...post, status: 'closed'}));

    expect(ids<Post>(queryKeys.feed({kind: 'guild'}))![0]).not.toContain(post.id);
    expect(ids<Post>(queryKeys.feed({}))![0]).not.toContain(post.id);
    expect(qc.getQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID))!.posts).toEqual([]);
    expect(ids(queryKeys.myPosts({status: 'published'}))).toEqual([[]]);
    expect(ids(queryKeys.myPosts({status: 'closed'}))).toEqual([[post.id]]);
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(post.id))?.status).toBe('closed');
    // The feed keeps its cursor: it is not read again.
    expect(qc.getQueryData<Pages<Post>>(queryKeys.feed({}))!.pages[0]!.next_cursor).toBe('more');
  });
});

describe('a post is deleted', () => {
  it('disappears everywhere', () => {
    const post = postCreatedAt(5, {status: 'closed'});
    seedPosts({closed: [post]});
    qc.setQueryData(queryKeys.postDetail(post.id), makeWrittenPost(post));
    qc.setQueryData(queryKeys.feed({}), infinite(page([post])));
    qc.setQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID), makeGuildProfile({posts: [post]}));
    qc.setQueryData<UserProfile>(queryKeys.userDetail('7'), makeUserProfile({id: '7', posts: [post]}));

    syncPostDeleted(qc, post.id);

    expect(qc.getQueryData(queryKeys.postDetail(post.id))).toBeUndefined();
    expect(ids(queryKeys.myPosts({}))).toEqual([[]]);
    expect(ids(queryKeys.myPosts({status: 'closed'}))).toEqual([[]]);
    expect(ids(queryKeys.feed({}))).toEqual([[]]);
    expect(qc.getQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID))!.posts).toEqual([]);
    expect(qc.getQueryData<UserProfile>(queryKeys.userDetail('7'))!.posts).toEqual([]);
  });
});

describe('the staff hides or shows a post', () => {
  it('hides: out of the public lists, status and reason in the editors’ copies, moved to the hidden tab', () => {
    const post = postCreatedAt(5, {status: 'published'});
    seedPosts({published: [post]});
    qc.setQueryData(queryKeys.myPosts({status: 'hidden'}), infinite(page<PrivatePost>([])));
    qc.setQueryData(queryKeys.postDetail(post.id), makeWrittenPost(post));
    qc.setQueryData(queryKeys.feed({}), infinite(page([post])));

    syncPostModerated(qc, {id: post.id, status: 'hidden', hidden_reason: 'Arnaque'});

    expect(ids(queryKeys.feed({}))).toEqual([[]]);
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(post.id))).toMatchObject({
      status: 'hidden',
      hidden_reason: 'Arnaque',
    });
    expect(ids(queryKeys.myPosts({status: 'published'}))).toEqual([[]]);
    expect(ids(queryKeys.myPosts({status: 'hidden'}))).toEqual([[post.id]]);
    const mine = qc.getQueryData<Pages<PrivatePost>>(queryKeys.myPosts({}))!.pages[0]!.items[0]!;
    expect(mine).toMatchObject({status: 'hidden', hidden_reason: 'Arnaque'});
  });

  it('unhides: the post is closed, not published', () => {
    const post = postCreatedAt(5, {status: 'hidden', hidden_reason: 'Arnaque'});
    qc.setQueryData(queryKeys.postDetail(post.id), makeWrittenPost(post));
    syncPostModerated(qc, {id: post.id, status: 'closed', hidden_reason: null});
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(post.id))).toMatchObject({
      status: 'closed',
      hidden_reason: null,
    });
  });

  it('still clears the public lists when the post is not otherwise known', () => {
    const post = makePost();
    qc.setQueryData(queryKeys.feed({}), infinite(page([post])));
    syncPostModerated(qc, {id: post.id, status: 'hidden', hidden_reason: 'x'});
    expect(ids(queryKeys.feed({}))).toEqual([[]]);
  });
});

describe('servers', () => {
  it('a claim or an update sets the detail, patches my servers and the directory card', () => {
    qc.setQueryData(queryKeys.myGuilds(), [makeMyGuild({name: 'Old'})]);
    qc.setQueryData(queryKeys.directory({}), infinite(page([{...makeGuildProfile(), tags: ['old']} as never])));
    const profile = makeGuildProfile({name: 'New', tags: ['new']});

    syncGuildProfile(qc, profile, {claimed: true});

    expect(qc.getQueryData(queryKeys.guildDetail(GUILD_ID))).toBe(profile);
    expect(qc.getQueryData(queryKeys.myGuilds())).toEqual([makeMyGuild({name: 'New', claimed: true})]);
    expect(qc.getQueryData<Pages<{tags: string[]}>>(queryKeys.directory({}))!.pages[0]!.items[0]!.tags).toEqual([
      'new',
    ]);
    expect(qc.getQueryState(queryKeys.directory({}))?.isInvalidated).toBe(true);
  });

  it('an unlisted server leaves the directory', () => {
    qc.setQueryData(queryKeys.directory({}), infinite(page([{id: GUILD_ID} as never])));
    syncGuildProfile(qc, makeGuildProfile({listed: false}));
    expect(ids(queryKeys.directory({}))).toEqual([[]]);
  });

  it('a claim adds a server my list did not hold', () => {
    qc.setQueryData(queryKeys.myGuilds(), []);
    syncGuildProfile(qc, makeGuildProfile(), {claimed: true});
    expect(qc.getQueryData(queryKeys.myGuilds())).toEqual([makeMyGuild({claimed: true})]);
  });

  it('deleting a server closes its posts in every cache and unclaims it', () => {
    const draft = postCreatedAt(3, {status: 'draft'});
    const published = postCreatedAt(7, {status: 'published'});
    const hidden = postCreatedAt(5, {status: 'hidden', hidden_reason: 'x'});
    const elsewhere = postCreatedAt(9, {status: 'published', guild_id: '5'});
    seedPosts({draft: [draft], published: [published, elsewhere], closed: []});
    qc.setQueryData(queryKeys.myPosts({status: 'hidden'}), infinite(page([hidden])));
    qc.setQueryData(queryKeys.postDetail(published.id), makeWrittenPost(published));
    qc.setQueryData(queryKeys.myGuilds(), [makeMyGuild({claimed: true})]);
    qc.setQueryData(queryKeys.guildDetail(GUILD_ID), makeGuildProfile());
    qc.setQueryData(queryKeys.feed({}), infinite(page([published, elsewhere])));
    qc.setQueryData(queryKeys.directory({}), infinite(page([{id: GUILD_ID} as never])));

    syncGuildDeleted(qc, GUILD_ID);

    expect(qc.getQueryData(queryKeys.guildDetail(GUILD_ID))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.myGuilds())).toEqual([makeMyGuild({claimed: false})]);
    expect(ids(queryKeys.directory({}))).toEqual([[]]);
    expect(ids(queryKeys.feed({}))).toEqual([[elsewhere.id]]);
    expect(ids(queryKeys.myPosts({status: 'draft'}))).toEqual([[]]);
    expect(ids(queryKeys.myPosts({status: 'published'}))).toEqual([[elsewhere.id]]);
    expect(ids(queryKeys.myPosts({status: 'closed'}))).toEqual([[published.id, draft.id]]);
    // Hidden posts stay hidden.
    expect(ids(queryKeys.myPosts({status: 'hidden'}))).toEqual([[hidden.id]]);
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(published.id))?.status).toBe('closed');
  });

  it('refreshing my servers replaces the list, unless Discord was silent', () => {
    const fresh = [makeMyGuild({id: '1'}), makeMyGuild({id: '2'})];
    qc.setQueryData(queryKeys.myGuilds(), [makeMyGuild()]);
    syncMyGuildsRefreshed(qc, {guilds: [makeMyGuild({id: '9'})], stale: true});
    expect(qc.getQueryData(queryKeys.myGuilds())).toEqual([makeMyGuild()]);
    syncMyGuildsRefreshed(qc, {guilds: fresh, stale: false});
    expect(qc.getQueryData(queryKeys.myGuilds())).toEqual(fresh);
  });
});

describe('profile and experiences', () => {
  it('saving my profile sets both copies and the raw row of /me', () => {
    qc.setQueryData(
      queryKeys.me(),
      signedIn({
        ...makeMe(),
        profile: {
          user_id: ME_ID,
          headline: null,
          bio: null,
          links: [],
          languages: [],
          timezone: null,
          open_to_work: false,
          discord_snapshot: {},
          snapshot_at: null,
          created_at: '2026-10-20T13:50:00+00:00',
          updated_at: '2026-10-20T13:50:00+00:00',
        },
      }),
    );
    const profile = makeUserProfile({headline: 'Modératrice', open_to_work: true, languages: ['fr', 'en']});
    syncMyProfile(qc, profile);

    expect(qc.getQueryData(queryKeys.myProfile())).toBe(profile);
    expect(qc.getQueryData(queryKeys.userDetail(ME_ID))).toBe(profile);
    const snapshot = qc.getQueryData<SessionSnapshot>(queryKeys.me());
    expect(snapshot?.status === 'authenticated' && snapshot.me.profile).toMatchObject({
      headline: 'Modératrice',
      open_to_work: true,
      languages: ['fr', 'en'],
    });
  });

  it('an experience goes into the list and into both profiles, last, and marks its server’s team stale', () => {
    const first = makeExperience();
    qc.setQueryData<ExperienceList>(queryKeys.myExperiences(), {items: [first]});
    qc.setQueryData(queryKeys.myProfile(), makeUserProfile({experiences: [first]}));
    qc.setQueryData(queryKeys.userDetail(ME_ID), makeUserProfile({experiences: [first]}));
    qc.setQueryData(queryKeys.guildDetail(GUILD_ID), makeGuildProfile());

    const created = makeExperience();
    syncExperienceWritten(qc, created);

    for (const list of [
      qc.getQueryData<ExperienceList>(queryKeys.myExperiences())!.items,
      qc.getQueryData<UserProfile>(queryKeys.myProfile())!.experiences,
      qc.getQueryData<UserProfile>(queryKeys.userDetail(ME_ID))!.experiences,
    ]) {
      expect(list.map((e) => e.id)).toEqual([first.id, created.id]);
    }
    expect(qc.getQueryState(queryKeys.guildDetail(GUILD_ID))?.isInvalidated).toBe(true);
  });

  it('a verified experience replaces the old one everywhere', () => {
    const exp = makeExperience();
    qc.setQueryData<ExperienceList>(queryKeys.myExperiences(), {items: [exp]});
    qc.setQueryData(queryKeys.myProfile(), makeUserProfile({experiences: [exp]}));
    const verified = {...exp, verification: {...exp.verification, status: 'verified' as const}};
    syncExperienceWritten(qc, verified);
    expect(qc.getQueryData<ExperienceList>(queryKeys.myExperiences())!.items[0]).toEqual(verified);
    expect(qc.getQueryData<UserProfile>(queryKeys.myProfile())!.experiences[0]).toEqual(verified);
  });

  it('reordering sets the new order in the list and the profiles', () => {
    const [a, b] = [makeExperience(), makeExperience()];
    qc.setQueryData<ExperienceList>(queryKeys.myExperiences(), {items: [a, b]});
    qc.setQueryData(queryKeys.myProfile(), makeUserProfile({experiences: [a, b]}));
    syncExperiencesReordered(qc, {items: [b, a]});
    expect(qc.getQueryData<ExperienceList>(queryKeys.myExperiences())!.items.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(qc.getQueryData<UserProfile>(queryKeys.myProfile())!.experiences.map((e) => e.id)).toEqual([b.id, a.id]);
  });

  it('deleting one removes it and clears it from the posts that featured it', () => {
    const exp = makeExperience();
    const featuring = postCreatedAt(5, {kind: 'user', guild_id: null, featured_experience_id: exp.id});
    qc.setQueryData<ExperienceList>(queryKeys.myExperiences(), {items: [exp]});
    qc.setQueryData(queryKeys.myProfile(), makeUserProfile({experiences: [exp]}));
    qc.setQueryData(queryKeys.myPosts({}), infinite(page([featuring])));
    qc.setQueryData(queryKeys.postDetail(featuring.id), makeWrittenPost(featuring));

    syncExperienceDeleted(qc, exp.id);

    expect(qc.getQueryData<ExperienceList>(queryKeys.myExperiences())!.items).toEqual([]);
    expect(qc.getQueryData<UserProfile>(queryKeys.myProfile())!.experiences).toEqual([]);
    expect(
      qc.getQueryData<Pages<PrivatePost>>(queryKeys.myPosts({}))!.pages[0]!.items[0]!.featured_experience_id,
    ).toBeNull();
    expect(qc.getQueryData<PostDetail>(queryKeys.postDetail(featuring.id))!.featured_experience_id).toBeNull();
    expect(qc.getQueryState(queryKeys.guildDetail(GUILD_ID))).toBeUndefined();
  });
});

describe('staff queues', () => {
  const pending = makeStaffExperience({
    verification: {status: 'pending', method: null, verified_at: null, evidence: null, rejection_reason: null},
    updated_at: '2026-10-01T00:00:00+00:00',
    user_id: '77',
  });
  const waiting = makeStaffExperience({
    verification: {status: 'pending', method: null, verified_at: null, evidence: null, rejection_reason: null},
    updated_at: '2026-10-02T00:00:00+00:00',
    user_id: '78',
  });

  it('a verified experience leaves the pending queue and joins the verified one, at the end', () => {
    const early = makeStaffExperience({
      verification: {
        status: 'verified',
        method: 'moddy_staff',
        verified_at: 'x',
        evidence: null,
        rejection_reason: null,
      },
      updated_at: '2026-09-01T00:00:00+00:00',
    });
    qc.setQueryData(queryKeys.staffExperiences('pending'), infinite(page([pending, waiting])));
    qc.setQueryData(queryKeys.staffExperiences('verified'), infinite(page([early])));
    qc.setQueryData(queryKeys.staffExperiences('rejected'), infinite(page<StaffExperience>([])));
    qc.setQueryData(queryKeys.userDetail('77'), makeUserProfile({id: '77', experiences: [pending]}));

    const verified: StaffExperience = {
      ...pending,
      updated_at: '2026-10-20T00:00:00+00:00',
      verification: {
        status: 'verified',
        method: 'moddy_staff',
        verified_at: 'x',
        evidence: null,
        rejection_reason: null,
      },
    };
    syncStaffExperience(qc, verified);

    expect(ids(queryKeys.staffExperiences('pending'))).toEqual([[waiting.id]]);
    expect(ids(queryKeys.staffExperiences('verified'))).toEqual([[early.id, pending.id]]);
    expect(ids(queryKeys.staffExperiences('rejected'))).toEqual([[]]);
    expect(qc.getQueryData<UserProfile>(queryKeys.userDetail('77'))!.experiences[0]).toEqual(verified);
  });

  it('a rejection goes to the rejected queue', () => {
    qc.setQueryData(queryKeys.staffExperiences('pending'), infinite(page([pending])));
    qc.setQueryData(queryKeys.staffExperiences('rejected'), infinite(page<StaffExperience>([])));
    syncStaffExperience(qc, {
      ...pending,
      verification: {status: 'rejected', method: null, verified_at: null, evidence: null, rejection_reason: 'Non'},
    });
    expect(ids(queryKeys.staffExperiences('pending'))).toEqual([[]]);
    expect(ids(queryKeys.staffExperiences('rejected'))).toEqual([[pending.id]]);
  });

  it('a handled report leaves open, joins its status, and stays in all', () => {
    const open = makeReport({created_at: '2026-10-20T10:00:00+00:00'});
    const resolvedBefore = makeReport({status: 'resolved', created_at: '2026-10-21T10:00:00+00:00'});
    qc.setQueryData(queryKeys.staffReports('open'), infinite(page([open])));
    qc.setQueryData(queryKeys.staffReports('resolved'), infinite(page([resolvedBefore])));
    qc.setQueryData(queryKeys.staffReports('dismissed'), infinite(page<Report>([])));
    qc.setQueryData(queryKeys.staffReports('all'), infinite(page([resolvedBefore, open])));

    const resolved: Report = {...open, status: 'resolved', handled_by: '1'};
    syncReportHandled(qc, resolved);

    expect(ids(queryKeys.staffReports('open'))).toEqual([[]]);
    expect(ids(queryKeys.staffReports('resolved'))).toEqual([[resolvedBefore.id, open.id]].map(([a, b]) => [a, b]));
    expect(ids(queryKeys.staffReports('dismissed'))).toEqual([[]]);
    expect(qc.getQueryData<Pages<Report>>(queryKeys.staffReports('all'))!.pages[0]!.items[1]).toEqual(resolved);
  });

  it('granting a badge lists it first and shows it on the profile; revoking removes both', () => {
    const grant: ManualBadgeGrant = {
      entity_type: 'guild',
      entity_id: GUILD_ID,
      badge: 'moddy_partner',
      granted_by: '1',
      granted_at: '2026-10-20T15:00:00+00:00',
      note: null,
    };
    qc.setQueryData(queryKeys.catalog(), catalogFixture);
    qc.setQueryData(queryKeys.staffBadges('guild'), infinite(page<never>([])) as never);
    qc.setQueryData(queryKeys.guildDetail(GUILD_ID), makeGuildProfile());

    syncBadgeGrant(qc, grant);
    expect(
      qc.getQueryData<InfiniteData<{items: ManualBadgeGrant[]}>>(queryKeys.staffBadges('guild'))!.pages[0]!.items,
    ).toEqual([grant]);
    expect(qc.getQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID))!.badges.map((b) => b.id)).toEqual([
      'moddy_partner',
    ]);

    syncBadgeRevoked(qc, {entityType: 'guild', entityId: GUILD_ID, badge: 'moddy_partner'});
    expect(
      qc.getQueryData<InfiniteData<{items: ManualBadgeGrant[]}>>(queryKeys.staffBadges('guild'))!.pages[0]!.items,
    ).toEqual([]);
    expect(qc.getQueryData<GuildProfile>(queryKeys.guildDetail(GUILD_ID))!.badges).toEqual([]);
  });
});

describe('routeApiError (what a failed request means for the session)', () => {
  const suspended = new ApiError({
    status: 403,
    kind: 'sanction',
    code: 'user_suspended',
    sanction: {
      code: 'user_suspended',
      level: 'ban',
      subject_type: 'discord_user',
      subject_id: ME_ID,
      references: ['A7F2K9'],
      expires_at: null,
      message: 'm',
      violations_url: 'https://moddy.app/violations',
    },
  });
  const unauthenticated = new ApiError({status: 401, kind: 'text', code: 'unauthenticated'});

  it('a suspension on any route suspends the session', () => {
    routeApiError(qc, suspended, false);
    expect(qc.getQueryData<SessionSnapshot>(queryKeys.me())).toMatchObject({
      status: 'suspended',
      sanction: {references: ['A7F2K9']},
    });
  });

  it('a 401 on a protected request makes the session anonymous', () => {
    routeApiError(qc, unauthenticated, true);
    expect(qc.getQueryData<SessionSnapshot>(queryKeys.me())).toEqual({status: 'anonymous'});
  });

  it('a 401 on a request that does not need a session changes nothing', () => {
    routeApiError(qc, unauthenticated, false);
    expect(qc.getQueryData<SessionSnapshot>(queryKeys.me())?.status).toBe('authenticated');
  });

  it('ignores other errors, and errors that are not API errors', () => {
    routeApiError(qc, new ApiError({status: 404, kind: 'lineup', code: 'lineup_post_not_found'}), true);
    routeApiError(qc, new Error('x'), true);
    expect(qc.getQueryData<SessionSnapshot>(queryKeys.me())?.status).toBe('authenticated');
  });
});
