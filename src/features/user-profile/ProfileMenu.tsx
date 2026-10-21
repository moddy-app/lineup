/** The "more actions" menu of a profile: copy the id, copy the link, and report (not on your own profile). Signed-out visitors are sent to sign in first. */

import type {MdIconButton} from '@material/web/iconbutton/icon-button.js';
import type {MdMenu} from '@material/web/menu/menu.js';
import {useLayoutEffect, useRef, useState} from 'react';

import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {ReportDialog, useCopyText} from '@/components';
import {useT} from '@/i18n/useT';

export function ProfileMenu({userId, isSelf}: {userId: string; isSelf?: boolean}) {
  const {t} = useT('userProfile');
  const {t: tComponents} = useT('components');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const copy = useCopyText();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The dialog is mounted on first use, then kept so that it can animate out.
  const [mounted, setMounted] = useState(false);
  const button = useRef<MdIconButton>(null);
  const menu = useRef<MdMenu>(null);

  useLayoutEffect(() => {
    if (menu.current) menu.current.anchorElement = button.current;
  });

  return (
    <span className="profile-menu">
      <md-icon-button
        ref={button}
        aria-label={t('header.more')}
        title={t('header.more')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={() => setMenuOpen((previous) => !previous)}
      >
        <md-icon>more_vert</md-icon>
      </md-icon-button>
      <md-menu
        ref={menu}
        open={menuOpen}
        onclose={() => setMenuOpen(false)}
        anchorCorner="end-end"
        menuCorner="start-end"
      >
        <md-menu-item onclick={() => copy(userId, t('menu.idCopied'), t('menu.copyFailed'))}>
          <md-icon slot="start" aria-hidden="true">
            badge
          </md-icon>
          <div slot="headline">{t('menu.copyId')}</div>
        </md-menu-item>
        <md-menu-item onclick={() => copy(window.location.href, t('menu.linkCopied'), t('menu.copyFailed'))}>
          <md-icon slot="start" aria-hidden="true">
            link
          </md-icon>
          <div slot="headline">{t('menu.copyLink')}</div>
        </md-menu-item>
        {!isSelf && (
          <md-menu-item
            disabled={!canWrite}
            onclick={() =>
              void auth.run(() => {
                setMounted(true);
                setDialogOpen(true);
              })
            }
          >
            <md-icon slot="start" aria-hidden="true">
              flag
            </md-icon>
            <div slot="headline">{tComponents('report.button')}</div>
          </md-menu-item>
        )}
      </md-menu>
      {mounted && (
        <ReportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} target={{type: 'user', id: userId}} />
      )}
    </span>
  );
}
