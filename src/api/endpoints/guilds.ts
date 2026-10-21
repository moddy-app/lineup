/** Servers (LINEUP.md §6.1 `me/guilds`, §6.2). */

import {apiFetch} from '../client';
import type {ClaimGuildBody, GuildProfile, MyGuild, RefreshGuildsResponse, Snowflake, UpdateGuildBody} from '../types';
import {enc, type ReadOptions} from './shared';

/** `POST /lineup/guilds/claim`: 201 with the full profile. */
export function claimGuild(body: ClaimGuildBody): Promise<GuildProfile> {
  return apiFetch<GuildProfile>('/lineup/guilds/claim', {method: 'POST', body});
}

/** `GET /lineup/guilds/{guild_id}`. Optional auth: the session enables `can_manage` and unlisted profiles. */
export function getGuild(guildId: Snowflake, {signal}: ReadOptions = {}): Promise<GuildProfile> {
  return apiFetch<GuildProfile>(`/lineup/guilds/${enc(guildId)}`, {signal});
}

/** `PUT /lineup/guilds/{guild_id}`: partial; only the fields sent change. */
export function updateGuild(guildId: Snowflake, body: UpdateGuildBody): Promise<GuildProfile> {
  return apiFetch<GuildProfile>(`/lineup/guilds/${enc(guildId)}`, {method: 'PUT', body});
}

/** `DELETE /lineup/guilds/{guild_id}`: 204. Closes the server's draft and published posts. */
export function deleteGuild(guildId: Snowflake): Promise<void> {
  return apiFetch<void>(`/lineup/guilds/${enc(guildId)}`, {method: 'DELETE'});
}

/** `POST /lineup/guilds/{guild_id}/refresh`: forces the Discord snapshot to be read again. One per minute per server. */
export function refreshGuild(guildId: Snowflake): Promise<GuildProfile> {
  return apiFetch<GuildProfile>(`/lineup/guilds/${enc(guildId)}/refresh`, {method: 'POST'});
}

/** `GET /lineup/me/guilds`: the servers the person can manage, by name. */
export function getMyGuilds({signal}: ReadOptions = {}): Promise<MyGuild[]> {
  return apiFetch<MyGuild[]>('/lineup/me/guilds', {signal});
}

/** `POST /lineup/me/refresh-guilds`: reads Discord's list again, skipping the 5-minute cache. */
export function refreshMyGuilds(): Promise<RefreshGuildsResponse> {
  return apiFetch<RefreshGuildsResponse>('/lineup/me/refresh-guilds', {method: 'POST'});
}
