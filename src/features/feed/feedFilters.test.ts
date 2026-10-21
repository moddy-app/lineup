import {describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';

import {activeFilterCount, effectiveFilters, parseFeedParams, parseTags, serializeFeedFilters} from './feedFilters';

const parse = (query: string) => parseFeedParams(new URLSearchParams(query), catalogFixture);

describe('parseFeedParams', () => {
  it('reads known values', () => {
    const filters = parse('kind=guild&positions=moderator,admin&languages=fr&theme=gaming&compensation=paid&q=%20mine%20');
    expect(filters).toEqual({
      kind: 'guild',
      positions: ['moderator', 'admin'],
      languages: ['fr'],
      theme: 'gaming',
      compensation: 'paid',
      q: 'mine',
    });
  });

  it('accepts repeated keys and drops duplicates', () => {
    expect(parse('positions=moderator&positions=moderator,admin').positions).toEqual(['moderator', 'admin']);
  });

  it('ignores what the catalog does not know', () => {
    expect(parse('kind=bogus&positions=nope&languages=zz&theme=nope&compensation=free')).toEqual({});
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
    const filters = parse('kind=user&positions=moderator,admin&include_nsfw=1&tags=minecraft');
    expect(parse(serializeFeedFilters(filters).toString())).toEqual(filters);
    expect(serializeFeedFilters({}).toString()).toBe('');
    expect(activeFilterCount(filters)).toBe(4);
  });
});

describe('effectiveFilters', () => {
  it('sends include_nsfw only after the age confirmation', () => {
    expect(effectiveFilters({include_nsfw: true}, false)).toEqual({});
    expect(effectiveFilters({include_nsfw: true}, true)).toEqual({include_nsfw: true});
  });
});
