import {describe, expect, it} from 'vitest';

import {createTestApi} from './testing';

describe('the seed', () => {
  it('serves the catalog', async () => {
    const api = createTestApi();
    const response = await api.call('GET', '/lineup/catalog');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(response.json.positions).toHaveLength(11);
  });

  it('walks the feed to the end, with a short page then an empty page that still has a cursor', async () => {
    const api = createTestApi();
    const sizes: number[] = [];
    const cursors: Array<string | null> = [];
    let cursor: string | null = null;
    let total = 0;
    do {
      const response = await api.call('GET', '/lineup/posts', {query: cursor ? {cursor} : {}});
      expect(response.status).toBe(200);
      sizes.push(response.json.items.length);
      cursors.push(response.json.next_cursor);
      total += response.json.items.length;
      cursor = response.json.next_cursor;
    } while (cursor);
    expect(sizes.some((size) => size === 0)).toBe(true);
    const emptyAt = sizes.findIndex((size) => size === 0);
    expect(cursors[emptyAt]).not.toBeNull();
    expect(sizes[0]).toBeLessThan(20);
    expect(total).toBeGreaterThan(15);
  });

  it('walks the directory with an empty page that carries a cursor', async () => {
    const api = createTestApi();
    const sizes: number[] = [];
    const cursors: Array<string | null> = [];
    let cursor: string | null = null;
    do {
      const response = await api.call('GET', '/lineup/guilds', {query: cursor ? {cursor} : {}});
      expect(response.status).toBe(200);
      sizes.push(response.json.items.length);
      cursors.push(response.json.next_cursor);
      cursor = response.json.next_cursor;
    } while (cursor);
    const emptyAt = sizes.findIndex((size) => size === 0);
    expect(emptyAt).toBeGreaterThanOrEqual(0);
    expect(cursors[emptyAt]).not.toBeNull();
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(8);
  });
});
