import {useEffect, useMemo, useRef} from 'react';
import {Outlet, useLocation, useMatches, useNavigate, useNavigationType} from 'react-router';

import {useSession} from '@/auth/session';
import {kitLabels} from '@/i18n/kitLabels';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {clientNavigation} from '@/lib/clientNav';

import type {RouteHandle} from './handle';
import {isDashboard, isRecruiting, isStaffArea, isTalent} from './navMatch';
import {paths} from './paths';
import {LanguageMenu} from './LanguageMenu';
import {SuspendedNotice} from './SuspendedNotice';
import {TopProgress} from './TopProgress';
import {UserMenu} from './UserMenu';
import {AppLogo, type NavDestination, TopNav} from './TopNav';

/**
 * The frame of every page: app bar and content (no footer: the language
 * selector is in the bar).
 *
 *  - The kit's components get their labels in the current language.
 *  - The app bar's own links (logo, menu items) are shadow-DOM anchors: one
 *    click listener turns them into client-side navigations.
 *  - On a new page, focus moves to the content and the window scrolls to the
 *    top. A change of query string alone (the feed's filters) does neither.
 */
export function AppShell() {
  const {t} = useT('common');
  const language = useLanguage();
  const labels = kitLabels(language);
  const session = useSession();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const {pathname} = useLocation();
  const matches = useMatches();

  const isStaff = session.me?.user.is_staff === true;
  // A page that needs a session shows the suspension screen itself; every other page gets the notice.
  const showSuspendedNotice =
    session.status === 'suspended' && !matches.some((match) => (match.handle as RouteHandle | undefined)?.requiresAuth);

  const me = session.me?.user;
  const destinations = useMemo<NavDestination[]>(
    () => [
      {key: 'feed', to: paths.feed(), icon: 'rocket_launch', label: t('nav.feed'), match: isRecruiting},
      {key: 'people', to: paths.people(), icon: 'badge', label: t('nav.people'), match: isTalent},
      ...(me
        ? [{key: 'dashboard', to: paths.me(), icon: 'dashboard', label: t('nav.dashboard'), match: isDashboard}]
        : []),
      ...(isStaff
        ? [{key: 'staff', to: paths.staff(), icon: 'shield_person', label: t('nav.staff'), match: isStaffArea}]
        : []),
    ],
    [me, isStaff, t],
  );

  const onKitLinkClick = useMemo(() => clientNavigation(navigate), [navigate]);

  const main = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);
  useEffect(() => {
    // Only a new path counts, not a query string (the feed's filters) or a hash.
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    // Back/forward: the browser restores the scroll position.
    if (navigationType !== 'POP') window.scrollTo(0, 0);
    main.current?.focus({preventScroll: true});
  }, [pathname, navigationType]);

  return (
    <div className="app">
      <TopProgress />
      <moddy-app-bar home-href={paths.home()} labels={labels.appBar} onclick={onKitLinkClick}>
        <AppLogo href={paths.home()} label={labels.appBar.home} />
        <TopNav destinations={destinations} />
        <LanguageMenu />
        <moddy-theme-menu labels={labels.theme} />
        {me ? (
          <UserMenu user={me} onSignOut={() => void session.logout()} />
        ) : (
          session.status === 'anonymous' && (
            <md-filled-button onclick={() => session.login()}>{t('auth.login')}</md-filled-button>
          )
        )}
      </moddy-app-bar>

      <main ref={main} className="app-content" id="main-content" tabIndex={-1}>
        {showSuspendedNotice && <SuspendedNotice />}
        <Outlet />
      </main>
    </div>
  );
}
