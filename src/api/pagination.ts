/**
 * Lists that load by pages (LINEUP.md §0 "Pagination").
 *
 * The rule that makes this more than "fetch the next page": a page can be
 * shorter than `limit`, even EMPTY, while `next_cursor` is not null (posts of a
 * suspended author are removed after the page is read). So "end of the list"
 * is `next_cursor === null`, never a short page, and an empty page with a
 * cursor is followed on its own, up to three in a row; then the list stops and
 * offers "Load more", so a long run of hidden posts cannot loop.
 */

import type {InfiniteData, UseInfiniteQueryResult} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo} from 'react';

import type {ApiError} from './client';

export interface ListPage<T> {
  items: T[];
  next_cursor?: string | null;
}

/** How many empty pages in a row are followed without the person asking. */
export const MAX_AUTO_EMPTY_PAGES = 3;

export function flattenPages<T>(pages: ReadonlyArray<ListPage<T>> | undefined): T[] {
  return pages ? pages.flatMap((page) => page.items) : [];
}

/** How many pages, counted from the last one, are empty. */
export function trailingEmptyPages(pages: ReadonlyArray<ListPage<unknown>>): number {
  let count = 0;
  for (let index = pages.length - 1; index >= 0 && pages[index]!.items.length === 0; index -= 1) count += 1;
  return count;
}

/** Whether the list should load its next page by itself: the last page is empty, a cursor remains, and it has not happened three times. */
export function shouldAutoFetchNext(pages: ReadonlyArray<ListPage<unknown>>, hasNextPage: boolean): boolean {
  if (!hasNextPage || pages.length === 0) return false;
  const last = pages[pages.length - 1]!;
  if (last.items.length > 0 || last.next_cursor == null) return false;
  return trailingEmptyPages(pages) < MAX_AUTO_EMPTY_PAGES;
}

export interface InfiniteList<T> {
  /** Every item loaded so far, in order. */
  items: T[];
  /** More pages exist (a cursor remains): show "Load more", whatever the last page held. */
  hasMore: boolean;
  loadMore: () => void;
  /** The next page is loading, by the person's request or on its own after an empty page. */
  isLoadingMore: boolean;
  /** The first page is loading. */
  isLoading: boolean;
  /** Reloading in the background (a refetch), with items on screen. */
  isRefetching: boolean;
  /** The items shown are the previous filters' while the new ones load. */
  isPlaceholderData: boolean;
  /** Nothing to show and nothing more to load. */
  isEmpty: boolean;
  /** The first page failed. */
  isError: boolean;
  /** Loading the next page failed: the items stay, offer "Try again". */
  isLoadMoreError: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/** A flattened view of an infinite query, with the empty-page rule applied. */
export function useInfiniteList<T, Page extends ListPage<T>>(
  query: UseInfiniteQueryResult<InfiniteData<Page, unknown>, ApiError>,
): InfiniteList<T> {
  const {data, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch} = query;
  const pages = data?.pages;
  const items = useMemo(() => flattenPages<T>(pages), [pages]);

  const autoFetch =
    !!pages && shouldAutoFetchNext(pages, hasNextPage) && !isFetching && !isFetchNextPageError && !query.isError;
  // `pages` is a dependency: pages that arrive one after the other can leave `autoFetch` true
  // throughout, and each new empty page must trigger the next fetch.
  useEffect(() => {
    if (autoFetch) void fetchNextPage({cancelRefetch: false});
  }, [autoFetch, pages, fetchNextPage]);

  const loadMore = useCallback(() => {
    void fetchNextPage({cancelRefetch: false});
  }, [fetchNextPage]);
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
    hasMore: hasNextPage,
    loadMore,
    isLoadingMore: isFetchingNextPage || autoFetch,
    isLoading: query.isPending,
    isRefetching: query.isRefetching && !isFetchingNextPage,
    isPlaceholderData: query.isPlaceholderData,
    isEmpty: !query.isPending && !query.isError && !hasNextPage && items.length === 0,
    isError: query.isError && !isFetchNextPageError,
    isLoadMoreError: isFetchNextPageError,
    error: query.error,
    refetch: reload,
  };
}
