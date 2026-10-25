/** Posts (LINEUP.md §6.4). */

import {apiFetch} from '../client';
import type {
  CreatePostBody,
  FeedFilters,
  MyPostsParams,
  Paginated,
  Post,
  PostDetail,
  PostWriteResult,
  PrivatePost,
  UpdatePostBody,
  Uuid,
} from '../types';
import {enc, type PageOptions, type ReadOptions} from './shared';

/** `GET /lineup/posts`: the public feed, most recently published first. Cached 60 s by the server. */
export function getFeed(
  filters: FeedFilters = {},
  {cursor, limit, signal}: PageOptions = {},
): Promise<Paginated<Post>> {
  return apiFetch<Paginated<Post>>('/lineup/posts', {
    signal,
    query: {
      kind: filters.kind,
      positions: filters.positions,
      languages: filters.languages,
      tags: filters.tags,
      theme: filters.theme,
      compensation: filters.compensation,
      q: filters.q?.trim(),
      guild_id: filters.guild_id,
      bot_id: filters.bot_id,
      author_id: filters.author_id,
      include_nsfw: filters.include_nsfw ? true : undefined,
      limit,
      cursor,
    },
  });
}

/**
 * `GET /lineup/me/posts`: every status, newest created first, private view.
 * With a `guildId` (or a `botId`): all the posts of that server (or bot) whoever wrote them (managers only).
 */
export function getMyPosts(
  {guildId, botId, status}: MyPostsParams = {},
  {cursor, limit, signal}: PageOptions = {},
): Promise<Paginated<PrivatePost>> {
  return apiFetch<Paginated<PrivatePost>>('/lineup/me/posts', {
    signal,
    query: {guild_id: guildId, bot_id: botId, status, limit, cursor},
  });
}

/** `GET /lineup/posts/{post_id}`: `hidden_reason` is there only when `can_edit` is true. */
export function getPost(postId: Uuid, {signal}: ReadOptions = {}): Promise<PostDetail> {
  return apiFetch<PostDetail>(`/lineup/posts/${enc(postId)}`, {signal});
}

/** `POST /lineup/posts`: 201 with the private view. A draft by default. */
export function createPost(body: CreatePostBody): Promise<PostWriteResult> {
  return apiFetch<PostWriteResult>('/lineup/posts', {method: 'POST', body});
}

/** `PATCH /lineup/posts/{post_id}`: partial. See `UpdatePostBody` for which fields take null. */
export function updatePost(postId: Uuid, body: UpdatePostBody): Promise<PostWriteResult> {
  return apiFetch<PostWriteResult>(`/lineup/posts/${enc(postId)}`, {method: 'PATCH', body});
}

/** `POST /lineup/posts/{post_id}/publish`: a draft or closed post goes live (quota and expiry are checked again). */
export function publishPost(postId: Uuid): Promise<PostWriteResult> {
  return apiFetch<PostWriteResult>(`/lineup/posts/${enc(postId)}/publish`, {method: 'POST'});
}

/** `POST /lineup/posts/{post_id}/close`: a published post is closed. */
export function closePost(postId: Uuid): Promise<PostWriteResult> {
  return apiFetch<PostWriteResult>(`/lineup/posts/${enc(postId)}/close`, {method: 'POST'});
}

/** `DELETE /lineup/posts/{post_id}`: 204, for good. A hidden post cannot be deleted by its author. */
export function deletePost(postId: Uuid): Promise<void> {
  return apiFetch<void>(`/lineup/posts/${enc(postId)}`, {method: 'DELETE'});
}
