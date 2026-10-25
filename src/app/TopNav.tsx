import {useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router';

import {setLanguage} from '@/i18n';
import {kitLabels} from '@/i18n/kitLabels';
import {LANGUAGES} from '@/i18n/languages';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {Dropdown, type DropdownItem, Icon} from '@/ui';

import {LineupLogo} from './LineupLogo';

/** Whether a nav destination covers the current page. */
type Match = (pathname: string) => boolean;

export interface NavDestination {
  key: string;
  to: string;
  icon: string;
  label: string;
  match: Match;
}

/**
 * The logo of the app bar, in the bar's `logo` slot: the whole Lineup logo at
 * every width (the kit's own logo falls back to the mark alone under 600 px).
 * The link is the kit's: same label, client-side navigation (the app bar's
 * click listener), visible focus.
 */
export function AppLogo({href, label}: {href: string; label: string}) {
  return (
    <a slot="logo" className="app-logo" href={href} title={label} aria-label={label}>
      <span className="app-logo-art">
        <LineupLogo />
      </span>
    </a>
  );
}

/** What the narrow menu shows: the destinations, or one of its two submenus. */
type MenuView = 'nav' | 'language' | 'theme';

/**
 * The destinations of the app bar. Two renderings in the same slot, one shown
 * at a time by the stylesheet (`lineup.css`): the kit's `.app-nav` (icon and
 * label) on wide windows, a menu button on narrow ones. On narrow windows the
 * language and theme buttons leave the bar for this menu: two entries that
 * open a submenu in the same popover (the languages, the kit's theme panel).
 */
export function TopNav({destinations}: {destinations: readonly NavDestination[]}) {
  const {t} = useT('common');
  const language = useLanguage();
  const themeLabels = kitLabels(language).theme;
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<MenuView>('nav');

  const back: DropdownItem = {
    key: 'back',
    label: t('actions.back'),
    icon: 'arrow_back',
    keepOpen: true,
    onSelect: () => setView('nav'),
  };
  const items: DropdownItem[] =
    view === 'language'
      ? [
          back,
          ...LANGUAGES.map(({code, name}, index) => ({
            key: code,
            label: name,
            lang: code,
            selected: code === language,
            separated: index === 0,
            onSelect: () => {
              if (code !== language) void setLanguage(code);
            },
          })),
        ]
      : view === 'theme'
        ? [back]
        : [
            ...destinations.map((destination) => ({
              key: destination.key,
              label: destination.label,
              icon: destination.icon,
              selected: destination.match(pathname),
              onSelect: () => void navigate(destination.to),
            })),
            {
              key: 'language',
              label: t('language.label'),
              icon: 'translate',
              separated: true,
              keepOpen: true,
              onSelect: () => setView('language'),
            },
            {key: 'theme', label: themeLabels.title, icon: 'palette', keepOpen: true, onSelect: () => setView('theme')},
          ];
  return (
    <div slot="nav" className="top-nav">
      <nav className="app-nav" aria-label={t('nav.label')}>
        {destinations.map((destination) => (
          <Link
            key={destination.key}
            to={destination.to}
            aria-current={destination.match(pathname) ? 'page' : undefined}
          >
            <Icon name={destination.icon} />
            <span className="app-nav-label">{destination.label}</span>
          </Link>
        ))}
      </nav>
      <Dropdown
        className="top-nav-popover"
        label={view === 'language' ? t('language.label') : view === 'theme' ? themeLabels.title : t('nav.label')}
        items={items}
        bottom={view === 'theme' && <moddy-theme-panel className="top-nav-theme" labels={themeLabels} />}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button
            ref={ref}
            className="top-nav-menu"
            aria-label={t('nav.menu')}
            title={t('nav.menu')}
            onclick={() => {
              setView('nav');
              onActivate();
            }}
            {...aria}
          >
            <md-icon>menu</md-icon>
          </md-icon-button>
        )}
      />
    </div>
  );
}
