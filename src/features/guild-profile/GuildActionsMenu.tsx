import {useState} from 'react';

import {ReportDialog, useCopyText} from '@/components';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Dropdown} from '@/ui';

interface GuildActionsMenuProps {
  guildId: string;
  /** Managers do not report their own server. */
  canReport: boolean;
}

/** The "more" menu of a server profile: report it, copy its link or its id. */
export function GuildActionsMenu({guildId, canReport}: GuildActionsMenuProps) {
  const {t} = useT('guildProfile');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const copy = useCopyText();
  const [reporting, setReporting] = useState(false);
  // The dialog is mounted on first use, then kept so that it can animate out.
  const [mounted, setMounted] = useState(false);
  const copyLink = () => copy(window.location.href, t('menu.copied'), t('menu.copyFailed'));
  const copyId = () => copy(guildId, t('menu.idCopied'), t('menu.copyFailed'));

  const report = () =>
    void auth.run(() => {
      setMounted(true);
      setReporting(true);
    });

  return (
    <span className="guild-menu">
      <Dropdown
        align="end"
        label={t('menu.label')}
        items={[
          ...(canReport
            ? [{key: 'report', icon: 'flag', label: t('menu.report'), disabled: !canWrite, onSelect: report}]
            : []),
          {key: 'link', icon: 'link', label: t('menu.copyLink'), onSelect: copyLink},
          {key: 'id', icon: 'badge', label: t('menu.copyId'), onSelect: copyId},
        ]}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button {...aria} ref={ref} aria-label={t('menu.label')} title={t('menu.label')} onclick={onActivate}>
            <md-icon>more_vert</md-icon>
          </md-icon-button>
        )}
      />
      {mounted && (
        <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{type: 'guild', id: guildId}} />
      )}
    </span>
  );
}
