/**
 * Who may manage a server (LINEUP.md §3), and the lists of servers a person
 * has. `can_manage_guild`, in order:
 *
 *   1. the Moddy staff always;
 *   2. Moddy is on the server AND it is in the session's list (the dashboard
 *      rule: the person administers it there);
 *   3. else the person's full server list read from Discord with THEIR token
 *      (cached 5 minutes): owner, ADMINISTRATOR or MANAGE_GUILD.
 *
 * If neither the session nor the staff decide and Discord does not answer:
 * 503, never a "no".
 */

import type {Snowflake} from '@/api/types';

import {ApiFailure} from '../errors';
import type {Actor, Env} from '../env';
import type {GuildListCache, Member} from '../model';
import {requireDiscord} from './discord';

const MINUTE = 60_000;
export const GUILD_LIST_TTL = 5 * MINUTE;

const MANAGE_PERMISSIONS = ['ADMINISTRATOR', 'MANAGE_GUILD'];

/** A person's rights are those of an owner or of an administrator / "manage server" holder. */
export const hasManageRights = (member: {owner: boolean; permissions: string[]}): boolean =>
  member.owner || member.permissions.some((permission) => MANAGE_PERMISSIONS.includes(permission));

export const membershipOf = (env: Env, userId: Snowflake, guildId: Snowflake): Member | undefined =>
  env.db.members.find((member) => member.user_id === userId && member.guild_id === guildId);

/** The session's list: Moddy servers the person administers (set at login or `POST /auth/refresh`). */
export function sessionGuildIds(env: Env, userId: Snowflake): Snowflake[] {
  return env.db.members
    .filter(
      (member) => member.user_id === userId && hasManageRights(member) && env.db.guilds[member.guild_id]?.has_moddy,
    )
    .map((member) => member.guild_id);
}

/** What Discord says about the person's servers right now. */
function liveGuildList(env: Env, userId: Snowflake): GuildListCache {
  return {
    fetched_at: env.now.toISOString(),
    pinned: false,
    guilds: env.db.members
      .filter((member) => member.user_id === userId)
      .map((member) => ({id: member.guild_id, owner: member.owner, permissions: [...member.permissions]})),
  };
}

/**
 * The person's servers as Discord lists them: from the 5-minute cache, else
 * read live (and cached). `skipCache` is `POST /lineup/me/refresh-guilds`.
 * Throws 503 when Discord is needed and silent.
 */
export function discordGuildList(env: Env, userId: Snowflake, skipCache = false): GuildListCache {
  const cached = env.db.guildListCache[userId];
  const fresh =
    cached && (cached.pinned || env.now.getTime() - Date.parse(cached.fetched_at) < GUILD_LIST_TTL) ? cached : null;
  if (fresh && !skipCache) return fresh;
  requireDiscord(env);
  const live = liveGuildList(env, userId);
  env.db.guildListCache[userId] = live;
  return live;
}

/**
 * §3 `can_manage_guild`. Throws 503 `discord_unavailable` when undecidable
 * (use `canManageGuildQuietly` for reads, where a doubt just means `false`).
 */
export function canManageGuild(env: Env, actor: Actor, guildId: Snowflake): boolean {
  if (actor.is_staff) return true;
  if (sessionGuildIds(env, actor.id).includes(guildId)) return true;
  const entry = discordGuildList(env, actor.id).guilds.find((guild) => guild.id === guildId);
  return entry !== undefined && hasManageRights(entry);
}

/** For `can_manage` / `can_edit` on reads: a Discord doubt is `false` (§6.2). */
export function canManageGuildQuietly(env: Env, actor: Actor | null, guildId: Snowflake): boolean {
  if (!actor) return false;
  try {
    return canManageGuild(env, actor, guildId);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 503) return false;
    throw error;
  }
}

export interface ManageableGuild {
  id: Snowflake;
  /** The bot is on the server right now. */
  has_moddy: boolean;
}

/**
 * `GET /lineup/me/guilds`: the union of the session's Moddy servers and the
 * Discord servers the person manages. Discord silent: only the session's
 * (the list is then incomplete; `refresh-guilds` says so with `stale`).
 */
export function manageableGuilds(env: Env, actor: Actor, skipCache = false): {guilds: Snowflake[]; stale: boolean} {
  const ids = new Set(sessionGuildIds(env, actor.id));
  let stale = false;
  try {
    for (const entry of discordGuildList(env, actor.id, skipCache).guilds) {
      if (hasManageRights(entry)) ids.add(entry.id);
    }
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 503) stale = true;
    else throw error;
  }
  return {guilds: [...ids], stale};
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/**
 * Who manages a bot (the bot guide): the staff, or the owner or an
 * ADMINISTRATOR of its support server (as of the last refresh), read from the
 * person's server list (5-minute cache). "Manage server" is NOT enough. Throws
 * 503 when Discord is needed and silent.
 */
export function canManageBot(env: Env, actor: Actor, supportGuildId: Snowflake | null): boolean {
  if (actor.is_staff) return true;
  if (!supportGuildId) return false;
  const entry = discordGuildList(env, actor.id).guilds.find((guild) => guild.id === supportGuildId);
  return entry !== undefined && (entry.owner || entry.permissions.includes('ADMINISTRATOR'));
}

/** For `can_manage` / `can_edit` on reads: a Discord doubt is `false`. */
export function canManageBotQuietly(env: Env, actor: Actor | null, supportGuildId: Snowflake | null): boolean {
  if (!actor) return false;
  try {
    return canManageBot(env, actor, supportGuildId);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 503) return false;
    throw error;
  }
}
