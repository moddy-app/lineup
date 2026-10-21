/** The "more actions" menu of a profile: copy the id, copy the link, and report (not on your own profile). Signed-out visitors are sent to sign in first. */

import {useState} from 'react';

import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {ReportDialog, useCopyText} from '@/components';
import {useT} from '@/i18n/useT';
import {Dropdown} from '@/ui';

export function ProfileMenu({userId, isSelf}: {userId: string; isSelf?: boolean}) {
  const {t} = useT('userProfile');
  const {t: tComponents} = useT('components');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const copy = useCopyText();
  const [dialogOpen, setDialogOpen] = useState(false);
  // The dialog is mounted on first use, then kept so that it can animate out.
  const [mounted, setMounted] = useState(false);
  return (
    <span className="profile-menu">
      <Dropdown
        align="end"
        label={t('header.more')}
        items={[
          {
            key: 'id',
            icon: 'badge',
            label: t('menu.copyId'),
            onSelect: () => copy(userId, t('menu.idCopied'), t('menu.copyFailed')),
          },
          {
            key: 'link',
            icon: 'link',
            label: t('menu.copyLink'),
            onSelect: () => copy(window.location.href, t('menu.linkCopied'), t('menu.copyFailed')),
          },
          ...(isSelf
            ? []
            : [
                {
                  key: 'report',
                  icon: 'flag',
                  label: tComponents('report.button'),
                  disabled: !canWrite,
                  onSelect: () =>
                    void auth.run(() => {
                      setMounted(true);
                      setDialogOpen(true);
                    }),
                },
              ]),
        ]}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button
            {...aria}
            ref={ref}
            aria-label={t('header.more')}
            title={t('header.more')}
            onclick={onActivate}
          >
            <md-icon>more_vert</md-icon>
          </md-icon-button>
        )}
      />
      {mounted && (
        <ReportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} target={{type: 'user', id: userId}} />
      )}
    </span>
  );
}
