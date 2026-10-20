/**
 * The way to apply to a post (LINEUP.md §8 "Candidature").
 *
 *  - `external_url`: "Postuler", a link to the author's page (new tab);
 *  - `discord_dm`: "Contacter en MP". The API stores no recipient: by
 *    convention it is the author, so the button opens their Lineup profile,
 *    with a line saying the contact happens in a Discord DM;
 *  - no application: nothing. Nothing either once the post is expired or closed.
 */

import type {Post} from '@/api/types';
import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {LinkButton} from '@/ui';

import {linkHost} from './links';

interface ExternalApplyButtonProps {
  url: string;
}

/** "Postuler": the filled button of the page, a link out. */
export function ExternalApplyButton({url}: ExternalApplyButtonProps) {
  const {t} = useT('components');
  if (!linkHost(url)) return null;
  // `rel` goes on the host element: Material Web's inner <a> cannot take it, and
  // browsers apply noopener to target=_blank anyway.
  const linkProps = {href: url, target: '_blank', rel: 'noopener noreferrer'} as const;
  return (
    <md-filled-button {...linkProps}>
      <md-icon slot="icon" className="filled" aria-hidden="true">
        send
      </md-icon>
      {t('application.apply')}
    </md-filled-button>
  );
}

interface ApplicationActionProps {
  post: Pick<Post, 'application' | 'status' | 'is_expired' | 'author_id'>;
  className?: string;
}

export function ApplicationAction({post, className}: ApplicationActionProps) {
  const {t} = useT('components');
  const {application} = post;
  if (!application || post.status !== 'published' || post.is_expired) return null;

  if (application.type === 'external_url') {
    return application.url ? (
      <div className={cx('application-action', className)}>
        <ExternalApplyButton url={application.url} />
      </div>
    ) : null;
  }
  if (application.type === 'discord_dm') {
    return (
      <div className={cx('application-action', className)}>
        <LinkButton to={paths.user(post.author_id)} icon="chat">
          {t('application.dm')}
        </LinkButton>
        <p className="application-hint">{t('application.dmHint')}</p>
      </div>
    );
  }
  return null; // lineup_form is reserved: no button yet.
}
