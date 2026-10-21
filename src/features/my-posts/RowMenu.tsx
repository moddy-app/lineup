import type {MdIconButton} from '@material/web/iconbutton/icon-button.js';
import type {MdMenu} from '@material/web/menu/menu.js';
import {type ReactNode, useLayoutEffect, useRef, useState} from 'react';

import {useT} from '@/i18n/useT';

export interface RowMenuItem {
  key: string;
  icon: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** The "more" button of a row and its menu. */
export function RowMenu({label, items}: {label: string; items: RowMenuItem[]}): ReactNode {
  const {t} = useT('myPosts');
  const [open, setOpen] = useState(false);
  const button = useRef<MdIconButton>(null);
  const menu = useRef<MdMenu>(null);

  useLayoutEffect(() => {
    if (menu.current) menu.current.anchorElement = button.current;
  });

  if (items.length === 0) return null;
  return (
    <span className="mp-menu">
      <md-icon-button
        ref={button}
        aria-label={t('row.more', {title: label})}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={() => setOpen((previous) => !previous)}
      >
        <md-icon>more_vert</md-icon>
      </md-icon-button>
      <md-menu
        ref={menu}
        positioning="fixed"
        open={open}
        onclose={() => setOpen(false)}
        anchorCorner="end-end"
        menuCorner="start-end"
      >
        {items.map((item) => (
          <md-menu-item
            key={item.key}
            className={item.danger ? 'mp-menu-danger' : undefined}
            disabled={item.disabled}
            onclick={item.onSelect}
          >
            <md-icon slot="start" aria-hidden="true">
              {item.icon}
            </md-icon>
            <div slot="headline">{item.label}</div>
          </md-menu-item>
        ))}
      </md-menu>
    </span>
  );
}
