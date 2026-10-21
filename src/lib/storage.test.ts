import {afterEach, describe, expect, it, vi} from 'vitest';

import {getItem, getString, removeItem, setItem, setString} from './storage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('storage', () => {
  it('round-trips JSON', () => {
    expect(setItem('k', {a: [1, 2]})).toBe(true);
    expect(getItem('k', null)).toEqual({a: [1, 2]});
    removeItem('k');
    expect(getItem('k', 'fallback')).toBe('fallback');
  });

  it('falls back on corrupt JSON', () => {
    localStorage.setItem('k', '{not json');
    expect(getItem('k', 42)).toBe(42);
  });

  it('reads and writes plain strings as they are', () => {
    setString('lang', 'fr');
    expect(localStorage.getItem('lang')).toBe('fr');
    expect(getString('lang')).toBe('fr');
  });

  it('never throws when storage does (private window, quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(setItem('k', 1)).toBe(false);
    expect(setString('k', 'x')).toBe(false);
    expect(getItem('k', 'fallback')).toBe('fallback');
    expect(getString('k')).toBeNull();
  });
});
