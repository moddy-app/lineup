import {afterEach, describe, expect, it} from 'vitest';

import {formatDate, formatMonthYear, formatNumber, parseDate} from './format';

afterEach(() => {
  document.documentElement.lang = 'en';
});

describe('parseDate', () => {
  it('reads a calendar date as a local day, without a time zone shift', () => {
    const date = parseDate('2026-03-01');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 1]);
  });

  it('reads a timestamp as an instant', () => {
    expect(parseDate('2026-10-20T14:03:11.482913+00:00').toISOString()).toBe('2026-10-20T14:03:11.482Z');
  });
});

describe('formatDate', () => {
  it('follows <html lang>', () => {
    document.documentElement.lang = 'fr';
    expect(formatDate('2026-03-12', 'long')).toBe('12 mars 2026');
    document.documentElement.lang = 'en';
    expect(formatDate('2026-03-12', 'long')).toBe('March 12, 2026');
    document.documentElement.lang = 'de';
    expect(formatDate('2026-03-12', 'long')).toBe('12. März 2026');
  });

  it('keeps the calendar day whatever the time zone', () => {
    // 2026-01-01 must not become 31 December.
    expect(formatDate('2026-01-01', 'short', 'en-US')).toBe('1/1/26');
  });
});

describe('formatMonthYear', () => {
  it('names the month', () => {
    expect(formatMonthYear('2026-03-12', 'fr')).toBe('mars 2026');
    expect(formatMonthYear('2026-03-12', 'es')).toBe('marzo de 2026');
  });
});

describe('formatNumber (kit)', () => {
  it('uses the page language', () => {
    document.documentElement.lang = 'en';
    expect(formatNumber(12345)).toBe('12,345');
  });
});
