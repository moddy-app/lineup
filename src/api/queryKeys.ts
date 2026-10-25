/**
 * The query keys, hierarchical so that a prefix addresses a family:
 *
 *   ['catalog']
 *   ['me']                                  the session snapshot, EXACT only
 *   ['me', 'profile']  ['me', 'experiences']
 *   ['account']                             the e-mail of GET /auth/me
 *   ['posts', 'feed', filters]              infinite
 *   ['posts', 'detail', id]
 *   ['posts', 'mine', {guildId, status}]    infinite
 *   ['guilds', 'detail', id]
 *   ['guilds', 'mine']
 *   ['bots', 'directory', filters]          infinite
 *   ['bots', 'detail', id]
 *   ['bots', 'mine']
 *   ['bots', 'lookup', id]
 *   ['users', 'detail', id]
 *   ['staff', 'experiences', status]        infinite
 *   ['staff', 'reports', status]            infinite
 *   ['staff', 'badges', entityType]         infinite (limit/offset)
 *
 * `['me']` is a prefix of the person's own profile and experiences: always
 * address the session with `exact: true`.
 */

import type {
  BadgeEntityType,
  BotDirectoryFilters,
  FeedFilters,
  MyPostsParams,
  Snowflake,
  StaffExperienceStatus,
  StaffReportStatus,
  Uuid,
} from './types';

export const queryKeys = {
  catalog: () => ['catalog'] as const,
  me: () => ['me'] as const,
  account: () => ['account'] as const,
  myProfile: () => ['me', 'profile'] as const,
  myExperiences: () => ['me', 'experiences'] as const,

  posts: () => ['posts'] as const,
  feeds: () => ['posts', 'feed'] as const,
  feed: (filters: FeedFilters) => ['posts', 'feed', filters] as const,
  postDetails: () => ['posts', 'detail'] as const,
  postDetail: (id: Uuid) => ['posts', 'detail', id] as const,
  myPostsLists: () => ['posts', 'mine'] as const,
  myPosts: (params: MyPostsParams) => ['posts', 'mine', params] as const,

  guilds: () => ['guilds'] as const,
  guildDetails: () => ['guilds', 'detail'] as const,
  guildDetail: (id: Snowflake) => ['guilds', 'detail', id] as const,
  myGuilds: () => ['guilds', 'mine'] as const,

  bots: () => ['bots'] as const,
  botDirectories: () => ['bots', 'directory'] as const,
  botDirectory: (filters: BotDirectoryFilters) => ['bots', 'directory', filters] as const,
  botDetails: () => ['bots', 'detail'] as const,
  botDetail: (id: Snowflake) => ['bots', 'detail', id] as const,
  myBots: () => ['bots', 'mine'] as const,
  botLookup: (id: Snowflake) => ['bots', 'lookup', id] as const,

  userDetails: () => ['users', 'detail'] as const,
  userDetail: (id: Snowflake) => ['users', 'detail', id] as const,

  staffExperienceQueues: () => ['staff', 'experiences'] as const,
  staffExperiences: (status: StaffExperienceStatus) => ['staff', 'experiences', status] as const,
  staffReportQueues: () => ['staff', 'reports'] as const,
  staffReports: (status: StaffReportStatus) => ['staff', 'reports', status] as const,
  staffBadgeLists: () => ['staff', 'badges'] as const,
  staffBadges: (entityType: BadgeEntityType) => ['staff', 'badges', entityType] as const,
};

// ---------------------------------------------------------------------------
// Filters in keys
// ---------------------------------------------------------------------------

/** A list filter is a set: order and duplicates must not make two keys (nor two server cache entries). */
const normalizeList = (values: string[] | undefined): string[] | undefined => {
  const cleaned = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
  return cleaned.length > 0 ? cleaned : undefined;
};

const text = (value: string | undefined): string | undefined => value?.trim() || undefined;

/**
 * The feed's filters as they are keyed and sent: arrays sorted and deduplicated,
 * blanks dropped, a false `include_nsfw` omitted. Two filter objects that mean
 * the same thing get the same key.
 */
export function normalizeFeedFilters(filters: FeedFilters): FeedFilters {
  const normalized: FeedFilters = {
    kind: filters.kind,
    positions: normalizeList(filters.positions),
    languages: normalizeList(filters.languages),
    tags: normalizeList(filters.tags),
    theme: text(filters.theme),
    compensation: text(filters.compensation),
    q: text(filters.q),
    guild_id: text(filters.guild_id),
    bot_id: text(filters.bot_id),
    author_id: text(filters.author_id),
    include_nsfw: filters.include_nsfw ? true : undefined,
  };
  return stripUndefined(normalized);
}

export function normalizeMyPostsParams(params: MyPostsParams): MyPostsParams {
  return stripUndefined({guildId: text(params.guildId), botId: text(params.botId), status: params.status});
}

export function normalizeBotFilters(filters: BotDirectoryFilters): BotDirectoryFilters {
  return stripUndefined({
    theme: text(filters.theme),
    q: text(filters.q),
    include_nsfw: filters.include_nsfw ? true : undefined,
  });
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
