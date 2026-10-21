import {describe, expect, it} from 'vitest';

import {ApiFailure} from '../errors';
import {compareKeyed, decodeCursor, encodeCursor, pageRows} from './cursor';
import {RateLimiter} from './rateLimiter';

describe('cursors', () => {
  it('encodes like the documented example', () => {
    const cursor = encodeCursor(['2026-10-20T13:58:02+00:00', '812345678901234567']);
    expect(cursor).toBe('WyIyMDI2LTEwLTIwVDEzOjU4OjAyKzAwOjAwIiwgIjgxMjM0NTY3ODkwMTIzNDU2NyJd');
    expect(decodeCursor(cursor, (id) => /^\d+$/.test(id))).toEqual(['2026-10-20T13:58:02+00:00', '812345678901234567']);
  });

  it('answers cursor_invalid to anything altered', () => {
    for (const bad of [
      '%%%',
      'abc',
      btoa('[1,2]'),
      btoa('{"a":1}'),
      btoa('["nope","1"]'),
      btoa('["2026-10-20T00:00:00+00:00","x"]'),
    ]) {
      try {
        decodeCursor(bad, (id) => /^\d+$/.test(id));
        throw new Error(`accepted ${bad}`);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiFailure);
        expect((error as ApiFailure).status).toBe(422);
        expect((error as ApiFailure).code).toBe('cursor_invalid');
      }
    }
    expect(decodeCursor(undefined, () => true)).toBeNull();
  });

  it('pages a sorted list by keyset, one extra row deciding the cursor', () => {
    const rows = [5, 4, 3, 2, 1].map((n) => ({at: `2026-10-20T00:00:0${n}+00:00`, id: String(n)}));
    const sorted = [...rows].sort(compareKeyed(true));
    const first = pageRows(sorted, 2, null, true);
    expect(first.rows.map((row) => row.id)).toEqual(['5', '4']);
    const after = decodeCursor(first.nextCursor ?? undefined, () => true);
    const second = pageRows(sorted, 2, after, true);
    expect(second.rows.map((row) => row.id)).toEqual(['3', '2']);
    const last = pageRows(
      sorted,
      2,
      decodeCursor(second.nextCursor ?? undefined, () => true),
      true,
    );
    expect(last.rows.map((row) => row.id)).toEqual(['1']);
    expect(last.nextCursor).toBeNull();
    // Exactly `limit` rows left: no cursor.
    expect(pageRows(sorted.slice(0, 2), 2, null, true).nextCursor).toBeNull();
  });
});

describe('the rate limiter', () => {
  it('allows the limit, refuses beyond with the remaining TTL, and starts again after the window', () => {
    const limiter = new RateLimiter();
    const results = Array.from({length: 4}, () => limiter.hit('k', 3, 60_000, 1_000));
    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    expect(limiter.hit('k', 3, 60_000, 31_000).retryAfter).toBe(30);
    expect(limiter.hit('k', 3, 60_000, 61_001).allowed).toBe(true);
    expect(limiter.hit('other', 3, 60_000, 1_000).allowed).toBe(true);
  });
});
