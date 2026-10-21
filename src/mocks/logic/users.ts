/** Sessions and profiles (LINEUP.md §6.1, §6.3). */

import type {Account, Me, Snowflake, UserProfile} from '@/api/types';

import {notFound} from '../errors';
import type {Actor, Env, Viewer} from '../env';
import {iso} from '../time';
import {summaryBadges, userBadges} from './badges';
import {discordSnapshot, toMeProfileRow, toUserProfile} from './views';

/** `GET /lineup/me`: the session summary. Never a token, and no e-mail (see `toAccount`). */
export function toMe(env: Env, actor: Actor): Me {
  const {user} = actor;
  return {
    user: {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url,
      // Mock only: `url` points at a local ring, so the decoration shows offline (the API sends `asset` and `sku_id`).
      avatar_decoration_data: user.avatar_decoration
        ? {...discordSnapshot(user).avatar_decoration_data, url: user.avatar_decoration.url}
        : null,
      is_staff: user.is_staff,
      badges: summaryBadges(userBadges(env, user)),
    },
    has_lineup_scopes: actor.has_lineup_scopes,
    login_url: '/lineup/auth/login',
    profile: toMeProfileRow(user),
  };
}

/** `GET /auth/me`, reduced to the e-mail: a fictitious address, as Discord's. */
export function toAccount(actor: Actor): Account {
  return {email: `${actor.user.username.replace(/[^a-z0-9._-]/gi, '')}@example.com`, verified: true};
}

/**
 * `GET /lineup/users/{id}`. The page exists as soon as Discord knows the
 * person (no Lineup profile needed). A globally suspended account is 404 for
 * everyone but the person and the staff (§9).
 */
export function getUserProfile(env: Env, viewer: Viewer | null, userId: Snowflake): UserProfile {
  const user = env.db.users[userId];
  if (!user) throw notFound('lineup_user_not_found');
  if (user.sanction && viewer?.id !== userId && !viewer?.is_staff) throw notFound('lineup_user_not_found');
  return toUserProfile(env, user, viewer);
}

export interface ProfileUpdate {
  headline?: string | null;
  bio?: string | null;
  links?: Array<{label: string; url: string}>;
  languages?: string[];
  timezone?: string | null;
  open_to_work?: boolean;
}

const blankToNull = (value: string | null): string | null => (value === null || value === '' ? null : value);

/** `PUT /lineup/me/profile`: partial; the profile row is created by the first edit. */
export function updateMyProfile(env: Env, actor: Actor, body: ProfileUpdate): UserProfile {
  const now = iso(env.now);
  const user = actor.user;
  const profile = (user.profile ??= {
    headline: null,
    bio: null,
    links: [],
    languages: [],
    timezone: null,
    open_to_work: false,
    created_at: now,
    updated_at: now,
  });
  if (body.headline !== undefined) profile.headline = blankToNull(body.headline);
  if (body.bio !== undefined) profile.bio = blankToNull(body.bio);
  if (body.links !== undefined) profile.links = body.links;
  if (body.languages !== undefined) profile.languages = body.languages;
  if (body.timezone !== undefined) profile.timezone = body.timezone;
  if (body.open_to_work !== undefined) profile.open_to_work = body.open_to_work;
  profile.updated_at = now;
  return toUserProfile(env, user, {...actor, suspended: false});
}
