/**
 * Rows → the objects of src/api/types.ts (LINEUP.md §5, §6). One place decides
 * what each reader gets: public vs private views of posts and experiences,
 * what a third party may see of an experience's verification, the team, the
 * badges.
 */

import type {
  Application,
  Experience,
  GuildCard,
  GuildProfile,
  MeProfileRow,
  Post,
  PostAuthor,
  PostDetail,
  PostGuild,
  PostWriteResult,
  PrivateExperience,
  PrivatePost,
  ProfileExperience,
  Snowflake,
  StaffExperience,
  TeamMember,
  UserProfile,
  UserSummary,
} from '@/api/types';

import type {Actor, Env, Viewer} from '../env';
import type {DbExperience, DbPost, DbUser, DiscordGuild, GuildProfileRow} from '../model';
import {iso, snowflakeDate} from '../time';
import {canManageGuildQuietly} from './access';
import {guildBadges, userBadges} from './badges';
import {canEditPost, isExpired, isUserSuspended} from './visibility';

export const MAX_PROFILE_POSTS = 20;
const SERVER_REFRESH_AFTER_MS = 6 * 3600_000;
const USER_REFRESH_AFTER_MS = 24 * 3600_000;

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

function postGuild(env: Env, guildId: Snowflake | null): PostGuild | null {
  if (!guildId) return null;
  const guild = env.db.guilds[guildId];
  return {id: guildId, name: guild?.name ?? null, icon_url: guild?.icon_url ?? null};
}

function postAuthor(env: Env, authorId: Snowflake): PostAuthor {
  const user = env.db.users[authorId];
  return {
    id: authorId,
    username: user?.username ?? null,
    global_name: user?.global_name ?? null,
    avatar_url: user?.avatar_url ?? null,
  };
}

/** The public view of a post (§5). */
export function toPost(env: Env, row: DbPost): Post {
  const {hidden_reason: _reason, ...post} = row;
  return {
    ...post,
    application: row.application ? ({...row.application} satisfies Application) : null,
    is_expired: isExpired(row, env.now),
    guild: postGuild(env, row.guild_id),
    author: postAuthor(env, row.author_id),
  };
}

/** The private view (own posts, writes): adds `hidden_reason` (§5). */
export function toPrivatePost(env: Env, row: DbPost): PrivatePost {
  return {...toPost(env, row), hidden_reason: row.hidden_reason};
}

/** Every write answers with the editor's view, `can_edit: true`. */
export function toWriteResult(env: Env, row: DbPost): PostWriteResult {
  return {...toPrivatePost(env, row), can_edit: true};
}

/** The detail route: `hidden_reason` only when the reader may edit (§6.4). */
export function toPostDetail(env: Env, row: DbPost, viewer: Viewer | null): PostDetail {
  const canEdit = canEditPost(env, viewer, row, viewer?.suspended);
  const base = toPost(env, row);
  return canEdit ? {...base, can_edit: true, hidden_reason: row.hidden_reason} : {...base, can_edit: false};
}

// ---------------------------------------------------------------------------
// Experiences
// ---------------------------------------------------------------------------

function experienceBase(row: DbExperience) {
  return {
    id: row.id,
    kind: row.kind,
    guild_id: row.guild_id,
    name: row.name,
    invite_url: row.kind === 'guild' && row.invite_code ? `https://discord.gg/${row.invite_code}` : null,
    guild: null,
    position: row.position,
    position_other: row.position_other,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    is_current: row.end_date === null,
    sort_index: row.sort_index,
  } as const;
}

/**
 * The public view (someone else's profile): never any proof. §6.3: a third
 * party gets no `rejected` experience (the caller filters them out), and a
 * `pending` one is presented as `unverified` (the review is private).
 */
export function toPublicExperience(row: DbExperience): Experience {
  const hidePending = row.status === 'pending';
  return {
    ...experienceBase(row),
    verification: hidePending
      ? {status: 'unverified', method: null, verified_at: null}
      : {status: row.status, method: row.method, verified_at: row.verified_at},
  };
}

/** The owner's and the staff's view: evidence, rejection reason, timestamps (§5). */
export function toPrivateExperience(row: DbExperience): PrivateExperience {
  return {
    ...experienceBase(row),
    verification: {
      status: row.status,
      method: row.method,
      verified_at: row.verified_at,
      evidence: row.evidence ? {...row.evidence} : null,
      rejection_reason: row.rejection_reason,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const toStaffExperience = (row: DbExperience): StaffExperience => ({
  ...toPrivateExperience(row),
  user_id: row.user_id,
});

/** "In their order": `sort_index`, then `start_date` descending (§6.6). */
export function sortExperiences(rows: DbExperience[]): DbExperience[] {
  return [...rows].sort(
    (a, b) => a.sort_index - b.sort_index || (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0),
  );
}

export const experiencesOf = (env: Env, userId: Snowflake): DbExperience[] =>
  sortExperiences(Object.values(env.db.experiences).filter((row) => row.user_id === userId));

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

/** The part of a server's snapshot that goes stale (§9): refreshed on read after 6 h. */
export function refreshGuildSnapshot(env: Env, profile: GuildProfileRow): boolean {
  const old = env.now.getTime() - Date.parse(profile.snapshot_at) > SERVER_REFRESH_AFTER_MS;
  if (!old) return false;
  // Best effort: when Discord is silent (or the refresh always fails) the old snapshot is served, flagged stale.
  if (env.discordDown || profile.refresh_blocked) return true;
  profile.snapshot_at = iso(env.now);
  profile.has_moddy = env.db.guilds[profile.guild_id]?.has_moddy ?? profile.has_moddy;
  return false;
}

export function userSnapshotStale(env: Env, user: DbUser): boolean {
  const old = env.now.getTime() - Date.parse(user.snapshot_at) > USER_REFRESH_AFTER_MS;
  if (!old) return false;
  if (env.discordDown || user.snapshot_blocked) return true;
  user.snapshot_at = iso(env.now);
  return false;
}

export function guildCard(env: Env, profile: GuildProfileRow): GuildCard {
  const guild = env.db.guilds[profile.guild_id];
  return {
    id: profile.guild_id,
    name: guild?.name ?? null,
    icon_url: guild?.icon_url ?? null,
    member_count: guild?.member_count ?? null,
    presence_count: guild?.presence_count ?? null,
    theme: profile.theme,
    tags: [...profile.tags],
    badges: guildBadges(env, profile.guild_id, {includePremium: false}),
  };
}

export function userSummary(user: DbUser): UserSummary {
  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name,
    display_name: user.global_name ?? user.username,
    avatar_url: user.avatar_url,
    avatar_decoration: user.avatar_decoration ? {...user.avatar_decoration} : null,
  };
}

/**
 * §9 `team`: people with a VERIFIED, CURRENT experience on the server, a usable
 * profile (a known Discord snapshot) and not suspended. One entry per person
 * (their oldest current experience), sorted by seniority; `since` is its
 * `start_date`.
 */
export function teamOf(env: Env, guildId: Snowflake): TeamMember[] {
  const byPerson = new Map<Snowflake, DbExperience>();
  const rows = Object.values(env.db.experiences)
    .filter((row) => row.guild_id === guildId && row.status === 'verified' && row.end_date === null)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));
  for (const row of rows) if (!byPerson.has(row.user_id)) byPerson.set(row.user_id, row);
  const team: TeamMember[] = [];
  for (const [userId, row] of byPerson) {
    const user = env.db.users[userId];
    if (!user || user.sanction) continue;
    team.push({
      user: userSummary(user),
      position: row.position,
      position_other: row.position_other,
      since: row.start_date,
    });
  }
  return team;
}

/** A server's published, unexpired posts for its profile: 20 at most, newest first, NSFW included (§8). */
export function liveGuildPosts(env: Env, guildId: Snowflake): Post[] {
  return Object.values(env.db.posts)
    .filter(
      (post) =>
        post.kind === 'guild' && post.guild_id === guildId && post.status === 'published' && !isExpired(post, env.now),
    )
    .filter((post) => !isUserSuspended(env, post.author_id))
    .sort(byPublishedDesc)
    .slice(0, MAX_PROFILE_POSTS)
    .map((post) => toPost(env, post));
}

export function byPublishedDesc(a: DbPost, b: DbPost): number {
  const at = Date.parse(a.published_at ?? a.created_at);
  const bt = Date.parse(b.published_at ?? b.created_at);
  return bt - at || (a.id < b.id ? 1 : -1);
}

/** The full server profile (§6.2). The caller has already decided the viewer may read it. */
export function toGuildProfile(
  env: Env,
  profile: GuildProfileRow,
  actor: Actor | null,
  suspendedViewer = false,
): GuildProfile {
  const guild: DiscordGuild | undefined = env.db.guilds[profile.guild_id];
  const stale = refreshGuildSnapshot(env, profile);
  return {
    id: profile.guild_id,
    name: guild?.name ?? null,
    icon_url: guild?.icon_url ?? null,
    banner_url: guild?.banner_url ?? null,
    splash_url: guild?.splash_url ?? null,
    description: profile.description ?? guild?.description ?? null,
    discord_description: guild?.description ?? null,
    invite: {
      code: profile.invite_code,
      url: `https://discord.gg/${profile.invite_code}`,
      valid: !profile.invite_invalid,
    },
    links: profile.links.map((entry) => ({...entry})),
    theme: profile.theme,
    tags: [...profile.tags],
    languages: [...profile.languages],
    boosts: guild?.premium_subscription_count ?? null,
    boost_tier: guild?.premium_tier ?? null,
    member_count: guild?.member_count ?? null,
    presence_count: guild?.presence_count ?? null,
    created_at: iso(snowflakeDate(profile.guild_id)),
    badges: guildBadges(env, profile.guild_id, {includePremium: true}),
    has_moddy: profile.has_moddy,
    listed: profile.listed,
    posts: liveGuildPosts(env, profile.guild_id),
    team: teamOf(env, profile.guild_id),
    stale,
    can_manage: !suspendedViewer && canManageGuildQuietly(env, actor, profile.guild_id),
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** The `discord_snapshot` object of `GET /lineup/me` (public fields only, never an e-mail). */
export function discordSnapshot(user: DbUser) {
  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name,
    avatar: user.avatar_hash,
    banner: null,
    accent_color: user.accent_color,
    avatar_decoration_data: user.avatar_decoration
      ? {asset: user.avatar_decoration.asset, sku_id: user.avatar_decoration.sku_id, expires_at: null}
      : null,
    collectibles: user.nameplate ? {nameplate: {...user.nameplate}} : null,
    display_name_styles: user.display_name_styles,
    primary_guild: user.primary_guild,
    public_flags: user.public_flags,
  };
}

/** The raw row of `lineup_user_profiles` (`GET /lineup/me`), or null when there is none yet. */
export function toMeProfileRow(user: DbUser): MeProfileRow | null {
  if (!user.profile) return null;
  const {headline, bio, links, languages, timezone, open_to_work, created_at, updated_at} = user.profile;
  return {
    user_id: user.id,
    headline,
    bio,
    links: links.map((entry) => ({...entry})),
    languages: [...languages],
    timezone,
    open_to_work,
    discord_snapshot: discordSnapshot(user),
    snapshot_at: user.snapshot_at,
    created_at,
    updated_at,
  };
}

/** A user's live `user` posts for their profile: 20 at most (§8). */
export function livePostsOf(env: Env, userId: Snowflake): Post[] {
  return Object.values(env.db.posts)
    .filter(
      (post) =>
        post.kind === 'user' && post.author_id === userId && post.status === 'published' && !isExpired(post, env.now),
    )
    .sort(byPublishedDesc)
    .slice(0, MAX_PROFILE_POSTS)
    .map((post) => toPost(env, post));
}

/**
 * The profile page (§6.3). Oneself and the staff get every experience in the
 * private view; a third party gets no `rejected` one and `pending` ones as
 * `unverified`, with no evidence at all.
 */
export function toUserProfile(env: Env, user: DbUser, viewer: Viewer | null): UserProfile {
  const isSelf = viewer?.id === user.id;
  const privateView = isSelf || viewer?.is_staff === true;
  const rows = experiencesOf(env, user.id);
  const experiences: ProfileExperience[] = privateView
    ? rows.map(toPrivateExperience)
    : rows.filter((row) => row.status !== 'rejected').map(toPublicExperience);
  const profile = user.profile;
  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name,
    display_name: user.global_name ?? user.username,
    avatar_url: user.avatar_url,
    banner_url: user.banner_url,
    accent_color: user.accent_color,
    avatar_decoration: user.avatar_decoration ? {...user.avatar_decoration} : null,
    nameplate: user.nameplate ? {...user.nameplate} : null,
    display_name_styles: user.display_name_styles,
    primary_guild: user.primary_guild,
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    links: (profile?.links ?? []).map((entry) => ({...entry})),
    languages: [...(profile?.languages ?? [])],
    timezone: profile?.timezone ?? null,
    open_to_work: profile?.open_to_work ?? false,
    created_at: iso(snowflakeDate(user.id)),
    badges: userBadges(env, user),
    posts: livePostsOf(env, user.id),
    experiences,
    is_self: isSelf,
    stale: userSnapshotStale(env, user),
  };
}
