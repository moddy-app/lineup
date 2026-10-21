import {describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';

import {
  activeFilterCount,
  effectiveFilters,
  legacyKindRedirect,
  parseFeedParams,
  parseTags,
  serializeFeedFilters,
} from './feedFilters';

const parse = (query: string) => parseFeedParams(new URLSearchParams(query), catalogFixture);

describe('parseFeedParams', () => {
  it('reads known values', () => {
    const filters = parse('positions=moderator,admin&languages=fr&theme=gaming&compensation=paid&q=%20mine%20');
    expect(filters).toEqual({
      positions: ['moderator', 'admin'],
      languages: ['fr'],
      theme: 'gaming',
      compensation: 'paid',
      q: 'mine',
    });
  });

  it('does not read the kind: the route fixes it', () => {
    expect(parse('kind=user&type=user')).toEqual({});
  });

  it('accepts repeated keys and drops duplicates', () => {
    expect(parse('positions=moderator&positions=moderator,admin').positions).toEqual(['moderator', 'admin']);
  });

  it('ignores what the catalog does not know', () => {
    expect(parse('kind=user&positions=nope&languages=zz&theme=nope&compensation=free')).toEqual({});
  });

  it('never filters on the adult theme', () => {
    expect(parse('theme=nsfw')).toEqual({});
  });

  it('cuts the search at 100 characters', () => {
    expect(parse(`q=${'a'.repeat(150)}`).q).toHaveLength(100);
  });

  it('keeps only tags the catalog pattern accepts', () => {
    expect(parseTags('Minecraft, #survie, bad tag!, x', catalogFixture)).toEqual(['minecraft', 'survie']);
  });
});

describe('serialize and count', () => {
  it('round-trips and omits empty filters', () => {
    const filters = parse('positions=moderator,admin&include_nsfw=1&tags=minecraft');
    expect(parse(serializeFeedFilters(filters).toString())).toEqual(filters);
    expect(serializeFeedFilters({}).toString()).toBe('');
    expect(activeFilterCount(filters)).toBe(3);
  });
});

describe('effectiveFilters', () => {
  it('sends the kind of the route', () => {
    expect(effectiveFilters({q: 'a'}, 'user', false)).toEqual({q: 'a', kind: 'user'});
  });

  it('sends include_nsfw only after the age confirmation', () => {
    expect(effectiveFilters({include_nsfw: true}, 'guild', false)).toEqual({kind: 'guild'});
    expect(effectiveFilters({include_nsfw: true}, 'guild', true)).toEqual({kind: 'guild', include_nsfw: true});
  });
});

describe('legacyKindRedirect', () => {
  it('leaves an address without a kind alone', () => {
    expect(legacyKindRedirect(new URLSearchParams('q=a'), 'guild')).toBeNull();
  });

  it('sends ?type=user on / to the people page, keeping the other filters', () => {
    const redirect = legacyKindRedirect(new URLSearchParams('type=user&q=mine&languages=fr'), 'guild');
    expect(redirect?.kind).toBe('user');
    expect(redirect?.search.toString()).toBe('q=mine&languages=fr');
  });

  it('understands the former kind parameter, and drops one that matches the page', () => {
    expect(legacyKindRedirect(new URLSearchParams('kind=guild'), 'user')?.kind).toBe('guild');
    expect(legacyKindRedirect(new URLSearchParams('kind=guild'), 'guild')?.kind).toBe('guild');
  });
});
