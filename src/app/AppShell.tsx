import {useEffect, useMemo, useRef} from 'react';
import {Link, Outlet, useLocation, useMatches, useNavigate, useNavigation, useNavigationType} from 'react-router';
import type {ModdyUser} from '@moddy/design-kit';

import {useSession} from '@/auth/session';
import {kitLabels} from '@/i18n/kitLabels';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {clientNavigation} from '@/lib/clientNav';
import {defaultAvatarUrl} from '@/lib/discord';
import {verificationLabel, verificationOf} from '@/components/verification';
import {Icon} from '@/ui';

import type {RouteHandle} from './handle';
import {isDashboard, isRecruiting, isServers, isStaffArea, isTalent} from './navMatch';
import {paths} from './paths';
import {LanguageMenu} from './LanguageMenu';
import {SuspendedNotice} from './SuspendedNotice';

/** Whether a nav destination covers the current page. */
type Match = (pathname: string) => boolean;

function NavItem({to, icon, label, match}: {to: string; icon: string; label: string; match: Match}) {
  const {pathname} = useLocation();
  return (
    <Link to={to} aria-current={match(pathname) ? 'page' : undefined}>
      <Icon name={icon} />
      <span className="app-nav-label">{label}</span>
    </Link>
  );
}

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
  const {t: tc} = useT('components');
  const language = useLanguage();
  const labels = kitLabels(language);
  const session = useSession();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const navigationType = useNavigationType();
  const {pathname} = useLocation();
  const matches = useMatches();

  const isStaff = session.me?.user.is_staff === true;
  // A page that needs a session shows the suspension screen itself; every other page gets the notice.
  const showSuspendedNotice =
    session.status === 'suspended' && !matches.some((match) => (match.handle as RouteHandle | undefined)?.requiresAuth);

  const me = session.me?.user;
  const user = useMemo<ModdyUser | null>(() => {
    if (!me) return null;
    const verification = verificationOf(me.badges, 'user');
    return {
      handle: me.username,
      name: me.global_name ?? undefined,
      avatar: me.avatar_url ?? defaultAvatarUrl(me.id),
      // The tooltip of the check in the menu: what kind of verification (from the badges, when the API gives them).
      verified: verification ? verificationLabel(verification, 'user', tc) : undefined,
      // The API does not give Moddy Max here.
      max: false,
    };
  }, [me, tc]);

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
      <moddy-app-bar home-href={paths.home()} labels={labels.appBar} onclick={onKitLinkClick}>
        <nav slot="nav" className="app-nav" aria-label={t('nav.label')}>
          <NavItem to={paths.feed()} icon="campaign" label={t('nav.feed')} match={isRecruiting} />
          <NavItem to={paths.people()} icon="person_search" label={t('nav.people')} match={isTalent} />
          <NavItem to={paths.guilds()} icon="groups" label={t('nav.guilds')} match={isServers} />
          {me && <NavItem to={paths.me()} icon="dashboard" label={t('nav.dashboard')} match={isDashboard} />}
          {isStaff && <NavItem to={paths.staff()} icon="shield_person" label={t('nav.staff')} match={isStaffArea} />}
        </nav>
        <LanguageMenu />
        <moddy-theme-menu labels={labels.theme} />
        {user && me ? (
          <moddy-user-menu user={user} labels={labels.userMenu} onsign-out={() => void session.logout()}>
            <UserMenuItem href={paths.user(me.id)} icon="person" label={t('userMenu.profile')} />
            <UserMenuItem href={paths.me()} icon="dashboard" label={t('nav.dashboard')} />
            <UserMenuItem href={paths.myPosts()} icon="campaign" label={t('userMenu.posts')} />
            <UserMenuItem href={paths.myExperiences()} icon="work_history" label={t('userMenu.experiences')} />
          </moddy-user-menu>
        ) : (
          session.status === 'anonymous' && (
            <md-filled-button onclick={() => session.login()}>{t('auth.login')}</md-filled-button>
          )
        )}
      </moddy-app-bar>

      {navigation.state !== 'idle' && (
        <md-linear-progress className="nav-progress" indeterminate aria-label={t('status.loading')} />
      )}

      <main ref={main} className="app-content" id="main-content" tabIndex={-1}>
        {showSuspendedNotice && <SuspendedNotice />}
        <Outlet />
      </main>
    </div>
  );
}

function UserMenuItem({href, icon, label}: {href: string; icon: string; label: string}) {
  return (
    <md-menu-item href={href}>
      <md-icon slot="start">{icon}</md-icon>
      <div slot="headline">{label}</div>
    </md-menu-item>
  );
}
