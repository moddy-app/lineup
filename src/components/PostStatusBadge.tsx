/**
 * The status of a post as a pill: draft (default), published (accent),
 * closed (neutral grey), hidden by the team (error). A published post past its
 * date reads "Expirée" in grey instead of "Publiée": it is no longer live.
 */

import type {PostStatus} from '@/api/types';
import {useT} from '@/i18n/useT';
import {Status} from '@/ui';

import {postStatusView} from './postStatus';

export function PostStatusBadge({status, isExpired}: {status: PostStatus; isExpired?: boolean}) {
  const {t} = useT('components');
  const view = postStatusView(status, isExpired);
  return (
    <Status variant={view.variant} className={view.neutral ? 'neutral' : undefined}>
      {t(`post.status.${view.key}`)}
    </Status>
  );
}
