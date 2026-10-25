/**
 * Who can see what (LINEUP.md §8, §9): suspended authors and servers, unlisted
 * servers, NSFW, and the editors of a post.
 */

import type {Snowflake} from '@/api/types';

import type {Actor, Env} from '../env';
import type {DbPost} from '../model';
import {canManageBotQuietly, canManageGuildQuietly} from './access';

export const isUserSuspended = (env: Env, userId: Snowflake): boolean => Boolean(env.db.users[userId]?.sanction);
export const isGuildSuspended = (env: Env, guildId: Snowflake): boolean => Boolean(env.db.guilds[guildId]?.sanction);

/**
 * §9: a server is NSFW if its Lineup theme is `nsfw` OR Discord's `nsfw_level`
 * is 1 (explicit) or 3 (age-restricted). The API never blocks a detail route
 * for it: it only filters the feed and the directory.
 */
export function isNsfwGuild(env: Env, guildId: Snowflake): boolean {
  const level = env.db.guilds[guildId]?.nsfw_level;
  return env.db.profiles[guildId]?.theme === 'nsfw' || level === 1 || level === 3;
}

/** A bot is NSFW when its Lineup theme is `nsfw`. */
export const isNsfwBot = (env: Env, botId: Snowflake): boolean => env.db.botProfiles[botId]?.theme === 'nsfw';

export const isNsfwPost = (env: Env, post: DbPost): boolean =>
  post.theme === 'nsfw' ||
  (post.guild_id !== null && isNsfwGuild(env, post.guild_id)) ||
  (post.kind === 'bot' && !!post.bot_id && isNsfwBot(env, post.bot_id));

/** The support server a bot's rights and visibility follow: the profile's (last refresh), else the directory's. */
export function botSupportGuildId(env: Env, botId: Snowflake): Snowflake | null {
  return env.db.botProfiles[botId]?.support_guild_id ?? env.db.bots[botId]?.support_guild_id ?? null;
}

/** A bot whose support server is suspended disappears, with its posts. */
export function isBotSuspended(env: Env, botId: Snowflake): boolean {
  const guildId = botSupportGuildId(env, botId);
  return guildId !== null && isGuildSuspended(env, guildId);
}

/** A post of a suspended server or of a bot whose support server is suspended. */
export function isPostOfSuspendedEntity(env: Env, post: DbPost): boolean {
  if (post.kind === 'bot') return !!post.bot_id && isBotSuspended(env, post.bot_id);
  return post.guild_id !== null && isGuildSuspended(env, post.guild_id);
}

export const isExpired = (post: Pick<DbPost, 'expires_at'>, now: Date): boolean =>
  post.expires_at !== null && Date.parse(post.expires_at) <= now.getTime();

/** Published and not expired: what the quotas count and what the lists show. */
export const isLive = (post: DbPost, now: Date): boolean => post.status === 'published' && !isExpired(post, now);

/**
 * §8 `can_edit`: the staff; for a `user` post its author; for a `guild` post
 * any CURRENT manager of the server. A suspended server's post is no longer
 * editable (staff aside). A Discord doubt is `false` (reads); writes use
 * `canManageGuild` directly to answer 503.
 */
export function canEditPost(env: Env, actor: Actor | null, post: DbPost, suspendedViewer = false): boolean {
  if (!actor || suspendedViewer) return false;
  if (actor.is_staff) return true;
  if (post.kind === 'user') return post.author_id === actor.id;
  if (post.kind === 'bot') {
    if (!post.bot_id || isBotSuspended(env, post.bot_id)) return false;
    return canManageBotQuietly(env, actor, botSupportGuildId(env, post.bot_id));
  }
  if (!post.guild_id || isGuildSuspended(env, post.guild_id)) return false;
  return canManageGuildQuietly(env, actor, post.guild_id);
}

/**
 * Whether the public can read a post (the detail route, §6.4): `published`
 * (even expired, by direct link), author and server not suspended, and for a
 * server (or bot) post a profile that exists and is listed (§9).
 */
export function isPubliclyVisible(env: Env, post: DbPost): boolean {
  if (post.status !== 'published') return false;
  if (isUserSuspended(env, post.author_id)) return false;
  if (post.kind === 'guild') {
    if (!post.guild_id) return false;
    const profile = env.db.profiles[post.guild_id];
    if (!profile || !profile.listed || isGuildSuspended(env, post.guild_id)) return false;
  }
  if (post.kind === 'bot') {
    if (!post.bot_id) return false;
    const profile = env.db.botProfiles[post.bot_id];
    if (!profile || !profile.listed || isBotSuspended(env, post.bot_id)) return false;
  }
  return true;
}
