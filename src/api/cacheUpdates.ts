/**
 * How the cache follows a write, as pure functions (no QueryClient here;
 * cacheSync.ts applies them to the cached queries).
 *
 * The rule of LINEUP.md §0 "Cache": after a write, show the result from the
 * response, never by reading the feed again (it has 60 s of server cache).
 * So every write patches the objects it already holds:
 *
 *  1. Lists keep their order and their cursors. A page is never rebuilt: an
 *     item is replaced, removed, or inserted INSIDE the pages already loaded.
 *  2. A list that is not cached stays absent (it will be fetched fresh).
 *  3. An item that belongs after the last loaded page of a list that has more
 *     pages is NOT inserted: the next page will bring it from the server.
 *  4. Every function returns the very same object when nothing changed, so
 *     React Query does not notify, and React does not render, for nothing.
 */

import type {InfiniteData} from '@tanstack/react-query';

import type {
  Badge,
  Catalog,
  GuildCard,
  GuildProfile,
  ManualBadgeGrant,
  MyGuild,
  MyPostsParams,
  Paginated,
  Post,
  PostModeration,
  PrivateExperience,
  ProfileExperience,
  Snowflake,
  UserProfile,
  Uuid,
} from './types';

// ---------------------------------------------------------------------------
// Lists made of pages
// ---------------------------------------------------------------------------

/** What a page needs to be patched: its items. The rest (`next_cursor`) is kept as is. */
export interface ItemsPage<T> {
  items: T[];
  next_cursor?: string | null;
}

export type Pages<T, Pg extends ItemsPage<T> = ItemsPage<T>, P = unknown> = InfiniteData<Pg, P>;

/** The type of an item of a page type. */
type ItemOf<Pg> = Pg extends {items: Array<infer T>} ? T : never;

/** Applies `fn` to the items of every page. Same object back when no page changed. */
function mapPages<Pg extends ItemsPage<unknown>, P>(
  data: InfiniteData<Pg, P>,
  fn: (items: Array<ItemOf<Pg>>) => Array<ItemOf<Pg>>,
): InfiniteData<Pg, P> {
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = fn(page.items as Array<ItemOf<Pg>>);
    if (items === page.items) return page;
    changed = true;
    return {...page, items};
  });
  return changed ? {...data, pages} : data;
}

/** Removes every item that satisfies `predicate`. */
export function removeItems<Pg extends ItemsPage<unknown>, P>(
  data: InfiniteData<Pg, P> | undefined,
  predicate: (item: ItemOf<Pg>) => boolean,
): InfiniteData<Pg, P> | undefined {
  if (!data) return data;
  return mapPages(data, (items) => {
    const kept = items.filter((item) => !predicate(item));
    return kept.length === items.length ? items : kept;
  });
}

/** Replaces every item for which `replace` returns a new object. */
export function mapItems<Pg extends ItemsPage<unknown>, P>(
  data: InfiniteData<Pg, P> | undefined,
  replace: (item: ItemOf<Pg>) => ItemOf<Pg>,
): InfiniteData<Pg, P> | undefined {
  if (!data) return data;
  return mapPages(data, (items) => {
    let changed = false;
    const next = items.map((item) => {
      const replaced = replace(item);
      if (replaced !== item) changed = true;
      return replaced;
    });
    return changed ? next : items;
  });
}

/** Whether an item with this id is somewhere in the loaded pages. */
export function hasItem<Pg extends ItemsPage<{id: string}>, P>(
  data: InfiniteData<Pg, P> | undefined,
  id: string,
): boolean {
  return data?.pages.some((page) => page.items.some((item) => item.id === id)) ?? false;
}

export interface UpsertOptions<T> {
  /** Whether the item belongs in this list (a status tab, a queue). */
  matches: boolean;
  /** Negative when `a` is listed before `b`: the list's own order. */
  compare: (a: T, b: T) => number;
}

/**
 * Puts an item where it belongs in a list.
 *  - Already there and still belongs: replaced in place (the order does not move).
 *  - Already there and no longer belongs: removed (it changed tab or queue).
 *  - Not there and belongs: inserted at its place among the loaded items. If its
 *    place is past the last loaded one and the list has more pages, it is left
 *    for the server to send; if the list is complete it goes last.
 */
export function upsertItem<T extends {id: string}, D extends InfiniteData<ItemsPage<T>, unknown>>(
  data: D | undefined,
  item: T,
  {matches, compare}: UpsertOptions<T>,
): D | undefined {
  if (!data) return data;

  if (hasItem(data, item.id)) {
    return (
      matches
        ? mapItems(data, (current) => (current.id === item.id ? item : current))
        : removeItems(data, (current) => current.id === item.id)
    ) as D;
  }
  if (!matches || data.pages.length === 0) return data;

  for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex += 1) {
    const page = data.pages[pageIndex]!;
    const at = page.items.findIndex((current) => compare(item, current) < 0);
    if (at !== -1) {
      const pages = [...data.pages];
      pages[pageIndex] = {...page, items: [...page.items.slice(0, at), item, ...page.items.slice(at)]};
      return {...data, pages};
    }
  }

  const last = data.pages[data.pages.length - 1]!;
  if (last.next_cursor != null) return data;
  const pages = [...data.pages];
  pages[pages.length - 1] = {...last, items: [...last.items, item]};
  return {...data, pages};
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/** ISO 8601 strings, oldest first. Compared as instants, then as text (microseconds). */
export function compareIso(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b) || (a < b ? -1 : a > b ? 1 : 0);
}

const byId = (a: {id: string}, b: {id: string}) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** My posts: the most recently CREATED first (LINEUP.md §6.4). */
export const comparePostsCreatedDesc = (a: Post, b: Post) => compareIso(b.created_at, a.created_at) || byId(b, a);

/** The staff's experience queue: the oldest change first. */
export const compareByUpdatedAsc = (a: PrivateExperience, b: PrivateExperience) =>
  compareIso(a.updated_at, b.updated_at) || byId(a, b);

/** The staff's report queue: the newest first. */
export const compareByCreatedDesc = <T extends {id: string; created_at: string}>(a: T, b: T) =>
  compareIso(b.created_at, a.created_at) || byId(b, a);

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/** The view of a post that anyone may see: no `hidden_reason`, no `can_edit`. */
export function toPublicPost(post: Post): Post {
  const {
    hidden_reason: _hidden,
    can_edit: _edit,
    ...rest
  } = post as Post & {hidden_reason?: unknown; can_edit?: unknown};
  return rest;
}

/** Whether a post is listed by a `['posts', 'mine', params]` query. */
export function belongsToMyPosts(post: Post, params: MyPostsParams, myId: Snowflake | undefined): boolean {
  if (params.status && post.status !== params.status) return false;
  return params.guildId ? post.guild_id === params.guildId : myId !== undefined && post.author_id === myId;
}

/** A post is on public display: published and not expired. */
export const isPubliclyListed = (post: Post) => post.status === 'published' && !post.is_expired;

/** The server's or the person's public `posts` (20 at most), newest publication first. */
const PROFILE_POSTS_MAX = 20;

const comparePublishedDesc = (a: Post, b: Post) =>
  a.published_at === b.published_at
    ? byId(b, a)
    : a.published_at === null
      ? 1
      : b.published_at === null
        ? -1
        : compareIso(b.published_at, a.published_at);

/** Keeps a profile's public post list in step with a post that was written. */
export function upsertPublicPost(posts: Post[], post: Post): Post[] {
  const present = posts.some((current) => current.id === post.id);
  if (!isPubliclyListed(post)) return present ? posts.filter((current) => current.id !== post.id) : posts;

  const next = toPublicPost(post);
  if (present) return posts.map((current) => (current.id === post.id ? next : current));
  // A full list that is only a window of the newest: an older post stays out.
  const merged = [...posts, next].sort(comparePublishedDesc);
  return merged.slice(0, PROFILE_POSTS_MAX).some((current) => current.id === post.id)
    ? merged.slice(0, PROFILE_POSTS_MAX)
    : posts;
}

export function removePublicPost(posts: Post[], postId: Uuid): Post[] {
  return posts.some((current) => current.id === postId) ? posts.filter((current) => current.id !== postId) : posts;
}

/** A server profile after one of its posts was written. */
export function withPostInGuildProfile(profile: GuildProfile, post: Post): GuildProfile {
  if (post.guild_id !== profile.id) return profile;
  const posts = upsertPublicPost(profile.posts, post);
  return posts === profile.posts ? profile : {...profile, posts};
}

/** A person's profile after one of their personal posts was written. */
export function withPostInUserProfile(profile: UserProfile, post: Post): UserProfile {
  if (post.kind !== 'user' || post.author_id !== profile.id) return profile;
  const posts = upsertPublicPost(profile.posts, post);
  return posts === profile.posts ? profile : {...profile, posts};
}

export function withoutPostInGuildProfile(profile: GuildProfile, postId: Uuid): GuildProfile {
  const posts = removePublicPost(profile.posts, postId);
  return posts === profile.posts ? profile : {...profile, posts};
}

export function withoutPostInUserProfile(profile: UserProfile, postId: Uuid): UserProfile {
  const posts = removePublicPost(profile.posts, postId);
  return posts === profile.posts ? profile : {...profile, posts};
}

/** A post after the staff hid or showed it again. */
export function withModeration<T extends Post>(post: T, moderation: PostModeration): T {
  if (
    post.status === moderation.status &&
    (post as {hidden_reason?: unknown}).hidden_reason === moderation.hidden_reason
  ) {
    return post;
  }
  return {...post, status: moderation.status, hidden_reason: moderation.hidden_reason};
}

/** A post whose server profile was deleted: its draft and published posts are closed (hidden ones stay). */
export function closedWithGuild<T extends Post>(post: T, guildId: Snowflake): T {
  if (post.guild_id !== guildId || (post.status !== 'draft' && post.status !== 'published')) return post;
  return {...post, status: 'closed'};
}

/** A post after the experience it featured was deleted. */
export function withoutFeaturedExperience<T extends Post>(post: T, experienceId: Uuid): T {
  return post.featured_experience_id === experienceId ? {...post, featured_experience_id: null} : post;
}

// ---------------------------------------------------------------------------
// Experiences
// ---------------------------------------------------------------------------

/** Replaces an experience by id, or adds it last (a new one goes last). */
export function upsertExperience<E extends {id: string}>(list: E[], experience: E): E[] {
  return list.some((current) => current.id === experience.id)
    ? list.map((current) => (current.id === experience.id ? experience : current))
    : [...list, experience];
}

/** Replaces an experience by id; leaves the list alone when it is not there. */
export function replaceExperience<E extends {id: string}>(list: E[], experience: E): E[] {
  return list.some((current) => current.id === experience.id)
    ? list.map((current) => (current.id === experience.id ? experience : current))
    : list;
}

export function removeExperience<E extends {id: string}>(list: E[], id: Uuid): E[] {
  return list.some((current) => current.id === id) ? list.filter((current) => current.id !== id) : list;
}

type ExperienceHolder = {experiences: ProfileExperience[]};

function withExperiences<H extends ExperienceHolder>(holder: H, experiences: ProfileExperience[]): H {
  return experiences === holder.experiences ? holder : {...holder, experiences};
}

/** A profile (own or someone's, as the staff sees it) after an experience was created or changed. */
export function withExperience<H extends ExperienceHolder>(profile: H, experience: PrivateExperience): H {
  return withExperiences(profile, upsertExperience(profile.experiences, experience));
}

/** Like `withExperience`, but never adds: for a profile that may not list this experience. */
export function withReplacedExperience<H extends ExperienceHolder>(profile: H, experience: PrivateExperience): H {
  return withExperiences(profile, replaceExperience(profile.experiences, experience));
}

export function withoutExperience<H extends ExperienceHolder>(profile: H, id: Uuid): H {
  return withExperiences(profile, removeExperience(profile.experiences, id));
}

/** A profile after the owner reordered their experiences (the response holds them all, in order). */
export function withExperienceOrder<H extends ExperienceHolder>(profile: H, ordered: PrivateExperience[]): H {
  return withExperiences(profile, ordered);
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

/** `GET /lineup/me/guilds` after a claim or a profile write: the server is claimed, with fresh name and icon. */
export function upsertMyGuild(list: MyGuild[], profile: GuildProfile, claimed = true): MyGuild[] {
  const entry: MyGuild = {
    id: profile.id,
    name: profile.name,
    icon_url: profile.icon_url,
    has_moddy: profile.has_moddy,
    claimed,
  };
  const present = list.find((current) => current.id === profile.id);
  if (!present) return [...list, entry].sort(byName);
  if (
    present.name === entry.name &&
    present.icon_url === entry.icon_url &&
    present.has_moddy === entry.has_moddy &&
    present.claimed === entry.claimed
  ) {
    return list;
  }
  return list.map((current) => (current.id === profile.id ? entry : current));
}

/** After the profile was deleted: the server stays in the list, no longer claimed. */
export function unclaimMyGuild(list: MyGuild[], guildId: Snowflake): MyGuild[] {
  return list.some((current) => current.id === guildId && current.claimed)
    ? list.map((current) => (current.id === guildId ? {...current, claimed: false} : current))
    : list;
}

const byName = (a: MyGuild, b: MyGuild) => (a.name ?? '').localeCompare(b.name ?? '');

/** The directory card of a server, from its full profile. Cards leave out `moddy_premium`. */
export function toGuildCard(profile: GuildProfile): GuildCard {
  return {
    id: profile.id,
    name: profile.name,
    icon_url: profile.icon_url,
    member_count: profile.member_count,
    presence_count: profile.presence_count,
    theme: profile.theme,
    tags: profile.tags,
    badges: profile.badges.filter((badge) => badge.id !== 'moddy_premium'),
  };
}

/** The directory after a profile write: an unlisted server leaves it; a listed one is updated where it shows. */
export function withGuildInDirectory<P>(
  data: InfiniteData<Paginated<GuildCard>, P> | undefined,
  profile: GuildProfile,
): InfiniteData<Paginated<GuildCard>, P> | undefined {
  if (!profile.listed) return removeItems(data, (card) => card.id === profile.id);
  const next = toGuildCard(profile);
  return mapItems(data, (card) => (card.id === profile.id ? next : card));
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/**
 * A profile's badges after the staff granted or revoked a MANUAL badge. The
 * label and the place come from the catalog; without it nothing can be built
 * and the badges are left alone.
 */
export function withManualBadge(
  badges: Badge[],
  badgeId: string,
  present: boolean,
  catalog: Catalog | undefined,
): Badge[] {
  const has = badges.some((badge) => badge.id === badgeId && badge.source === 'manual');
  if (!present) return has ? badges.filter((badge) => !(badge.id === badgeId && badge.source === 'manual')) : badges;
  if (has) return badges;
  const entry = catalog?.badges.find((candidate) => candidate.id === badgeId);
  if (!catalog || !entry) return badges;
  const rank = (id: string) => {
    const at = catalog.badges.findIndex((candidate) => candidate.id === id);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...badges, {id: badgeId, label: entry.label, source: 'manual' as const}].sort(
    (a, b) => rank(a.id) - rank(b.id),
  );
}

const sameGrant = (a: ManualBadgeGrant, b: Pick<ManualBadgeGrant, 'entity_type' | 'entity_id' | 'badge'>) =>
  a.entity_type === b.entity_type && a.entity_id === b.entity_id && a.badge === b.badge;

/** The staff's list of granted badges (newest first) after a grant: a grant of the same badge is replaced and moves first. */
export function withBadgeGrant<Pg extends ItemsPage<ManualBadgeGrant>, P>(
  data: InfiniteData<Pg, P> | undefined,
  grant: ManualBadgeGrant,
): InfiniteData<Pg, P> | undefined {
  if (!data || data.pages.length === 0) return data;
  const pages = data.pages.map((page, index) => {
    const items = page.items.filter((item) => !sameGrant(item, grant));
    if (index === 0) return {...page, items: [grant, ...items]};
    return items.length === page.items.length ? page : {...page, items};
  });
  return {...data, pages};
}

export function withoutBadgeGrant<Pg extends ItemsPage<ManualBadgeGrant>, P>(
  data: InfiniteData<Pg, P> | undefined,
  key: Pick<ManualBadgeGrant, 'entity_type' | 'entity_id' | 'badge'>,
): InfiniteData<Pg, P> | undefined {
  return removeItems(data, (item) => sameGrant(item, key));
}
