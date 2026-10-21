import type {MdIconButton} from '@material/web/iconbutton/icon-button.js';
import type {MdMenu} from '@material/web/menu/menu.js';
import {useLayoutEffect, useRef, useState} from 'react';

import {ReportDialog, useCopyText} from '@/components';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';

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
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  // The dialog is mounted on first use, then kept so that it can animate out.
  const [mounted, setMounted] = useState(false);
  const button = useRef<MdIconButton>(null);
  const menu = useRef<MdMenu>(null);

  useLayoutEffect(() => {
    if (menu.current) menu.current.anchorElement = button.current;
  });

  const copyLink = () => copy(window.location.href, t('menu.copied'), t('menu.copyFailed'));
  const copyId = () => copy(guildId, t('menu.idCopied'), t('menu.copyFailed'));

  const report = () =>
    void auth.run(() => {
      setMounted(true);
      setReporting(true);
    });

  return (
    <span className="guild-menu">
      <md-icon-button
        ref={button}
        aria-label={t('menu.label')}
        title={t('menu.label')}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={() => setOpen((previous) => !previous)}
      >
        <md-icon>more_vert</md-icon>
      </md-icon-button>
      <md-menu ref={menu} open={open} onclose={() => setOpen(false)} anchorCorner="end-end" menuCorner="start-end">
        {canReport && (
          <md-menu-item disabled={!canWrite} onclick={report}>
            <md-icon slot="start">flag</md-icon>
            <div slot="headline">{t('menu.report')}</div>
          </md-menu-item>
        )}
        <md-menu-item onclick={copyLink}>
          <md-icon slot="start">link</md-icon>
          <div slot="headline">{t('menu.copyLink')}</div>
        </md-menu-item>
        <md-menu-item onclick={copyId}>
          <md-icon slot="start">badge</md-icon>
          <div slot="headline">{t('menu.copyId')}</div>
        </md-menu-item>
      </md-menu>
      {mounted && (
        <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{type: 'guild', id: guildId}} />
      )}
    </span>
  );
}
