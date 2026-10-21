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
 */

import {type InfiniteData, keepPreviousData, useInfiniteQuery, useQuery} from '@tanstack/react-query';

import type {ApiError} from './client';
import {
  getCatalog,
  getFeed,
  getGuild,
  getGuildDirectory,
  getMyExperiences,
  getMyGuilds,
  getMyPosts,
  getMyProfile,
  getPost,
  getStaffBadges,
  getStaffExperiences,
  getStaffReports,
  getUser,
} from './endpoints';
import {normalizeDirectoryFilters, normalizeFeedFilters, normalizeMyPostsParams, queryKeys} from './queryKeys';
import {shouldRetry} from './retry';
import {fetchSession} from './sessionSnapshot';
import type {
  BadgeEntityType,
  DirectoryFilters,
  FeedFilters,
  MyPostsParams,
  Paginated,
  Snowflake,
  StaffBadgesPage,
  StaffExperienceStatus,
  StaffReportStatus,
  Uuid,
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
export function useCatalog() {
  return useQuery({
    queryKey: queryKeys.catalog(),
    queryFn: ({signal}) => getCatalog({signal}),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/**
 * The public feed. The server caches each filter and cursor for 60 s, so the
 * data is fresh for 60 s here too, and the previous filters' results stay on
 * screen while new ones load (`isPlaceholderData`).
 */
export function useFeed(filters: FeedFilters = {}) {
  const normalized = normalizeFeedFilters(filters);
  return useInfiniteQuery({
    queryKey: queryKeys.feed(normalized),
    queryFn: ({pageParam, signal}) => getFeed(normalized, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** A post's detail. Visible to everyone if published; drafts, closed and hidden posts only to their editors. */
export function usePost(postId: Uuid | undefined) {
  return useQuery({
    queryKey: queryKeys.postDetail(postId ?? ''),
    queryFn: ({signal}) => getPost(postId!, {signal}),
    enabled: !!postId,
  });
}

/**
 * The person's own posts, every status, newest created first. With a `guildId`,
 * every post of that server whoever wrote it (managers only).
 */
export function useMyPosts(params: MyPostsParams = {}) {
  const normalized = normalizeMyPostsParams(params);
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: queryKeys.myPosts(normalized),
    queryFn: ({pageParam, signal}) => getMyPosts(normalized, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    enabled: signedIn,
    meta: {requiresAuth: true},
  });
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

/** The public directory of servers (60 s of cache on the server). */
export function useGuildDirectory(filters: DirectoryFilters = {}) {
  const normalized = normalizeDirectoryFilters(filters);
  return useInfiniteQuery({
    queryKey: queryKeys.directory(normalized),
    queryFn: ({pageParam, signal}) => getGuildDirectory(normalized, {cursor: pageParam, signal}),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** A server's profile. */
export function useGuild(guildId: Snowflake | undefined) {
  return useQuery({
    queryKey: queryKeys.guildDetail(guildId ?? ''),
    queryFn: ({signal}) => getGuild(guildId!, {signal}),
    enabled: !!guildId,
  });
}

/** The servers the person can manage, claimed or not. */
export function useMyGuilds() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.myGuilds(),
    queryFn: ({signal}) => getMyGuilds({signal}),
    enabled: signedIn,
    meta: {requiresAuth: true},
  });
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** A person's public profile (the private view of experiences for oneself and the staff). */
export function useUser(userId: Snowflake | undefined) {
  return useQuery({
    queryKey: queryKeys.userDetail(userId ?? ''),
    queryFn: ({signal}) => getUser(userId!, {signal}),
    enabled: !!userId,
  });
}

export function useMyProfile() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: ({signal}) => getMyProfile({signal}),
    enabled: signedIn,
    meta: {requiresAuth: true},
  });
}

/** The person's experiences, in their order. */
export function useMyExperiences() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.myExperiences(),
    queryFn: ({signal}) => getMyExperiences({signal}),
    enabled: signedIn,
    meta: {requiresAuth: true},
  });
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
