/**
 * Posts (LINEUP.md §6.4, §8): the public feed, a reader's own posts, the
 * detail, and the state machine draft / published / closed / hidden with its
 * quotas, expiry and editors.
 */

import type {
  ApplicationType,
  Paginated,
  Post,
  PostDetail,
  PostStatus,
  PostWriteResult,
  PrivatePost,
  Snowflake,
  Uuid,
} from '@/api/types';

import {conflict, forbidden, notFound, sanctionError, unprocessable} from '../errors';
import type {Actor, Env, Viewer} from '../env';
import {newUuid} from '../ids';
import type {DbPost} from '../model';
import {iso} from '../time';
import {canManageBot, canManageGuild} from './access';
import {compareKeyed, decodeCursor, pageRows} from './cursor';
import {isCompensation, isPosition, limits, type CreatePostInput} from './schemas';
import {Issues, isUuid, Params} from './validate';
import {toPost, toPostDetail, toPrivatePost, toWriteResult} from './views';
import {
  botSupportGuildId,
  canEditPost,
  isExpired,
  isLive,
  isNsfwPost,
  isPostOfSuspendedEntity,
  isPubliclyVisible,
  isUserSuspended,
} from './visibility';

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

const filterInvalid = (field: string, message: string) => unprocessable('lineup_filter_invalid', message, {field});

/**
 * `GET /lineup/posts`. Standard validation first (limit bounds, numeric ids),
 * then the Lineup filters (`lineup_filter_invalid` + `field`), then the cursor.
 *
 * "SQL" filters first (status, expiry, unlisted servers, NSFW, the filters
 * themselves), a page of `limit + 1` rows, and ONLY THEN the removal of posts
 * whose author or server is suspended (§0). That is how a page ends up short,
 * or empty, with a cursor.
 */
export function listFeed(env: Env, query: URLSearchParams): Paginated<Post> {
  const issues = new Issues();
  const params = new Params('query', query, issues);
  const limit = params.int('limit', {def: 20, ge: 1, le: 50}) ?? 20;
  const includeNsfw = params.bool('include_nsfw');
  const guildId = params.string('guild_id', {pattern: /^\d{1,19}$/});
  const botId = params.string('bot_id', {pattern: /^\d{1,19}$/});
  const authorId = params.string('author_id', {pattern: /^\d{1,19}$/});
  const q = params.string('q', {max: 100});
  const theme = params.string('theme');
  const kind = params.string('kind');
  const compensation = params.string('compensation');
  const cursor = params.get('cursor');
  issues.throwIfAny();

  const positions = params.strings('positions');
  const languages = params.strings('languages').map((value) => value.toLowerCase());
  const tags = params.strings('tags').map((value) => value.toLowerCase());
  if (kind !== undefined && kind !== 'guild' && kind !== 'user' && kind !== 'bot') {
    throw filterInvalid('kind', 'Le filtre kind doit valoir guild, user ou bot.');
  }
  if (compensation !== undefined && !isCompensation(compensation)) {
    throw filterInvalid('compensation', 'Rémunération inconnue.');
  }
  if (positions.length > 10 || positions.some((id) => !isPosition(id))) {
    throw filterInvalid('positions', 'Le filtre positions est invalide (10 postes du catalogue au plus).');
  }
  const after = decodeCursor(cursor, isUuid);

  const needle = q?.trim().toLowerCase();
  const rows = Object.values(env.db.posts)
    .filter((post) => isLive(post, env.now))
    // Posts of an unlisted server or bot (or one with no profile) are excluded in SQL (§6.4).
    .filter((post) =>
      post.kind === 'user'
        ? true
        : post.kind === 'bot'
          ? !!post.bot_id && env.db.botProfiles[post.bot_id]?.listed === true
          : post.guild_id !== null && env.db.profiles[post.guild_id]?.listed === true,
    )
    .filter((post) => includeNsfw || !isNsfwPost(env, post))
    .filter((post) => kind === undefined || post.kind === kind)
    .filter((post) => positions.length === 0 || post.positions.some((id) => positions.includes(id)))
    .filter((post) => languages.length === 0 || post.languages.some((id) => languages.includes(id)))
    .filter((post) => tags.length === 0 || post.tags.some((tag) => tags.includes(tag)))
    .filter((post) => theme === undefined || post.theme === theme)
    .filter((post) => compensation === undefined || post.commitment?.compensation === compensation)
    .filter(
      (post) => !needle || post.title.toLowerCase().includes(needle) || post.description.toLowerCase().includes(needle),
    )
    .filter((post) => guildId === undefined || post.guild_id === guildId)
    .filter((post) => botId === undefined || post.bot_id === botId)
    .filter((post) => authorId === undefined || post.author_id === authorId)
    .map((post) => ({at: post.published_at ?? post.created_at, id: post.id, post}))
    .sort(compareKeyed(true));

  const {rows: page, nextCursor} = pageRows(rows, limit, after, true);
  const items = page
    .filter(({post}) => !isUserSuspended(env, post.author_id) && !isPostOfSuspendedEntity(env, post))
    .map(({post}) => toPost(env, post));
  return {items, next_cursor: nextCursor};
}

// ---------------------------------------------------------------------------
// My posts
// ---------------------------------------------------------------------------

const STATUSES: readonly PostStatus[] = ['draft', 'published', 'closed', 'hidden'];

/**
 * `GET /lineup/me/posts`: every status, newest CREATED first, private view.
 * With `guild_id`: all the posts of that server whoever wrote them, for its
 * managers (403 / 503 otherwise).
 */
export function listMyPosts(env: Env, actor: Actor, query: URLSearchParams): Paginated<PrivatePost> {
  const issues = new Issues();
  const params = new Params('query', query, issues);
  const limit = params.int('limit', {def: 20, ge: 1, le: 50}) ?? 20;
  const guildId = params.string('guild_id', {pattern: /^\d{1,19}$/});
  const botId = params.string('bot_id', {pattern: /^\d{1,19}$/});
  const status = params.string('status');
  const cursor = params.get('cursor');
  issues.throwIfAny();

  if (status !== undefined && !(STATUSES as readonly string[]).includes(status)) {
    throw filterInvalid('status', 'Le filtre status est invalide.');
  }
  if (guildId !== undefined && botId !== undefined) {
    throw filterInvalid('bot_id', 'guild_id et bot_id ne peuvent pas être combinés.');
  }
  const after = decodeCursor(cursor, isUuid);
  if (guildId !== undefined && !canManageGuild(env, actor, guildId)) throw forbidden('lineup_guild_forbidden');
  if (botId !== undefined) {
    if (!env.db.botProfiles[botId]) throw notFound('lineup_bot_not_found');
    if (!canManageBot(env, actor, botSupportGuildId(env, botId))) throw forbidden('lineup_bot_forbidden');
  }

  const rows = Object.values(env.db.posts)
    .filter((post) =>
      guildId !== undefined
        ? post.guild_id === guildId
        : botId !== undefined
          ? post.kind === 'bot' && post.bot_id === botId
          : post.author_id === actor.id,
    )
    .filter((post) => status === undefined || post.status === status)
    .map((post) => ({at: post.created_at, id: post.id, post}))
    .sort(compareKeyed(true));
  const {rows: page, nextCursor} = pageRows(rows, limit, after, true);
  return {items: page.map(({post}) => toPrivatePost(env, post)), next_cursor: nextCursor};
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/**
 * `GET /lineup/posts/{id}`. A published post is readable by everyone, even
 * expired, while its author and server are not suspended and (for a server
 * post) the server is listed. Draft, closed and hidden posts are for their
 * editors and the staff. Everything else is the same 404 on purpose.
 * A NSFW server is NOT blocked (§9).
 */
export function getPostDetail(env: Env, viewer: Viewer | null, postId: string): PostDetail {
  const post = isUuid(postId) ? env.db.posts[postId.toLowerCase()] : undefined;
  if (!post) throw notFound('lineup_post_not_found');
  const canEdit = canEditPost(env, viewer, post, viewer?.suspended);
  if (!canEdit && !isPubliclyVisible(env, post)) throw notFound('lineup_post_not_found');
  return toPostDetail(env, post, viewer);
}

// ---------------------------------------------------------------------------
// Rules shared by the writes
// ---------------------------------------------------------------------------

const formUnavailable = () =>
  unprocessable('lineup_form_unavailable', "Le formulaire Lineup n'est pas encore disponible.");

const postExpired = () =>
  unprocessable('lineup_post_expired', "La date d'expiration est dépassée. Modifiez expires_at d'abord.");

/**
 * §8 quotas, computed at read time: 5 published, unexpired posts per server
 * (all authors), 3 per person (their `user` posts). Drafts, closed and hidden
 * posts do not count. `except` is the post being published (not counted twice).
 */
export function assertQuota(
  env: Env,
  post: Pick<DbPost, 'kind' | 'guild_id' | 'bot_id' | 'author_id'>,
  except?: Uuid,
): void {
  const live = Object.values(env.db.posts).filter((candidate) => candidate.id !== except && isLive(candidate, env.now));
  if (post.kind === 'bot') {
    const limit = limits.max_published_posts_per_bot;
    if (live.filter((candidate) => candidate.kind === 'bot' && candidate.bot_id === post.bot_id).length >= limit) {
      throw conflict('lineup_quota_exceeded', `Limite de ${limit} annonces publiées atteinte.`, {limit, scope: 'bot'});
    }
    return;
  }
  if (post.kind === 'guild') {
    const limit = limits.max_published_posts_per_guild;
    if (
      live.filter((candidate) => candidate.kind === 'guild' && candidate.guild_id === post.guild_id).length >= limit
    ) {
      throw conflict('lineup_quota_exceeded', `Limite de ${limit} annonces publiées atteinte.`, {
        limit,
        scope: 'guild',
      });
    }
    return;
  }
  const limit = limits.max_published_posts_per_user;
  if (live.filter((candidate) => candidate.kind === 'user' && candidate.author_id === post.author_id).length >= limit) {
    throw conflict('lineup_quota_exceeded', `Limite de ${limit} annonces publiées atteinte.`, {limit, scope: 'user'});
  }
}

/** The featured experience (user posts): the author's own (404 otherwise) and `verified` (422 otherwise). */
function assertFeaturedExperience(env: Env, authorId: Snowflake, experienceId: Uuid): void {
  const experience = env.db.experiences[experienceId];
  if (!experience || experience.user_id !== authorId) throw notFound('lineup_experience_not_found');
  if (experience.status !== 'verified') {
    throw unprocessable('lineup_experience_not_verified', "L'expérience mise en avant doit être vérifiée.");
  }
}

function assertGuildProfile(env: Env, guildId: Snowflake): void {
  if (!env.db.profiles[guildId]) {
    throw unprocessable('lineup_guild_profile_missing', "Ce serveur n'a pas de profil Lineup. Revendiquez-le d'abord.");
  }
}

function assertBotProfile(env: Env, botId: Snowflake): void {
  if (!env.db.botProfiles[botId]) {
    throw unprocessable('lineup_bot_profile_missing', "Ce bot n'a pas de profil Lineup. Revendiquez-le d'abord.");
  }
}

/** A bot post: the rights on the support server (403 / 503), its suspension (403 sanction). */
function assertBotEditor(env: Env, actor: Actor, botId: Snowflake): void {
  const supportId = botSupportGuildId(env, botId);
  if (!canManageBot(env, actor, supportId)) throw forbidden('lineup_bot_forbidden');
  const sanction = supportId ? env.db.guilds[supportId]?.sanction : undefined;
  if (sanction && supportId && !actor.is_staff) throw sanctionError('guild_suspended', supportId, sanction);
}

const hiddenError = () => conflict('lineup_post_hidden', "Cette annonce a été masquée par l'équipe Moddy.");

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * `POST /lineup/posts`. Order of the business checks (§6.4): `lineup_form`,
 * server rights (403, then 503), suspended server (403), no server profile
 * (422), featured experience (404 / 422), expiry, quota. A DRAFT is not
 * checked for expiry nor quota: those replay at `publish`.
 */
export function createPost(env: Env, actor: Actor, input: CreatePostInput): PostWriteResult {
  const status = input.status ?? 'draft';
  if (input.application?.type === ('lineup_form' satisfies ApplicationType)) throw formUnavailable();

  let guildId: Snowflake | null = null;
  if (input.kind === 'guild' && input.guild_id) {
    guildId = input.guild_id;
    if (!canManageGuild(env, actor, guildId)) throw forbidden('lineup_guild_forbidden');
    const sanction = env.db.guilds[guildId]?.sanction;
    if (sanction && !actor.is_staff) throw sanctionError('guild_suspended', guildId, sanction);
    assertGuildProfile(env, guildId);
  }
  let botId: Snowflake | null = null;
  if (input.kind === 'bot' && input.bot_id) {
    botId = input.bot_id;
    assertBotProfile(env, botId);
    assertBotEditor(env, actor, botId);
  }
  if (input.featured_experience_id) assertFeaturedExperience(env, actor.id, input.featured_experience_id);

  const expiresAt = input.expires_at ?? null;
  if (status === 'published') {
    if (expiresAt && expiresAt.getTime() <= env.now.getTime()) throw postExpired();
    assertQuota(env, {kind: input.kind, guild_id: guildId, bot_id: botId, author_id: actor.id});
  }

  const now = iso(env.now);
  const row: DbPost = {
    id: newUuid(),
    kind: input.kind,
    guild_id: guildId,
    bot_id: botId,
    author_id: actor.id,
    title: input.title,
    description: input.description,
    positions: input.positions,
    positions_other: input.positions_other ?? [],
    requirements: (input.requirements ?? []).map((entry) => ({...entry})),
    application: input.application ? {type: input.application.type, url: input.application.url} : null,
    languages: input.languages ?? [],
    timezone: input.timezone ?? null,
    commitment: input.commitment
      ? {
          hours_per_week: input.commitment.hours_per_week ?? null,
          compensation: input.commitment.compensation ?? null,
          openings: input.commitment.openings ?? null,
        }
      : null,
    theme: input.theme ?? null,
    tags: input.tags ?? [],
    featured_experience_id: input.featured_experience_id ?? null,
    status,
    hidden_reason: null,
    expires_at: expiresAt ? iso(expiresAt) : null,
    // §5: `published_at` is set at the FIRST publication only.
    published_at: status === 'published' ? now : null,
    created_at: now,
    updated_at: now,
  };
  env.db.posts[row.id] = row;
  return toWriteResult(env, row);
}

// ---------------------------------------------------------------------------
// Access to an existing post (PATCH, publish, close, DELETE)
// ---------------------------------------------------------------------------

/**
 * The access errors shared by every write on `/lineup/posts/{id}` (§6.4), in
 * order: 404 (unknown, malformed, or invisible to the caller) → 403
 * `lineup_post_forbidden` (visible, not editable) → 403 `guild_suspended` →
 * 503 (rights undecidable). A malformed id is a 404 like the detail route's.
 */
function loadEditable(env: Env, actor: Actor, rawId: string): DbPost {
  const post = isUuid(rawId) ? env.db.posts[rawId.toLowerCase()] : undefined;
  if (!post) throw notFound('lineup_post_not_found');

  let editor = actor.is_staff;
  if (!editor) {
    if (post.kind === 'user') editor = post.author_id === actor.id;
    else if (post.kind === 'bot' && post.bot_id) editor = canManageBot(env, actor, botSupportGuildId(env, post.bot_id));
    else if (post.guild_id) editor = canManageGuild(env, actor, post.guild_id); // 503 when Discord is silent
  }
  if (!editor) {
    throw isPubliclyVisible(env, post) ? forbidden('lineup_post_forbidden') : notFound('lineup_post_not_found');
  }
  const sanctionedId = post.kind === 'bot' && post.bot_id ? botSupportGuildId(env, post.bot_id) : post.guild_id;
  const sanction = sanctionedId ? env.db.guilds[sanctionedId]?.sanction : undefined;
  if (sanction && sanctionedId && !actor.is_staff) throw sanctionError('guild_suspended', sanctionedId, sanction);
  return post;
}

/** §8: a hidden post is no longer touched by its author (409); the staff still can. */
function assertNotHiddenFor(actor: Actor, post: DbPost): void {
  if (post.status === 'hidden' && !actor.is_staff) throw hiddenError();
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdatePostInput = Partial<Omit<CreatePostInput, 'kind' | 'guild_id' | 'bot_id' | 'status'>>;

/**
 * `PATCH /lineup/posts/{id}`. `other` / `positions_other` are checked on the
 * MERGED state (`lineup_positions_other_required` / `_unexpected`); taking
 * `other` out of `positions` empties `positions_other` by itself; a published
 * post stays published (no re-validation). `{}` changes nothing.
 */
export function updatePost(env: Env, actor: Actor, rawId: string, patch: UpdatePostInput): PostWriteResult {
  const post = loadEditable(env, actor, rawId);
  assertNotHiddenFor(actor, post);
  if (Object.keys(patch).length === 0) return toWriteResult(env, post);

  if (patch.application?.type === ('lineup_form' satisfies ApplicationType)) throw formUnavailable();

  const positions = patch.positions ?? post.positions;
  const hasOther = positions.includes('other');
  const positionsOther =
    patch.positions_other ?? (patch.positions !== undefined && !hasOther ? [] : post.positions_other);
  if (hasOther && positionsOther.length === 0) {
    throw unprocessable('lineup_positions_other_required', 'Précisez le ou les postes « Autre ».');
  }
  if (!hasOther && positionsOther.length > 0) {
    throw unprocessable(
      'lineup_positions_other_unexpected',
      'Des postes « Autre » sont renseignés sans que « Autre » soit coché.',
    );
  }

  if (patch.featured_experience_id) {
    if (post.kind !== 'user') {
      throw unprocessable(
        'lineup_featured_experience_user_only',
        'Seule une annonce personnelle peut mettre en avant une expérience.',
      );
    }
    assertFeaturedExperience(env, post.author_id, patch.featured_experience_id);
  }
  if (patch.expires_at && post.status === 'published' && patch.expires_at.getTime() <= env.now.getTime()) {
    throw postExpired();
  }

  if (patch.title !== undefined) post.title = patch.title;
  if (patch.description !== undefined) post.description = patch.description;
  if (patch.positions !== undefined) post.positions = patch.positions;
  post.positions_other = positionsOther;
  if (patch.requirements !== undefined) post.requirements = patch.requirements.map((entry) => ({...entry}));
  if (patch.application !== undefined) {
    post.application = patch.application ? {type: patch.application.type, url: patch.application.url} : null;
  }
  if (patch.languages !== undefined) post.languages = patch.languages;
  if (patch.timezone !== undefined) post.timezone = patch.timezone;
  if (patch.commitment !== undefined) {
    post.commitment = patch.commitment
      ? {
          hours_per_week: patch.commitment.hours_per_week ?? null,
          compensation: patch.commitment.compensation ?? null,
          openings: patch.commitment.openings ?? null,
        }
      : null;
  }
  if (patch.theme !== undefined) post.theme = patch.theme;
  if (patch.tags !== undefined) post.tags = patch.tags;
  if (patch.featured_experience_id !== undefined) post.featured_experience_id = patch.featured_experience_id;
  if (patch.expires_at !== undefined) post.expires_at = patch.expires_at ? iso(patch.expires_at) : null;
  post.updated_at = iso(env.now);
  return toWriteResult(env, post);
}

// ---------------------------------------------------------------------------
// publish, close, delete
// ---------------------------------------------------------------------------

/**
 * `POST …/publish`: `draft` or `closed` → `published` (reopening is
 * republishing; `published_at` keeps the FIRST date). Quota, expiry, server
 * profile and featured experience are checked again.
 */
export function publishPost(env: Env, actor: Actor, rawId: string): PostWriteResult {
  const post = loadEditable(env, actor, rawId);
  assertNotHiddenFor(actor, post);
  if (post.status !== 'draft' && post.status !== 'closed') {
    throw conflict('lineup_post_invalid_status', 'Cette annonce ne peut pas être publiée dans son état actuel.', {
      current_status: post.status,
    });
  }
  if (isExpired(post, env.now)) throw postExpired();
  if (post.kind === 'guild' && post.guild_id) assertGuildProfile(env, post.guild_id);
  if (post.kind === 'bot' && post.bot_id) assertBotProfile(env, post.bot_id);
  if (post.featured_experience_id) assertFeaturedExperience(env, post.author_id, post.featured_experience_id);
  assertQuota(env, post, post.id);

  const now = iso(env.now);
  post.status = 'published';
  post.published_at ??= now;
  post.hidden_reason = null;
  post.updated_at = now;
  return toWriteResult(env, post);
}

/** `POST …/close`: `published` → `closed`. */
export function closePost(env: Env, actor: Actor, rawId: string): PostWriteResult {
  const post = loadEditable(env, actor, rawId);
  assertNotHiddenFor(actor, post);
  if (post.status !== 'published') {
    throw conflict('lineup_post_invalid_status', 'Seule une annonce publiée peut être fermée.', {
      current_status: post.status,
    });
  }
  post.status = 'closed';
  post.updated_at = iso(env.now);
  return toWriteResult(env, post);
}

/** `DELETE /lineup/posts/{id}`: for good; a hidden post is the reports' evidence and is kept for non-staff. */
export function deletePost(env: Env, actor: Actor, rawId: string): void {
  const post = loadEditable(env, actor, rawId);
  assertNotHiddenFor(actor, post);
  delete env.db.posts[post.id];
}
