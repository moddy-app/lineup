/** Sessions and profiles (LINEUP.md §6.1, §6.3). */

import type {Me, Snowflake, UserProfile} from '@/api/types';

import {notFound} from '../errors';
import type {Actor, Env, Viewer} from '../env';
import {iso} from '../time';
import {discordSnapshot, toMeProfileRow, toUserProfile} from './views';

/** `GET /lineup/me`: the session summary. Never an e-mail or a token. */
export function toMe(actor: Actor): Me {
  const {user} = actor;
  return {
    user: {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url,
      avatar_decoration_data: discordSnapshot(user).avatar_decoration_data,
      is_staff: user.is_staff,
    },
    has_lineup_scopes: actor.has_lineup_scopes,
    login_url: '/lineup/auth/login',
    profile: toMeProfileRow(user),
  };
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
