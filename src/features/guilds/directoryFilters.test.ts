import {describe, expect, it} from 'vitest';

import {hasActiveFilters, parseDirectoryParams, toApiFilters, toDirectoryParams} from './directoryFilters';

describe('directory filters', () => {
  it('reads and writes the URL', () => {
    const state = parseDirectoryParams(new URLSearchParams('q=minecraft&theme=gaming&nsfw=1'));
    expect(state).toEqual({q: 'minecraft', theme: 'gaming', nsfw: true});
    expect(toDirectoryParams(state).toString()).toBe('q=minecraft&theme=gaming&nsfw=1');
  });

  it('keeps defaults out of the URL and caps the search at 100 characters', () => {
    expect(toDirectoryParams({q: '  ', theme: '', nsfw: false}).toString()).toBe('');
    expect(parseDirectoryParams(new URLSearchParams({q: 'a'.repeat(150)})).q).toHaveLength(100);
  });

  it('sends include_nsfw only after the age confirmation', () => {
    const state = {q: ' hi ', theme: '', nsfw: true};
    expect(toApiFilters(state, false)).toEqual({q: 'hi', theme: undefined, include_nsfw: undefined});
    expect(toApiFilters(state, true).include_nsfw).toBe(true);
  });

  it('detects active filters', () => {
    expect(hasActiveFilters({q: '', theme: '', nsfw: false})).toBe(false);
    expect(hasActiveFilters({q: '', theme: 'x', nsfw: false})).toBe(true);
  });
});
