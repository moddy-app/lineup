import type {Post} from '@/api/types';

/** Posts that count against a server's quota: published and not past their date. */
export function countLivePosts(posts: readonly Pick<Post, 'status' | 'is_expired'>[]): number {
  return posts.filter((post) => post.status === 'published' && !post.is_expired).length;
}
