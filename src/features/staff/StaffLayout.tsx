import {Link, Outlet, useLocation} from 'react-router';

import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useT} from '@/i18n/useT';
import {CompactNav, Icon, Page, type SettingsNavGroup} from '@/ui';

import './staff.css';

const SECTIONS = [
  {key: 'reviews', to: paths.staffReviews(), icon: 'rate_review'},
  {key: 'reports', to: paths.staffReports(), icon: 'flag'},
  {key: 'badges', to: paths.staffBadges(), icon: 'verified'},
  {key: 'posts', to: paths.staffPosts(), icon: 'visibility_off'},
] as const;

/**
 * The staff console (/staff/*): the four sections in a side navigation (a
 * compact list above the content under 900 px; same classes as "My space"),
 * the section in the Outlet. The route is guarded by RequireAuth (staff only);
 * each section also handles a 403 on its own reads.
 */
export function Component() {
  const {t} = useT('staff');
  const {pathname} = useLocation();
  usePageTitle(t('title'));
  const groups: SettingsNavGroup[] = [
    {
      links: SECTIONS.map((section) => ({
        to: section.to,
        icon: section.icon,
        label: t(`nav.${section.key}`),
        current: pathname === section.to || pathname.startsWith(`${section.to}/`),
      })),
    },
  ];
  return (
    <Page className="settings-page">
      <div className="settings-layout">
        <div className="settings-nav">
          <CompactNav groups={groups} />
          <nav aria-label={t('nav.label')}>
            <ul>
              {SECTIONS.map((section) => (
                <li key={section.key}>
                  <Link
                    to={section.to}
                    aria-current={pathname === section.to || pathname.startsWith(`${section.to}/`) ? 'page' : undefined}
                  >
                    <Icon name={section.icon} />
                    <span className="settings-nav-label">{t(`nav.${section.key}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="settings-main staff-main">
          <header className="settings-head">
            <div className="settings-head-text">
              <h1 className="settings-title">{t('title')}</h1>
              <p className="settings-description">{t('header.text')}</p>
            </div>
          </header>
          <Outlet />
        </div>
      </div>
    </Page>
  );
}
