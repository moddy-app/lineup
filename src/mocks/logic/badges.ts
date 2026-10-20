/**
 * Badges (LINEUP.md §10, §5): computed on every read, plus the manual grants
 * and the public Discord flags. Always rendered in the catalog's order.
 */

import {catalogFixture} from '@/api/catalog.fixture';
import type {Badge, Snowflake} from '@/api/types';

import type {Env} from '../env';
import type {DbUser} from '../model';

const ORDER = catalogFixture.badges.map((badge) => badge.id as string);

/** Discord `public_flags` bits → badge ids (`catalog.DISCORD_FLAG_BADGES`; TEAM_PSEUDO_USER and BOT_HTTP_INTERACTIONS are left out). */
export const DISCORD_FLAG_BADGES: ReadonlyArray<readonly [bit: number, badge: string]> = [
  [1 << 0, 'discord_staff'],
  [1 << 1, 'discord_partnered_server_owner'],
  [1 << 2, 'discord_hypesquad_events'],
  [1 << 3, 'discord_bug_hunter_level_1'],
  [1 << 6, 'discord_hypesquad_house_bravery'],
  [1 << 7, 'discord_hypesquad_house_brilliance'],
  [1 << 8, 'discord_hypesquad_house_balance'],
  [1 << 9, 'discord_early_supporter'],
  [1 << 14, 'discord_bug_hunter_level_2'],
  [1 << 16, 'discord_verified_bot'],
  [1 << 17, 'discord_early_verified_bot_developer'],
  [1 << 18, 'discord_certified_moderator'],
  [1 << 22, 'discord_active_developer'],
];

export function badge(id: string): Badge {
  const entry = catalogFixture.badges.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown badge ${id}`);
  return {id: entry.id, label: {...entry.label}, source: entry.source};
}

const inCatalogOrder = (ids: Iterable<string>): Badge[] =>
  [...new Set(ids)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).map(badge);

function manualBadges(env: Env, entityType: 'user' | 'guild', entityId: Snowflake): string[] {
  return env.db.badges
    .filter((grant) => grant.entity_type === entityType && grant.entity_id === entityId)
    .map((grant) => grant.badge);
}

/**
 * A server's badges. `moddy_installed` is the snapshot's value (up to 6 h old);
 * `moddy_premium` is left out of the directory cards (`includePremium: false`, §6.2).
 */
export function guildBadges(env: Env, guildId: Snowflake, options: {includePremium: boolean}): Badge[] {
  const guild = env.db.guilds[guildId];
  const profile = env.db.profiles[guildId];
  const ids: string[] = [];
  if (guild?.features.includes('VERIFIED')) ids.push('discord_verified');
  if (guild?.features.includes('PARTNERED')) ids.push('discord_partner');
  if (profile?.has_moddy) ids.push('moddy_installed');
  if (options.includePremium && guild?.premium_effective) ids.push('moddy_premium');
  // §10: the badge follows Discord's own level 1 or 3; the Lineup theme `nsfw` is a separate thing.
  if (guild && (guild.nsfw_level === 1 || guild.nsfw_level === 3)) ids.push('nsfw');
  ids.push(...manualBadges(env, 'guild', guildId));
  return inCatalogOrder(ids);
}

/** A person's badges: Moddy's computed ones, then Discord's public flags, then manual grants. */
export function userBadges(env: Env, user: DbUser): Badge[] {
  const ids: string[] = [];
  // §10: premium is cut by a global sanction.
  if (user.premium && !user.sanction) ids.push('moddy_premium');
  if (user.is_staff) ids.push('moddy_staff');
  for (const [bit, id] of DISCORD_FLAG_BADGES) if ((user.public_flags & bit) !== 0) ids.push(id);
  ids.push(...manualBadges(env, 'user', user.id));
  return inCatalogOrder(ids);
}
