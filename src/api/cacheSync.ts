/**
 * Applies a write to the cache. One function per kind of write, each taking
 * what the API answered (never refetching: LINEUP.md §0 "Cache") and patching
 * every cached query that shows it, with the pure updaters of cacheUpdates.ts.
 *
 * What each write touches (a query that is not cached is left alone):
 *
 *  POST (create)      posts.detail, posts.mine (every status tab and server
 *  PATCH publish      list it belongs to, in its place), posts.feed (replaced
 *  close              in place while published, REMOVED once it is not), and the
 *                     public post list of the server or person profile.
 *  DELETE post        posts.detail removed; removed from every list above.
 *  hide / unhide      the same as a post leaving the public side: patched where
 *  (staff)            it is held, removed from the feed and the profiles.
 *  claim / PUT /      guilds.detail set; guilds.mine patched (`claimed: true`,
 *  refresh a server   name, icon); the directory card updated, or removed when
 *                     the server is unlisted.
 *  DELETE a server    guilds.detail removed; guilds.mine `claimed: false`;
 *                     removed from the directory and the feed; its draft and
 *                     published posts become `closed` in every cache.
 *  PUT my profile     me.profile and users.detail[me] set; me (raw row) patched.
 *  experience writes  me.experiences, then the `experiences` array inside
 *                     me.profile and users.detail[me]; a delete also clears the
 *                     featured experience of the posts that held it.
 *  staff experience   the queues (moved out of the current status list), and
 *  verify / reject    the owner's profile where cached.
 *  staff report       the queues (moved between open, resolved, dismissed, all).
 *  resolve / dismiss
 *  staff badges       the granted list, and the badges of the profile shown.
 *
 * A write also marks stale, WITHOUT refetching, what it may have changed
 * server-side but cannot be computed here (a server's `team`, the directory):
 * they are read again next time they are shown.
 */

import type {InfiniteData, QueryClient, QueryKey} from '@tanstack/react-query';

import {
  belongsToMyPosts,
  closedWithGuild,
  comparePostsCreatedDesc,
  compareByCreatedDesc,
  compareByUpdatedAsc,
  isPubliclyListed,
  mapItems,
  removeItems,
  toPublicPost,
  unclaimMyGuild,
  upsertItem,
  upsertMyGuild,
  withBadgeGrant,
  withExperience,
  withExperienceOrder,
  withGuildInDirectory,
  withManualBadge,
  withModeration,
  withoutBadgeGrant,
  withoutExperience,
  withoutFeaturedExperience,
  withoutPostInGuildProfile,
  withoutPostInUserProfile,
  withPostInGuildProfile,
  withPostInUserProfile,
  withReplacedExperience,
} from './cacheUpdates';
import {queryKeys} from './queryKeys';
import {cachedMyId, type SessionSnapshot} from './sessionSnapshot';
import type {
  BadgeEntityType,
  Catalog,
  ExperienceList,
  GuildCard,
  GuildProfile,
  ManualBadgeGrant,
  Me,
  MyGuild,
  MyPostsParams,
  Paginated,
  Post,
  PostDetail,
  PostModeration,
  PostWriteResult,
  PrivateExperience,
  PrivatePost,
  RefreshGuildsResponse,
  Report,
  Snowflake,
  StaffBadgesPage,
  StaffExperience,
  StaffExperienceStatus,
  StaffReportStatus,
  UserProfile,
  Uuid,
} from './types';

type Infinite<Page> = InfiniteData<Page, string | null>;

/** Patches every cached query under `queryKey`; sets only what changed. */
function patchQueries<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  patch: (data: T, key: QueryKey) => T | undefined,
): void {
  for (const [key, data] of queryClient.getQueriesData<T>({queryKey})) {
    if (data === undefined) continue;
    const next = patch(data, key);
    if (next !== undefined && next !== data) queryClient.setQueryData(key, next);
  }
}

/** Patches one cached query, if it is cached. */
function patchQuery<T>(queryClient: QueryClient, queryKey: QueryKey, patch: (data: T) => T): void {
  const data = queryClient.getQueryData<T>(queryKey);
  if (data === undefined) return;
  const next = patch(data);
  if (next !== data) queryClient.setQueryData(queryKey, next);
}

/** Marks stale without fetching: read again the next time it is shown. */
function markStale(queryClient: QueryClient, queryKey: QueryKey): void {
  void queryClient.invalidateQueries({queryKey, refetchType: 'none'});
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

type FeedPages = Infinite<Paginated<Post>>;
type MinePages = Infinite<Paginated<PrivatePost>>;

function patchMyPosts(queryClient: QueryClient, post: PrivatePost): void {
  const myId = cachedMyId(queryClient);
  patchQueries<MinePages>(queryClient, queryKeys.myPostsLists(), (data, key) =>
    upsertItem(data, post, {
      matches: belongsToMyPosts(post, key[2] as MyPostsParams, myId),
      compare: comparePostsCreatedDesc,
    }),
  );
}

function removeFromFeeds(queryClient: QueryClient, predicate: (post: Post) => boolean): void {
  patchQueries<FeedPages>(queryClient, queryKeys.feeds(), (data) => removeItems(data, predicate));
}

/** Every public place that lists posts, minus one: the feed, the server and the person profiles. */
function removeFromPublicLists(queryClient: QueryClient, postId: Uuid): void {
  removeFromFeeds(queryClient, (post) => post.id === postId);
  patchQueries<GuildProfile>(queryClient, queryKeys.guildDetails(), (profile) =>
    withoutPostInGuildProfile(profile, postId),
  );
  patchQueries<UserProfile>(queryClient, queryKeys.userDetails(), (profile) =>
    withoutPostInUserProfile(profile, postId),
  );
  patchQuery<UserProfile>(queryClient, queryKeys.myProfile(), (profile) => withoutPostInUserProfile(profile, postId));
}

/**
 * A post was created, edited, published or closed (the response is the whole
 * post). It is the new truth in the detail cache and in every list it belongs
 * to. The feed is never read again: a published post stays where it is (and
 * shows its edit), a post that is no longer published leaves it.
 */
export function syncPostWritten(queryClient: QueryClient, post: PostWriteResult): void {
  queryClient.setQueryData<PostDetail>(queryKeys.postDetail(post.id), post);
  patchMyPosts(queryClient, post);

  if (isPubliclyListed(post)) {
    const publicPost = toPublicPost(post);
    patchQueries<FeedPages>(queryClient, queryKeys.feeds(), (data) =>
      mapItems(data, (item) => (item.id === post.id ? publicPost : item)),
    );
  } else {
    removeFromFeeds(queryClient, (item) => item.id === post.id);
  }

  if (post.guild_id) {
    patchQuery<GuildProfile>(queryClient, queryKeys.guildDetail(post.guild_id), (profile) =>
      withPostInGuildProfile(profile, post),
    );
  } else {
    patchQuery<UserProfile>(queryClient, queryKeys.userDetail(post.author_id), (profile) =>
      withPostInUserProfile(profile, post),
    );
    if (post.author_id === cachedMyId(queryClient)) {
      patchQuery<UserProfile>(queryClient, queryKeys.myProfile(), (profile) => withPostInUserProfile(profile, post));
    }
  }
}

/** A post was deleted: gone from every cache. */
export function syncPostDeleted(queryClient: QueryClient, postId: Uuid): void {
  queryClient.removeQueries({queryKey: queryKeys.postDetail(postId), exact: true});
  patchQueries<MinePages>(queryClient, queryKeys.myPostsLists(), (data) =>
    removeItems(data, (post) => post.id === postId),
  );
  removeFromPublicLists(queryClient, postId);
}

/** A post anywhere in the cache: its detail, or a row of one of my lists. */
function findCachedPost(queryClient: QueryClient, postId: Uuid): PrivatePost | undefined {
  const detail = queryClient.getQueryData<PostDetail>(queryKeys.postDetail(postId));
  if (detail) return {...detail, hidden_reason: detail.hidden_reason ?? null};
  for (const [, data] of queryClient.getQueriesData<MinePages>({queryKey: queryKeys.myPostsLists()})) {
    for (const page of data?.pages ?? []) {
      const found = page.items.find((post) => post.id === postId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * The staff hid or showed a post again (the response is only
 * `{id, status, hidden_reason}`). It leaves the public side whatever it was,
 * and the copies the editors hold follow: status and reason, and the status tab
 * they now belong to.
 */
export function syncPostModerated(queryClient: QueryClient, moderation: PostModeration): void {
  removeFromPublicLists(queryClient, moderation.id);

  const known = findCachedPost(queryClient, moderation.id);
  if (!known) return;
  const moderated = withModeration(known, moderation);

  patchQuery<PostDetail>(queryClient, queryKeys.postDetail(moderation.id), (detail) =>
    withModeration(detail, moderation),
  );
  patchMyPosts(queryClient, moderated);
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

/**
 * A server profile came back whole (claim, PUT, refresh): it is the detail,
 * the person's list of servers is patched (claimed, name, icon), and the
 * directory card follows. A claim adds a server to the directory: marked stale.
 */
export function syncGuildProfile(
  queryClient: QueryClient,
  profile: GuildProfile,
  options: {claimed?: boolean} = {},
): void {
  queryClient.setQueryData<GuildProfile>(queryKeys.guildDetail(profile.id), profile);
  patchQuery<MyGuild[]>(queryClient, queryKeys.myGuilds(), (list) => upsertMyGuild(list, profile));
  patchQueries<Infinite<Paginated<GuildCard>>>(queryClient, queryKeys.directories(), (data) =>
    withGuildInDirectory(data, profile),
  );
  if (options.claimed) markStale(queryClient, queryKeys.directories());
}

/** A server profile was deleted. Its draft and published posts were closed by the API: the caches say so too. */
export function syncGuildDeleted(queryClient: QueryClient, guildId: Snowflake): void {
  queryClient.removeQueries({queryKey: queryKeys.guildDetail(guildId), exact: true});
  patchQuery<MyGuild[]>(queryClient, queryKeys.myGuilds(), (list) => unclaimMyGuild(list, guildId));
  patchQueries<Infinite<Paginated<GuildCard>>>(queryClient, queryKeys.directories(), (data) =>
    removeItems(data, (card: GuildCard) => card.id === guildId),
  );
  removeFromFeeds(queryClient, (post) => post.guild_id === guildId);

  // The posts of the server that are held somewhere, closed; hidden ones stay hidden.
  const closed = new Map<Uuid, PrivatePost>();
  const collect = (post: PrivatePost) => {
    const next = closedWithGuild(post, guildId);
    if (next !== post) closed.set(post.id, next);
  };
  for (const [, data] of queryClient.getQueriesData<MinePages>({queryKey: queryKeys.myPostsLists()})) {
    data?.pages.forEach((page) => page.items.forEach(collect));
  }
  for (const [, detail] of queryClient.getQueriesData<PostDetail>({queryKey: queryKeys.postDetails()})) {
    if (detail) collect(detail as PrivatePost);
  }
  for (const post of closed.values()) {
    patchQuery<PostDetail>(queryClient, queryKeys.postDetail(post.id), (detail) => closedWithGuild(detail, guildId));
    patchMyPosts(queryClient, post);
  }
}

/** `POST /lineup/me/refresh-guilds`: the fresh list replaces the cached one, unless Discord was silent (an incomplete list). */
export function syncMyGuildsRefreshed(queryClient: QueryClient, response: RefreshGuildsResponse): void {
  if (!response.stale) queryClient.setQueryData<MyGuild[]>(queryKeys.myGuilds(), response.guilds);
}

// ---------------------------------------------------------------------------
// Profile and experiences
// ---------------------------------------------------------------------------

/** `PUT /lineup/me/profile`. */
export function syncMyProfile(queryClient: QueryClient, profile: UserProfile): void {
  queryClient.setQueryData<UserProfile>(queryKeys.myProfile(), profile);
  queryClient.setQueryData<UserProfile>(queryKeys.userDetail(profile.id), profile);

  // The raw row in `GET /lineup/me` carries the same fields.
  patchQuery<SessionSnapshot>(queryClient, queryKeys.me(), (snapshot) => {
    if (snapshot.status !== 'authenticated' || !snapshot.me.profile) return snapshot;
    const row: Me['profile'] = {
      ...snapshot.me.profile,
      headline: profile.headline,
      bio: profile.bio,
      links: profile.links,
      languages: profile.languages,
      timezone: profile.timezone,
      open_to_work: profile.open_to_work,
    };
    return {status: 'authenticated', me: {...snapshot.me, profile: row}};
  });
}

/** The profiles that hold the person's experiences: their own, and the public page of themselves. */
function patchMyProfiles(queryClient: QueryClient, patch: (profile: UserProfile) => UserProfile): void {
  patchQuery<UserProfile>(queryClient, queryKeys.myProfile(), patch);
  const myId = cachedMyId(queryClient);
  if (myId) patchQuery<UserProfile>(queryClient, queryKeys.userDetail(myId), patch);
}

/** A server's team is computed by the API from verified, current experiences. */
function markTeamStale(queryClient: QueryClient, guildId: Snowflake | null): void {
  if (guildId) markStale(queryClient, queryKeys.guildDetail(guildId));
}

/** An experience was created, edited, verified or sent to review (the response is the whole experience). */
export function syncExperienceWritten(queryClient: QueryClient, experience: PrivateExperience): void {
  patchQuery<ExperienceList>(queryClient, queryKeys.myExperiences(), (list) => ({
    ...list,
    items: withExperience({experiences: list.items}, experience).experiences as PrivateExperience[],
  }));
  patchMyProfiles(queryClient, (profile) => withExperience(profile, experience));
  markTeamStale(queryClient, experience.guild_id);
}

/** `PUT /lineup/me/experiences/order`: the answer is the whole list in its new order. */
export function syncExperiencesReordered(queryClient: QueryClient, list: ExperienceList): void {
  queryClient.setQueryData<ExperienceList>(queryKeys.myExperiences(), list);
  patchMyProfiles(queryClient, (profile) => withExperienceOrder(profile, list.items));
}

/** An experience was deleted: out of the lists, and no post features it any more. */
export function syncExperienceDeleted(queryClient: QueryClient, experienceId: Uuid): void {
  const guildId =
    queryClient.getQueryData<ExperienceList>(queryKeys.myExperiences())?.items.find((item) => item.id === experienceId)
      ?.guild_id ?? null;

  patchQuery<ExperienceList>(queryClient, queryKeys.myExperiences(), (list) => {
    const items = list.items.filter((item) => item.id !== experienceId);
    return items.length === list.items.length ? list : {...list, items};
  });
  patchMyProfiles(queryClient, (profile) => withoutExperience(profile, experienceId));
  markTeamStale(queryClient, guildId);

  patchQueries<MinePages>(queryClient, queryKeys.myPostsLists(), (data) =>
    mapItems(data, (post: PrivatePost) => withoutFeaturedExperience(post, experienceId)),
  );
  patchQueries<PostDetail>(queryClient, queryKeys.postDetails(), (detail) =>
    withoutFeaturedExperience(detail, experienceId),
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const EXPERIENCE_STATUSES: StaffExperienceStatus[] = ['pending', 'unverified', 'verified', 'rejected'];

/**
 * The staff verified or rejected an experience: it leaves the status list it
 * was in and joins the one it is now in (if that list is loaded far enough),
 * and the owner's profile, if cached, shows the new verification.
 */
export function syncStaffExperience(queryClient: QueryClient, experience: StaffExperience): void {
  for (const status of EXPERIENCE_STATUSES) {
    patchQuery<Infinite<Paginated<StaffExperience>>>(
      queryClient,
      queryKeys.staffExperiences(status),
      (data) =>
        upsertItem(data, experience, {
          matches: experience.verification.status === status,
          compare: compareByUpdatedAsc,
        }) ?? data,
    );
  }
  patchQuery<UserProfile>(queryClient, queryKeys.userDetail(experience.user_id), (profile) =>
    withReplacedExperience(profile, experience),
  );
  if (experience.user_id === cachedMyId(queryClient)) {
    patchMyProfiles(queryClient, (profile) => withReplacedExperience(profile, experience));
    patchQuery<ExperienceList>(queryClient, queryKeys.myExperiences(), (list) => ({
      ...list,
      items: withReplacedExperience({experiences: list.items}, experience).experiences as PrivateExperience[],
    }));
  }
  markTeamStale(queryClient, experience.guild_id);
}

const REPORT_STATUSES: StaffReportStatus[] = ['open', 'resolved', 'dismissed', 'all'];

/** A report was resolved or dismissed: it moves from `open` to its new status, and stays in `all`. */
export function syncReportHandled(queryClient: QueryClient, report: Report): void {
  for (const status of REPORT_STATUSES) {
    patchQuery<Infinite<Paginated<Report>>>(
      queryClient,
      queryKeys.staffReports(status),
      (data) =>
        upsertItem(data, report, {
          matches: status === 'all' || report.status === status,
          compare: compareByCreatedDesc,
        }) ?? data,
    );
  }
}

/** The badges shown on the profile of the entity, and the staff's list of grants. */
export function syncBadgeGrant(queryClient: QueryClient, grant: ManualBadgeGrant): void {
  patchQuery<InfiniteData<StaffBadgesPage, number>>(
    queryClient,
    queryKeys.staffBadges(grant.entity_type),
    (data) => withBadgeGrant(data, grant) ?? data,
  );
  patchEntityBadges(queryClient, grant.entity_type, grant.entity_id, grant.badge, true);
}

export function syncBadgeRevoked(
  queryClient: QueryClient,
  key: {entityType: BadgeEntityType; entityId: Snowflake; badge: string},
): void {
  patchQuery<InfiniteData<StaffBadgesPage, number>>(
    queryClient,
    queryKeys.staffBadges(key.entityType),
    (data) => withoutBadgeGrant(data, {entity_type: key.entityType, entity_id: key.entityId, badge: key.badge}) ?? data,
  );
  patchEntityBadges(queryClient, key.entityType, key.entityId, key.badge, false);
}

function patchEntityBadges(
  queryClient: QueryClient,
  entityType: BadgeEntityType,
  entityId: Snowflake,
  badge: string,
  present: boolean,
): void {
  const catalog = queryClient.getQueryData<Catalog>(queryKeys.catalog());
  if (entityType === 'guild') {
    patchQuery<GuildProfile>(queryClient, queryKeys.guildDetail(entityId), (profile) => {
      const badges = withManualBadge(profile.badges, badge, present, catalog);
      return badges === profile.badges ? profile : {...profile, badges};
    });
    return;
  }
  const patch = (profile: UserProfile) => {
    const badges = withManualBadge(profile.badges, badge, present, catalog);
    return badges === profile.badges ? profile : {...profile, badges};
  };
  patchQuery<UserProfile>(queryClient, queryKeys.userDetail(entityId), patch);
  if (entityId === cachedMyId(queryClient)) patchQuery<UserProfile>(queryClient, queryKeys.myProfile(), patch);
}
