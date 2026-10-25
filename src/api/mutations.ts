/**
 * The writes, as TanStack Query mutations. Each one updates the cache from the
 * response of the API (cacheSync.ts documents what each touches), so a page
 * shows the result at once and nothing re-reads the feed (LINEUP.md §0 "Cache").
 *
 * Mutations are never retried: a write is not repeated behind the person's
 * back, and a 503 or a 429 is shown with its countdown (`useRetryAfter`).
 *
 * Call them through `useAuthAction().run(...)` so that a missing or expired
 * session sends the person to sign in rather than failing.
 */

import {useMutation, useQueryClient} from '@tanstack/react-query';

import {
  syncBadgeGrant,
  syncBadgeRevoked,
  syncBotDeleted,
  syncBotProfile,
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
import {
  claimBot,
  claimGuild,
  closePost,
  createExperience,
  createPost,
  createReport,
  deleteBot,
  deleteExperience,
  deleteGuild,
  deletePost,
  dismissReport,
  grantBadge,
  hidePost,
  publishPost,
  refreshBot,
  refreshGuild,
  refreshMyGuilds,
  reorderExperiences,
  requestExperienceReview,
  resolveReport,
  revokeBadge,
  staffRejectExperience,
  staffVerifyExperience,
  unhidePost,
  updateBot,
  updateExperience,
  updateGuild,
  updateMyProfile,
  updatePost,
  verifyExperience,
} from './endpoints';
import type {
  BadgeEntityType,
  ClaimGuildBody,
  CreateExperienceBody,
  CreatePostBody,
  CreateReportBody,
  Snowflake,
  UpdateBotBody,
  UpdateExperienceBody,
  UpdateGuildBody,
  UpdatePostBody,
  UpdateProfileBody,
  Uuid,
} from './types';

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/** Creates a post (a draft unless `status: 'published'`). */
export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePostBody) => createPost(body),
    onSuccess: (post) => syncPostWritten(queryClient, post),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({postId, body}: {postId: Uuid; body: UpdatePostBody}) => updatePost(postId, body),
    onSuccess: (post) => syncPostWritten(queryClient, post),
  });
}

/** A draft or closed post goes live. */
export function usePublishPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: Uuid) => publishPost(postId),
    onSuccess: (post) => syncPostWritten(queryClient, post),
  });
}

/** A published post is closed: it leaves the feed at once. */
export function useClosePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: Uuid) => closePost(postId),
    onSuccess: (post) => syncPostWritten(queryClient, post),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: Uuid) => deletePost(postId),
    onSuccess: (_void, postId) => syncPostDeleted(queryClient, postId),
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** Reports a post, a profile, a server or a bot. `created: false` in the result means "already reported". Nothing to cache. */
export function useCreateReport() {
  return useMutation({mutationFn: (body: CreateReportBody) => createReport(body)});
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

export function useClaimGuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClaimGuildBody) => claimGuild(body),
    onSuccess: (profile) => syncGuildProfile(queryClient, profile),
  });
}

export function useUpdateGuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({guildId, body}: {guildId: Snowflake; body: UpdateGuildBody}) => updateGuild(guildId, body),
    onSuccess: (profile) => syncGuildProfile(queryClient, profile),
  });
}

/** Removes the profile; the API closes the server's draft and published posts. Confirm in the UI first. */
export function useDeleteGuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guildId: Snowflake) => deleteGuild(guildId),
    onSuccess: (_void, guildId) => syncGuildDeleted(queryClient, guildId),
  });
}

/** Reads the Discord snapshot again (one per minute per server: 429 with `retry_after`). */
export function useRefreshGuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guildId: Snowflake) => refreshGuild(guildId),
    onSuccess: (profile) => syncGuildProfile(queryClient, profile),
  });
}

/** Reads the person's servers from Discord again. The result carries `stale` (Discord was silent). */
export function useRefreshMyGuilds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshMyGuilds(),
    onSuccess: (response) => syncMyGuildsRefreshed(queryClient, response),
  });
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/** Claims a bot (owner or administrator of its support server). 201 with the full profile. */
export function useClaimBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: Snowflake) => claimBot(botId),
    onSuccess: (profile) => syncBotProfile(queryClient, profile),
  });
}

export function useUpdateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({botId, body}: {botId: Snowflake; body: UpdateBotBody}) => updateBot(botId, body),
    onSuccess: (profile) => syncBotProfile(queryClient, profile),
  });
}

/** Removes the profile; the API closes the bot's draft and published posts first. Confirm in the UI. */
export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: Snowflake) => deleteBot(botId),
    onSuccess: (_void, botId) => syncBotDeleted(queryClient, botId),
  });
}

/** Reads Discord again (once per minute per bot: 429 with `retry_after`). */
export function useRefreshBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: Snowflake) => refreshBot(botId),
    onSuccess: (profile) => syncBotProfile(queryClient, profile),
  });
}

// ---------------------------------------------------------------------------
// Profile and experiences
// ---------------------------------------------------------------------------

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileBody) => updateMyProfile(body),
    onSuccess: (profile) => syncMyProfile(queryClient, profile),
  });
}

export function useCreateExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExperienceBody) => createExperience(body),
    onSuccess: (experience) => syncExperienceWritten(queryClient, experience),
  });
}

/** Editing the server, the position, the dates or a service's name resets a verification: warn first. */
export function useUpdateExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({experienceId, body}: {experienceId: Uuid; body: UpdateExperienceBody}) =>
      updateExperience(experienceId, body),
    onSuccess: (experience) => syncExperienceWritten(queryClient, experience),
  });
}

/** `ids` must be every experience, once each. */
export function useReorderExperiences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: Uuid[]) => reorderExperiences(ids),
    onSuccess: (list) => syncExperiencesReordered(queryClient, list),
  });
}

export function useDeleteExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (experienceId: Uuid) => deleteExperience(experienceId),
    onSuccess: (_void, experienceId) => syncExperienceDeleted(queryClient, experienceId),
  });
}

/** The automatic check through Discord (5 tries per 10 minutes). */
export function useVerifyExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (experienceId: Uuid) => verifyExperience(experienceId),
    onSuccess: (experience) => syncExperienceWritten(queryClient, experience),
  });
}

export function useRequestExperienceReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({experienceId, note}: {experienceId: Uuid; note?: string}) =>
      requestExperienceReview(experienceId, {note}),
    onSuccess: (experience) => syncExperienceWritten(queryClient, experience),
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export function useStaffVerifyExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({experienceId, note}: {experienceId: Uuid; note?: string}) =>
      staffVerifyExperience(experienceId, {note}),
    onSuccess: (experience) => syncStaffExperience(queryClient, experience),
  });
}

export function useStaffRejectExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({experienceId, reason}: {experienceId: Uuid; reason: string}) =>
      staffRejectExperience(experienceId, {reason}),
    onSuccess: (experience) => syncStaffExperience(queryClient, experience),
  });
}

export function useGrantBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      badge,
      note,
    }: {
      entityType: BadgeEntityType;
      entityId: Snowflake;
      badge: string;
      note?: string;
    }) => grantBadge(entityType, entityId, badge, {note}),
    onSuccess: (grant) => syncBadgeGrant(queryClient, grant),
  });
}

export function useRevokeBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: {entityType: BadgeEntityType; entityId: Snowflake; badge: string}) =>
      revokeBadge(key.entityType, key.entityId, key.badge),
    onSuccess: (_void, key) => syncBadgeRevoked(queryClient, key),
  });
}

export function useHidePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({postId, reason}: {postId: Uuid; reason: string}) => hidePost(postId, {reason}),
    onSuccess: (moderation) => syncPostModerated(queryClient, moderation),
  });
}

/** The post becomes `closed`, never `published`: its author publishes it again. */
export function useUnhidePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: Uuid) => unhidePost(postId),
    onSuccess: (moderation) => syncPostModerated(queryClient, moderation),
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: Uuid) => resolveReport(reportId),
    onSuccess: (report) => syncReportHandled(queryClient, report),
  });
}

export function useDismissReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: Uuid) => dismissReport(reportId),
    onSuccess: (report) => syncReportHandled(queryClient, report),
  });
}
