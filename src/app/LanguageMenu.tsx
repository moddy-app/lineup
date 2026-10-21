import type {MdIconButton} from '@material/web/iconbutton/icon-button.js';
import type {MdMenu} from '@material/web/menu/menu.js';
import {useLayoutEffect, useRef, useState} from 'react';

import {setLanguage} from '@/i18n';
import {LANGUAGES, type Language} from '@/i18n/languages';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';

/**
 * The language selector of the app bar: an icon button that opens a menu of
 * the five languages, each in its own name, the current one with a check.
 */
export function LanguageMenu() {
  const {t} = useT('common');
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const button = useRef<MdIconButton>(null);
  const menu = useRef<MdMenu>(null);

  useLayoutEffect(() => {
    if (menu.current) menu.current.anchorElement = button.current;
  });

  const choose = (code: Language) => {
    if (code !== language) void setLanguage(code);
  };

  return (
    <span className="language-menu">
      <md-icon-button
        ref={button}
        aria-label={t('language.label')}
        title={t('language.label')}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={() => setOpen((previous) => !previous)}
      >
        <md-icon>translate</md-icon>
      </md-icon-button>
      <md-menu
        ref={menu}
        open={open}
        onclose={() => setOpen(false)}
        className="language-menu-list"
        anchorCorner="end-end"
        menuCorner="start-end"
      >
        {LANGUAGES.map(({code, name}) => (
          <md-menu-item key={code} type="option" selected={code === language} lang={code} onclick={() => choose(code)}>
            <div slot="headline">{name}</div>
            {code === language && (
              <md-icon slot="end" aria-hidden="true">
                check
              </md-icon>
            )}
          </md-menu-item>
        ))}
      </md-menu>
    </span>
  );
}
