/** What every endpoint module shares. */

/** Path parameters are encoded: ids are strings and nothing is trusted to be URL-safe. */
export const enc = encodeURIComponent;

/** The options of a read: the TanStack Query abort signal. */
export interface ReadOptions {
  signal?: AbortSignal;
}

/** The options of a paginated read. `cursor` is the opaque `next_cursor` of the previous page. */
export interface PageOptions extends ReadOptions {
  cursor?: string | null;
  limit?: number;
}
