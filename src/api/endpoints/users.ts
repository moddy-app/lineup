/** Profiles (LINEUP.md §6.3). */

import {apiFetch} from '../client';
import type {Snowflake, UpdateProfileBody, UserProfile} from '../types';
import {enc, type ReadOptions} from './shared';

/** `GET /lineup/users/{user_id}`: a public profile. Optional auth (`is_self`, and the staff's private view). */
export function getUser(userId: Snowflake, {signal}: ReadOptions = {}): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/lineup/users/${enc(userId)}`, {signal});
}

/** `GET /lineup/me/profile`: the same object with `is_self: true` and the private view of experiences. */
export function getMyProfile({signal}: ReadOptions = {}): Promise<UserProfile> {
  return apiFetch<UserProfile>('/lineup/me/profile', {signal});
}

/** `PUT /lineup/me/profile`: partial; answers with the full profile. */
export function updateMyProfile(body: UpdateProfileBody): Promise<UserProfile> {
  return apiFetch<UserProfile>('/lineup/me/profile', {method: 'PUT', body});
}
