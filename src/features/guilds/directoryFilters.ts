import type {DirectoryFilters} from '@/api/types';
import {FIELD_LIMITS} from '@/api/limits';

/** The directory's filters as the URL holds them: `?q=&theme=&nsfw=1`. */
export interface DirectoryUrlState {
  q: string;
  theme: string;
  /** The person asked for adult servers (it only counts once they confirmed their age). */
  nsfw: boolean;
}

export function parseDirectoryParams(params: URLSearchParams): DirectoryUrlState {
  return {
    q: (params.get('q') ?? '').slice(0, FIELD_LIMITS.query.qMax),
    theme: (params.get('theme') ?? '').slice(0, FIELD_LIMITS.query.themeMax),
    nsfw: params.get('nsfw') === '1',
  };
}

/** Only what differs from the defaults goes in the URL. */
export function toDirectoryParams(state: DirectoryUrlState): URLSearchParams {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q) params.set('q', q.slice(0, FIELD_LIMITS.query.qMax));
  if (state.theme) params.set('theme', state.theme);
  if (state.nsfw) params.set('nsfw', '1');
  return params;
}

/** `include_nsfw` is sent only when asked for AND the age was confirmed on this device. */
export function toApiFilters(state: DirectoryUrlState, nsfwConfirmed: boolean): DirectoryFilters {
  return {
    q: state.q.trim() || undefined,
    theme: state.theme || undefined,
    include_nsfw: state.nsfw && nsfwConfirmed ? true : undefined,
  };
}

export function hasActiveFilters(state: DirectoryUrlState): boolean {
  return state.q.trim() !== '' || state.theme !== '' || state.nsfw;
}
