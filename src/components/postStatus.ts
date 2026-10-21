/** How each post status shows: its label key and the pill's color. */

import type {PostStatus} from '@/api/types';
import type {StatusVariant} from '@/ui';

export interface PostStatusView {
  key: PostStatus | 'expired';
  variant: StatusVariant;
  neutral: boolean;
}

export function postStatusView(status: PostStatus, isExpired = false): PostStatusView {
  if (status === 'published' && isExpired) return {key: 'expired', variant: 'default', neutral: true};
  switch (status) {
    case 'draft':
      return {key: 'draft', variant: 'default', neutral: false};
    case 'published':
      return {key: 'published', variant: 'accent', neutral: false};
    case 'closed':
      return {key: 'closed', variant: 'default', neutral: true};
    case 'hidden':
      return {key: 'hidden', variant: 'error', neutral: false};
  }
}
