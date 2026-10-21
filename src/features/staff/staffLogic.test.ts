import {describe, expect, it} from 'vitest';

import type {CatalogBadge} from '@/api/types';

import {
  extractPostId,
  isEntityId,
  manualBadgesFor,
  parseEntityFilter,
  parseReportStatus,
  parseReviewStatus,
} from './staffLogic';

const badge = (id: string, entity: CatalogBadge['entity'], source: CatalogBadge['source']): CatalogBadge => ({
  id,
  label: {fr: id, en: id},
  entity,
  source,
});
const catalog = [
  badge('moddy_installed', 'guild', 'computed'),
  badge('lineup_verified', 'both', 'manual'),
  badge('moddy_partner', 'both', 'manual'),
  badge('moddy_server', 'guild', 'manual'),
  badge('discord_staff', 'user', 'discord'),
];

describe('staff filters', () => {
  it('falls back to the default on an unknown value', () => {
    expect(parseReviewStatus('verified')).toBe('verified');
    expect(parseReviewStatus('nope')).toBe('pending');
    expect(parseReviewStatus(null)).toBe('pending');
    expect(parseReportStatus('all')).toBe('all');
    expect(parseReportStatus('x')).toBe('open');
    expect(parseEntityFilter('guild')).toBe('guild');
    expect(parseEntityFilter('x')).toBe('all');
  });
});

describe('extractPostId', () => {
  const id = '0b6f2c1e-3f0a-4c55-9d2a-6e9d1b0a7c11';
  it('reads a bare id and a URL', () => {
    expect(extractPostId(`  ${id} `)).toBe(id);
    expect(extractPostId(`https://lineup.moddy.app/posts/${id.toUpperCase()}?x=1`)).toBe(id);
  });
  it('rejects anything else', () => {
    expect(extractPostId('hello')).toBeNull();
    expect(extractPostId('0b6f2c1e-3f0a')).toBeNull();
  });
});

describe('isEntityId', () => {
  it('accepts 15 to 20 digits only', () => {
    expect(isEntityId('812345678901234567')).toBe(true);
    expect(isEntityId('1234')).toBe(false);
    expect(isEntityId('81234567890123456a')).toBe(false);
    expect(isEntityId('')).toBe(false);
  });
});

describe('manualBadgesFor', () => {
  it('keeps manual badges that fit the entity', () => {
    expect(manualBadgesFor(catalog, 'user').map((b) => b.id)).toEqual(['lineup_verified', 'moddy_partner']);
    expect(manualBadgesFor(catalog, 'guild').map((b) => b.id)).toEqual([
      'lineup_verified',
      'moddy_partner',
      'moddy_server',
    ]);
    expect(manualBadgesFor(undefined, 'user')).toEqual([]);
  });
});
