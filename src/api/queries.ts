/**
 * The reads, as TanStack Query hooks. Keys come from queryKeys.ts; the writes
 * (and what they do to these caches) are in mutations.ts and cacheSync.ts.
 *
 *  - Paginated lists are `useInfiniteQuery` with `getNextPageParam: last =>
 *    last.next_cursor ?? undefined`. The cursor is opaque: never built, never read.
 *    Wrap one in `useInfiniteList` (pagination.ts) for a flat list that follows empty pages.
 *  - A hook for someone's own data (`useMyProfile`, `useMyPosts`…) waits for a
 *    signed-in session and carries `meta.requiresAuth`: a 401 on it means the
 *    session is gone (routeApiError), without redirecting anywhere.
 *  - The catalog is loaded once per visit and kept for good: the browser caches it
 *    for an hour (`Cache-Control`) and it only changes with a deploy.
 *  - The `…Query` options are shared with the route loaders (app/preload.ts),
 *    which read a page's data before showing it: same key, same request.
 */

import {
  type InfiniteData,
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import type {ApiError} from './client';
import {
  getAccount,
  getBot,
  getBots,
  getCatalog,
  getFeed,
  getGuild,
  getMyBots,
  getMyExperiences,
  getMyGuilds,
  getMyPosts,
  getMyProfile,
  getPost,
  getStaffBadges,
  getStaffExperiences,
  getStaffReports,
  getUser,
  lookupBot,
} from './endpoints';
import {normalizeBotFilters, normalizeFeedFilters, normalizeMyPostsParams, queryKeys} from './queryKeys';
import {shouldRetry} from './retry';
import {fetchSession} from './sessionSnapshot';
import type {
  BadgeEntityType,
  BotDirectoryFilters,
  FeedFilters,
  MyPostsParams,
  Paginated,
  Snowflake,
  StaffBadgesPage,
  StaffExperienceStatus,
  StaffReportStatus,
  Uuid,
  Post,
  PrivatePost,
} from './types';

/** `getNextPageParam` of every cursor-paginated list. `undefined` ends the list. */
const nextCursor = (last: Paginated<unknown>): string | undefined => last.next_cursor ?? undefined;

/** The first page has no cursor. */
const FIRST_PAGE = null as string | null;

// ---------------------------------------------------------------------------
// Session and catalog
// ---------------------------------------------------------------------------

/**
 * The session: authenticated, anonymous or suspended (sessionSnapshot.ts). A
 * network failure is retried once, then the query errors and the person is
 * treated as signed out. It is read again when the window regains focus, so
 * signing in in another tab shows up.
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({signal}) => fetchSession(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => failureCount < 1 && shouldRetry(failureCount, error),
  });
}

/**
 * The e-mail of the signed-in person (`GET /auth/me`, a dashboard route).
 * Optional data: a failure is not retried and the e-mail is simply not shown.
 */
export function useAccountEmail(): string | null {
  const signedIn = useIsSignedIn();
  const {data} = useQuery({
    queryKey: queryKeys.account(),
    queryFn: ({signal}) => getAccount({signal}),
    enabled: signedIn,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return data?.email ?? null;
}

/** True once the session is known to be a signed-in one: gates the person's own data. */
export function useIsSignedIn(): boolean {
  return useMe().data?.status === 'authenticated';
}

/** Whether the signed-in person is staff: gates the console's data. */
export function useIsStaff(): boolean {
  const {data} = useMe();
  return data?.status === 'authenticated' && data.me.user.is_staff;
}

/** The catalog (LINEUP.md §4): the closed lists and the limits. Never hardcode these. */
export const catalogQuery = () =>
  queryOptions({
    queryKey: queryKeys.catalog(),
    queryFn: ({signal}) => getCatalog({signal}),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export function useCatalog() {
  return useQuery(catalogQuery());
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/**
 * The public feed. The server caches each filter and cursor for 60 s, so the
 * data is fresh for 60 s here too, and the previous filters' results stay on
 * screen while new ones load (`isPlaceholderData`).
 */
export const feedQuery = (filters: FeedFilters = {}) => {
  const normalized = normalizeFeedFilters(filters);
  return infiniteQueryOptions({
    queryKey: queryKeys.feed(normalized),
    queryFn: ({pageParam, signal}) => getFeed(normalized, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    staleTime: 60_000,
  });
};

/**
 * `projects`: the posts of servers AND bots, without the people's (the
 * "Projets" page with no type filter). The API takes one `kind` only: the
 * request goes without a kind and each page is filtered here;
 * `useInfiniteList` follows a page the filter emptied.
 */
export function useFeed(filters: FeedFilters = {}, options: {projects?: boolean} = {}) {
  return useInfiniteQuery({
    ...feedQuery(filters),
    placeholderData: keepPreviousData,
    select: options.projects ? onlyProjects : undefined,
  });
}

function onlyProjects(data: InfiniteData<Paginated<Post>, string | null>) {
  return {
    ...data,
    pages: data.pages.map((page) => ({...page, items: page.items.filter((post) => post.kind !== 'user')})),
  };
}

/** A post's detail. Visible to everyone if published; drafts, closed and hidden posts only to their editors. */
export const postQuery = (postId: Uuid) =>
  queryOptions({queryKey: queryKeys.postDetail(postId), queryFn: ({signal}) => getPost(postId, {signal})});

export function usePost(postId: Uuid | undefined) {
  return useQuery({...postQuery(postId ?? ''), enabled: !!postId});
}

/**
 * The person's own posts, every status, newest created first. With a `guildId`,
 * every post of that server whoever wrote it (managers only).
 */
export const myPostsQuery = (params: MyPostsParams = {}) => {
  const normalized = normalizeMyPostsParams(params);
  return infiniteQueryOptions({
    queryKey: queryKeys.myPosts(normalized),
    queryFn: ({pageParam, signal}) => getMyPosts(normalized, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    meta: {requiresAuth: true},
  });
};

/**
 * `personal`: only the person's posts for themselves (`kind: user`), the posts
 * of "my space". The API has no such filter (without `guild_id` it sends every
 * post the person wrote, for themselves and for their servers): each page is
 * filtered here, and `useInfiniteList` follows a page the filter emptied.
 */
export function useMyPosts(params: MyPostsParams = {}, options: {personal?: boolean} = {}) {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    ...myPostsQuery(params),
    enabled: signedIn,
    select: options.personal ? onlyPersonal : undefined,
  });
}

function onlyPersonal(data: InfiniteData<Paginated<PrivatePost>, string | null>) {
  return {
    ...data,
    pages: data.pages.map((page) => ({...page, items: page.items.filter((post) => post.kind === 'user')})),
  };
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

/** A server's profile. */
export const guildQuery = (guildId: Snowflake) =>
  queryOptions({queryKey: queryKeys.guildDetail(guildId), queryFn: ({signal}) => getGuild(guildId, {signal})});

export function useGuild(guildId: Snowflake | undefined) {
  return useQuery({...guildQuery(guildId ?? ''), enabled: !!guildId});
}

/** The servers the person can manage, claimed or not. */
export const myGuildsQuery = () =>
  queryOptions({
    queryKey: queryKeys.myGuilds(),
    queryFn: ({signal}) => getMyGuilds({signal}),
    meta: {requiresAuth: true},
  });

export function useMyGuilds() {
  const signedIn = useIsSignedIn();
  return useQuery({...myGuildsQuery(), enabled: signedIn});
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/** The bot directory, 60 s of server cache like the feed. */
export const botsQuery = (filters: BotDirectoryFilters = {}) => {
  const normalized = normalizeBotFilters(filters);
  return infiniteQueryOptions({
    queryKey: queryKeys.botDirectory(normalized),
    queryFn: ({pageParam, signal}) => getBots(normalized, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    staleTime: 60_000,
  });
};

export function useBots(filters: BotDirectoryFilters = {}) {
  return useInfiniteQuery({...botsQuery(filters), placeholderData: keepPreviousData});
}

/** A bot's profile. */
export const botQuery = (botId: Snowflake) =>
  queryOptions({queryKey: queryKeys.botDetail(botId), queryFn: ({signal}) => getBot(botId, {signal})});

export function useBot(botId: Snowflake | undefined) {
  return useQuery({...botQuery(botId ?? ''), enabled: !!botId});
}

/** The bots the person manages (owner or administrator of the support server), listed or not. */
export const myBotsQuery = () =>
  queryOptions({
    queryKey: queryKeys.myBots(),
    queryFn: ({signal}) => getMyBots({signal}),
    meta: {requiresAuth: true},
  });

export function useMyBots() {
  const signedIn = useIsSignedIn();
  return useQuery({...myBotsQuery(), enabled: signedIn});
}

/**
 * The preview of a bot before a claim or an experience. 20 per minute per
 * person: pass an id only once the person submitted it. Never retried on its
 * own, and kept a minute (the same id is not asked twice).
 */
export function useBotLookup(botId: Snowflake | null) {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.botLookup(botId ?? ''),
    queryFn: ({signal}) => lookupBot(botId!, {signal}),
    enabled: signedIn && !!botId,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    meta: {requiresAuth: true},
  });
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** A person's public profile (the private view of experiences for oneself and the staff). */
export const userQuery = (userId: Snowflake) =>
  queryOptions({queryKey: queryKeys.userDetail(userId), queryFn: ({signal}) => getUser(userId, {signal})});

export function useUser(userId: Snowflake | undefined) {
  return useQuery({...userQuery(userId ?? ''), enabled: !!userId});
}

export const myProfileQuery = () =>
  queryOptions({
    queryKey: queryKeys.myProfile(),
    queryFn: ({signal}) => getMyProfile({signal}),
    meta: {requiresAuth: true},
  });

export function useMyProfile() {
  const signedIn = useIsSignedIn();
  return useQuery({...myProfileQuery(), enabled: signedIn});
}

/** The person's experiences, in their order. */
export const myExperiencesQuery = () =>
  queryOptions({
    queryKey: queryKeys.myExperiences(),
    queryFn: ({signal}) => getMyExperiences({signal}),
    meta: {requiresAuth: true},
  });

export function useMyExperiences() {
  const signedIn = useIsSignedIn();
  return useQuery({...myExperiencesQuery(), enabled: signedIn});
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/** The experience review queue, oldest change first. */
export function useStaffExperiences(status: StaffExperienceStatus = 'pending') {
  const isStaff = useIsStaff();
  return useInfiniteQuery({
    queryKey: queryKeys.staffExperiences(status),
    queryFn: ({pageParam, signal}) => getStaffExperiences(status, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    enabled: isStaff,
    meta: {requiresAuth: true},
  });
}

/** The report queue, newest first. */
export function useStaffReports(status: StaffReportStatus = 'open') {
  const isStaff = useIsStaff();
  return useInfiniteQuery({
    queryKey: queryKeys.staffReports(status),
    queryFn: ({pageParam, signal}) => getStaffReports(status, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    enabled: isStaff,
    meta: {requiresAuth: true},
  });
}

/** How many manual badges one page of the console holds. */
export const STAFF_BADGES_PAGE_SIZE = 100;

/**
 * The manual badges granted, newest first. This list pages by limit and offset
 * (no cursor, no total): there is a next page when the last one was full.
 */
export function useStaffBadges(entityType: BadgeEntityType) {
  const isStaff = useIsStaff();
  return useInfiniteQuery<StaffBadgesPage, ApiError, InfiniteData<StaffBadgesPage, number>, readonly unknown[], number>(
    {
      queryKey: queryKeys.staffBadges(entityType),
      queryFn: ({pageParam, signal}) =>
        getStaffBadges(entityType, {limit: STAFF_BADGES_PAGE_SIZE, offset: pageParam, signal}),
      initialPageParam: 0,
      getNextPageParam: (last, _pages, lastOffset) =>
        last.items.length >= STAFF_BADGES_PAGE_SIZE ? lastOffset + STAFF_BADGES_PAGE_SIZE : undefined,
      enabled: isStaff,
      meta: {requiresAuth: true},
    },
  );
}
