/**
 * Opaque cursors (LINEUP.md §0): base64url of a JSON array `[sort value, id]`,
 * like the documented example (`WyIyMDI2LTEw…` decodes to
 * `["2026-10-20T13:58:02+00:00", "812345678901234567"]`). The front never
 * reads one; a cursor that does not decode is `422 cursor_invalid`.
 */

import {unprocessable} from '../errors';

export type CursorKey = [string, string];

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(raw: string): string {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Python's `json.dumps` puts a space after the comma. */
export function encodeCursor(key: CursorKey): string {
  return toBase64Url(`[${JSON.stringify(key[0])}, ${JSON.stringify(key[1])}]`);
}

export const cursorInvalid = () => unprocessable('cursor_invalid', 'Curseur invalide.');

/** The key inside a cursor; `isId` checks the second part (digits for servers, a UUID for posts…). */
export function decodeCursor(raw: string | undefined, isId: (id: string) => boolean): CursorKey | null {
  if (raw === undefined || raw === '') return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      !Number.isNaN(Date.parse(parsed[0])) &&
      isId(parsed[1])
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Not base64, not UTF-8 or not JSON: tampered.
  }
  throw cursorInvalid();
}

export interface Keyed {
  /** Sort value: an ISO datetime. */
  at: string;
  id: string;
}

/**
 * Keyset pagination over rows already sorted in the wanted order: `after`
 * is the last row of the previous page. Reads `limit + 1` rows to know
 * whether a next page exists, exactly like `LIMIT n + 1` in SQL.
 *
 * `descending` is the sort direction. Returns the rows of the page and the
 * cursor to the next (null at the end). The cursor is built from the LAST ROW
 * READ, before any post-read filtering: this is why a page can come back short
 * or empty with a cursor (§0).
 */
export function pageRows<T extends Keyed>(
  sorted: T[],
  limit: number,
  after: CursorKey | null,
  descending: boolean,
): {rows: T[]; nextCursor: string | null} {
  const afterTime = after ? Date.parse(after[0]) : 0;
  const rest = after
    ? sorted.filter((row) => {
        const time = Date.parse(row.at);
        if (time === afterTime) return descending ? row.id < after[1] : row.id > after[1];
        return descending ? time < afterTime : time > afterTime;
      })
    : sorted;
  const rows = rest.slice(0, limit);
  const last = rows[rows.length - 1];
  const hasMore = rest.length > limit;
  return {rows, nextCursor: hasMore && last ? encodeCursor([last.at, last.id]) : null};
}

/** The comparator of a keyset order: by time then id, both descending or both ascending. */
export function compareKeyed(descending: boolean) {
  return (a: Keyed, b: Keyed): number => {
    const byTime = Date.parse(a.at) - Date.parse(b.at);
    const byId = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    const order = byTime !== 0 ? byTime : byId;
    return descending ? -order : order;
  };
}
