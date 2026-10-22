import {Link, useLocation, useNavigate} from 'react-router';

import {useT} from '@/i18n/useT';
import {Dropdown, Icon} from '@/ui';

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

/**
 * The destinations of the app bar. Two renderings in the same slot, one shown
 * at a time by the stylesheet (`lineup.css`): the kit's `.app-nav` (icon and
 * label) on wide windows, a menu button on narrow ones.
 */
export function TopNav({destinations}: {destinations: readonly NavDestination[]}) {
  const {t} = useT('common');
  const {pathname} = useLocation();
  const navigate = useNavigate();
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
        label={t('nav.label')}
        items={destinations.map((destination) => ({
          key: destination.key,
          label: destination.label,
          icon: destination.icon,
          selected: destination.match(pathname),
          onSelect: () => void navigate(destination.to),
        }))}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button
            ref={ref}
            className="top-nav-menu"
            aria-label={t('nav.menu')}
            title={t('nav.menu')}
            onclick={onActivate}
            {...aria}
          >
            <md-icon>menu</md-icon>
          </md-icon-button>
        )}
      />
    </div>
  );
}
