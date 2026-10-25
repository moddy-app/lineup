/** The bot directory's filters in the address bar (`q`, `theme`, `include_nsfw`), checked against the catalog. */

import {FIELD_LIMITS} from '@/api/limits';
import type {BotDirectoryFilters, Catalog} from '@/api/types';

import {filterableThemes} from '../feed/feedFilters';

export function parseBotParams(params: URLSearchParams, catalog: Catalog | undefined): BotDirectoryFilters {
  const filters: BotDirectoryFilters = {};
  const q = (params.get('q') ?? '').trim().slice(0, FIELD_LIMITS.query.qMax);
  if (q) filters.q = q;
  const theme = params.get('theme');
  // Without the catalog yet (the route loader), the theme is checked by the API.
  if (theme && (!catalog || filterableThemes(catalog).some((entry) => entry.id === theme))) filters.theme = theme;
  const nsfw = params.get('include_nsfw');
  if (nsfw === '1' || nsfw === 'true') filters.include_nsfw = true;
  return filters;
}

export function serializeBotFilters(filters: BotDirectoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.theme) params.set('theme', filters.theme);
  if (filters.include_nsfw) params.set('include_nsfw', '1');
  return params;
}

/** Adult content only once the age is confirmed on this device. */
export function effectiveBotFilters(filters: BotDirectoryFilters, nsfwConfirmed: boolean): BotDirectoryFilters {
  const {include_nsfw: includeNsfw, ...rest} = filters;
  return includeNsfw && nsfwConfirmed ? {...rest, include_nsfw: true} : rest;
}
