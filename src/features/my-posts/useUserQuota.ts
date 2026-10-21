import {useEffect} from 'react';

import {useMe, useMyPosts} from '@/api/queries';
import {type InfiniteList, useInfiniteList} from '@/api/pagination';
import type {Paginated, PrivatePost} from '@/api/types';

/**
 * The person's personal quota (LINEUP.md §8): published, unexpired posts of kind
 * `user` that they wrote. Counted from their published posts, read page after
 * page until the list ends; `ready` is false until it has.
 */
export function useUserQuota(): {used: number; ready: boolean; list: InfiniteList<PrivatePost>} {
  const list = useInfiniteList<PrivatePost, Paginated<PrivatePost>>(useMyPosts({status: 'published'}));
  const session = useMe().data;
  const meId = session?.status === 'authenticated' ? session.me.user.id : undefined;

  const {hasMore, isLoadingMore, isLoadMoreError, loadMore} = list;
  useEffect(() => {
    if (hasMore && !isLoadingMore && !isLoadMoreError) loadMore();
  }, [hasMore, isLoadingMore, isLoadMoreError, loadMore, list.items.length]);

  const used = list.items.filter(
    (post) => post.kind === 'user' && !post.is_expired && post.status === 'published' && post.author_id === meId,
  ).length;
  return {used, ready: !list.isLoading && !list.isError && !hasMore, list};
}
