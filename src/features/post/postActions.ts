import type {PostDetail, PostStatus} from '@/api/types';

export type OwnerAction = 'edit' | 'publish' | 'reopen' | 'close' | 'delete';

/**
 * What an editor can do with a post in its state. A hidden post can only be
 * read: the staff alone unhide it, and only they can delete it. An expired
 * published post cannot be published again until its date changes (edit).
 */
export function ownerActions(post: Pick<PostDetail, 'status' | 'can_edit'>): OwnerAction[] {
  if (!post.can_edit) return [];
  const byStatus: Record<PostStatus, OwnerAction[]> = {
    draft: ['publish', 'edit', 'delete'],
    published: ['edit', 'close', 'delete'],
    closed: ['reopen', 'edit', 'delete'],
    hidden: [],
  };
  return byStatus[post.status];
}
