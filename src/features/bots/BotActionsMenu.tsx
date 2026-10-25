import {useState} from 'react';

import {ReportDialog, useCopyText} from '@/components';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Dropdown} from '@/ui';

/** The "more" menu of a bot profile: report it (not its managers), copy its link or its id. */
export function BotActionsMenu({botId, canReport}: {botId: string; canReport: boolean}) {
  const {t} = useT('bots');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const copy = useCopyText();
  const [reporting, setReporting] = useState(false);
  // The dialog is mounted on first use, then kept so that it can animate out.
  const [mounted, setMounted] = useState(false);

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
          {
            key: 'link',
            icon: 'link',
            label: t('menu.copyLink'),
            onSelect: () => copy(window.location.href, t('menu.copied'), t('menu.copyFailed')),
          },
          {
            key: 'id',
            icon: 'badge',
            label: t('menu.copyId'),
            onSelect: () => copy(botId, t('menu.idCopied'), t('menu.copyFailed')),
          },
        ]}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button {...aria} ref={ref} aria-label={t('menu.label')} title={t('menu.label')} onclick={onActivate}>
            <md-icon>more_vert</md-icon>
          </md-icon-button>
        )}
      />
      {mounted && (
        <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{type: 'bot', id: botId}} />
      )}
    </span>
  );
}
