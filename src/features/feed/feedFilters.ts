/**
 * The feed's filters in the address bar. The URL is the state: shareable, and
 * the back button works. Values are checked against the catalog; anything it
 * does not know is ignored instead of being sent to the API.
 */

import {FIELD_LIMITS} from '@/api/limits';
import type {Catalog, FeedFilters, PostKind} from '@/api/types';

/** The theme that the "include adult content" switch governs, never a filter of its own. */
const NSFW_THEME = 'nsfw';

/**
 * The filters the page lets people set (no `guild_id` / `author_id`). The kind
 * is not one of them: the route fixes it (`/` is `guild`, `/people` is `user`).
 */
export type UiFilters = Pick<
  FeedFilters,
  'positions' | 'languages' | 'tags' | 'theme' | 'compensation' | 'q' | 'include_nsfw'
>;

export const SEARCH_DEBOUNCE_MS = 350;

function listParam(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Themes the filter offers: the catalog's, without the adult one. */
export function filterableThemes(catalog: Catalog): Catalog['themes'] {
  return catalog.themes.filter((theme) => theme.id !== NSFW_THEME);
}

/** A tag as typed: lowercase, no leading `#`. */
export function normalizeTag(value: string): string {
  return value.trim().replace(/^#/, '').toLowerCase();
}

/** The tags of a comma-separated text that the catalog's pattern accepts, at most 10. */
export function parseTags(value: string, catalog: Catalog): string[] {
  let pattern: RegExp;
  try {
    pattern = new RegExp(catalog.limits.tag_pattern);
  } catch {
    return [];
  }
  return unique(
    value
      .split(',')
      .map(normalizeTag)
      .filter((tag) => pattern.test(tag)),
  ).slice(0, catalog.limits.max_tags);
}

/** What the URL asks for, reduced to what the catalog knows. */
export function parseFeedParams(params: URLSearchParams, catalog: Catalog): UiFilters {
  const filters: UiFilters = {};

  const known = (list: readonly {id: string}[]) => new Set(list.map((entry) => entry.id));
  const positions = known(catalog.positions);
  const languages = known(catalog.languages);

  const pickedPositions = unique(listParam(params, 'positions').filter((id) => positions.has(id))).slice(
    0,
    FIELD_LIMITS.query.feedPositionsMax,
  );
  if (pickedPositions.length > 0) filters.positions = pickedPositions;

  const pickedLanguages = unique(listParam(params, 'languages').filter((id) => languages.has(id)));
  if (pickedLanguages.length > 0) filters.languages = pickedLanguages;

  const tags = parseTags(listParam(params, 'tags').join(','), catalog);
  if (tags.length > 0) filters.tags = tags;

  const theme = params.get('theme');
  if (theme && filterableThemes(catalog).some((entry) => entry.id === theme)) filters.theme = theme;

  const compensation = params.get('compensation');
  if (compensation && catalog.compensations.some((entry) => entry.id === compensation)) {
    filters.compensation = compensation;
  }

  const q = (params.get('q') ?? '').trim().slice(0, FIELD_LIMITS.query.qMax);
  if (q) filters.q = q;

  const nsfw = params.get('include_nsfw');
  if (nsfw === '1' || nsfw === 'true') filters.include_nsfw = true;

  return filters;
}

/** The search params for a set of filters (empty ones left out). Lists are comma-separated. */
export function serializeFeedFilters(filters: UiFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.positions?.length) params.set('positions', filters.positions.join(','));
  if (filters.languages?.length) params.set('languages', filters.languages.join(','));
  if (filters.theme) params.set('theme', filters.theme);
  if (filters.compensation) params.set('compensation', filters.compensation);
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.q) params.set('q', filters.q);
  if (filters.include_nsfw) params.set('include_nsfw', '1');
  return params;
}

/** How many filters are set (a list counts once). */
export function activeFilterCount(filters: UiFilters): number {
  return [
    filters.positions?.length,
    filters.languages?.length,
    filters.theme,
    filters.compensation,
    filters.tags?.length,
    filters.q,
    filters.include_nsfw,
  ].filter(Boolean).length;
}

/** The filters sent to the API: the route's kind, and adult content only once the age is confirmed. */
export function effectiveFilters(filters: UiFilters, kind: PostKind, nsfwConfirmed: boolean): FeedFilters {
  const {include_nsfw: includeNsfw, ...rest} = filters;
  return includeNsfw && nsfwConfirmed ? {...rest, kind, include_nsfw: true} : {...rest, kind};
}

/**
 * An old address (`/?type=user`, `/?kind=user`) asks for the other page: the
 * search to carry there, without the kind, or null when the address is fine.
 */
export function legacyKindRedirect(
  params: URLSearchParams,
  current: PostKind,
): {kind: PostKind; search: URLSearchParams} | null {
  const asked = params.get('type') ?? params.get('kind');
  const had = params.has('type') || params.has('kind');
  if (!had) return null;
  const rest = new URLSearchParams(params);
  rest.delete('type');
  rest.delete('kind');
  const kind: PostKind = asked === 'user' || asked === 'guild' ? asked : current;
  return {kind, search: rest};
}
