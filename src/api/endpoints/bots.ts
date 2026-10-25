/** Bots (the bot guide: `/lineup/bots`, `/lineup/me/bots`). */

import {apiFetch} from '../client';
import type {
  BotCard,
  BotDirectoryFilters,
  BotLookup,
  BotProfile,
  MyBotsResponse,
  Paginated,
  Snowflake,
  UpdateBotBody,
} from '../types';
import {enc, type PageOptions, type ReadOptions} from './shared';

/** `GET /lineup/bots`: the public directory. Cached 60 s by the server; a page can be short (suspended support servers). */
export function getBots(
  filters: BotDirectoryFilters = {},
  {cursor, limit, signal}: PageOptions = {},
): Promise<Paginated<BotCard>> {
  return apiFetch<Paginated<BotCard>>('/lineup/bots', {
    signal,
    query: {
      theme: filters.theme,
      q: filters.q?.trim(),
      include_nsfw: filters.include_nsfw ? true : undefined,
      limit,
      cursor,
    },
  });
}

/** `GET /lineup/me/bots`: the bots whose support server the person owns or administers, listed or not. */
export function getMyBots({signal}: ReadOptions = {}): Promise<MyBotsResponse> {
  return apiFetch<MyBotsResponse>('/lineup/me/bots', {signal});
}

/** `GET /lineup/bots/lookup/{bot_id}`: the preview before a claim. 20 per minute per person: call it on submit, never per keystroke. */
export function lookupBot(botId: Snowflake, {signal}: ReadOptions = {}): Promise<BotLookup> {
  return apiFetch<BotLookup>(`/lineup/bots/lookup/${enc(botId)}`, {signal});
}

/** `POST /lineup/bots/claim`: 201 with the full profile. */
export function claimBot(botId: Snowflake): Promise<BotProfile> {
  return apiFetch<BotProfile>('/lineup/bots/claim', {method: 'POST', body: {bot_id: botId}});
}

/** `GET /lineup/bots/{bot_id}`. Optional auth: the session enables `can_manage` and unlisted profiles. */
export function getBot(botId: Snowflake, {signal}: ReadOptions = {}): Promise<BotProfile> {
  return apiFetch<BotProfile>(`/lineup/bots/${enc(botId)}`, {signal});
}

/** `PUT /lineup/bots/{bot_id}`: partial; only the fields sent change. Name, avatar and support server come from Discord. */
export function updateBot(botId: Snowflake, body: UpdateBotBody): Promise<BotProfile> {
  return apiFetch<BotProfile>(`/lineup/bots/${enc(botId)}`, {method: 'PUT', body});
}

/** `DELETE /lineup/bots/{bot_id}`: 204. Closes the bot's draft and published posts first. */
export function deleteBot(botId: Snowflake): Promise<void> {
  return apiFetch<void>(`/lineup/bots/${enc(botId)}`, {method: 'DELETE'});
}

/** `POST /lineup/bots/{bot_id}/refresh`: reads Discord again. Once per minute per bot. */
export function refreshBot(botId: Snowflake): Promise<BotProfile> {
  return apiFetch<BotProfile>(`/lineup/bots/${enc(botId)}/refresh`, {method: 'POST'});
}
