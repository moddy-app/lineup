import {describe, expect, it} from 'vitest';

import {flattenPages, MAX_AUTO_EMPTY_PAGES, shouldAutoFetchNext, trailingEmptyPages} from './pagination';

const full = (cursor: string | null) => ({items: [1, 2], next_cursor: cursor});
const empty = (cursor: string | null) => ({items: [] as number[], next_cursor: cursor});

describe('flattenPages', () => {
  it('concatenates the pages in order', () => {
    expect(flattenPages([full('a'), {items: [3], next_cursor: null}])).toEqual([1, 2, 3]);
  });

  it('is empty without data', () => {
    expect(flattenPages(undefined)).toEqual([]);
    expect(flattenPages([])).toEqual([]);
  });
});

describe('trailingEmptyPages', () => {
  it('counts the empty pages at the end only', () => {
    expect(trailingEmptyPages([])).toBe(0);
    expect(trailingEmptyPages([full('a')])).toBe(0);
    expect(trailingEmptyPages([empty('a'), full('b'), empty('c'), empty('d')])).toBe(2);
    expect(trailingEmptyPages([empty('a'), empty('b')])).toBe(2);
  });
});

describe('shouldAutoFetchNext (an empty page with a cursor is followed)', () => {
  it('follows an empty page that has a cursor', () => {
    expect(shouldAutoFetchNext([empty('a')], true)).toBe(true);
    expect(shouldAutoFetchNext([full('a'), empty('b')], true)).toBe(true);
  });

  it('never concludes the end from a short page', () => {
    // A page shorter than its limit, with a cursor, is not the end, but it has items: nothing is fetched on its own.
    expect(shouldAutoFetchNext([{items: [1], next_cursor: 'a'}], true)).toBe(false);
  });

  it('stops at the end of the list', () => {
    expect(shouldAutoFetchNext([empty(null)], false)).toBe(false);
    expect(shouldAutoFetchNext([full('a'), empty(null)], false)).toBe(false);
    expect(shouldAutoFetchNext([], false)).toBe(false);
  });

  it('follows up to three empty pages in a row, then leaves "Load more" to the person', () => {
    expect(MAX_AUTO_EMPTY_PAGES).toBe(3);
    expect(shouldAutoFetchNext([empty('a')], true)).toBe(true);
    expect(shouldAutoFetchNext([empty('a'), empty('b')], true)).toBe(true);
    expect(shouldAutoFetchNext([empty('a'), empty('b'), empty('c')], true)).toBe(false);
    expect(shouldAutoFetchNext([full('x'), empty('a'), empty('b'), empty('c'), empty('d')], true)).toBe(false);
  });

  it('starts counting again after a page with items', () => {
    expect(shouldAutoFetchNext([empty('a'), empty('b'), empty('c'), full('d'), empty('e')], true)).toBe(true);
  });

  it('does nothing when the last page has no cursor even if the query says otherwise', () => {
    expect(shouldAutoFetchNext([empty(null)], true)).toBe(false);
  });
});
