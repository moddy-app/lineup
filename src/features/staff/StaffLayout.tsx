import {NavLink, Outlet} from 'react-router';

import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useT} from '@/i18n/useT';
import {Icon, Page, Section} from '@/ui';

import './staff.css';

const SECTIONS = [
  {key: 'reviews', to: paths.staffReviews(), icon: 'rate_review'},
  {key: 'reports', to: paths.staffReports(), icon: 'flag'},
  {key: 'badges', to: paths.staffBadges(), icon: 'verified'},
  {key: 'posts', to: paths.staffPosts(), icon: 'visibility_off'},
] as const;

/**
 * The staff console (/staff/*): a header with the four sections as links (the
 * current one is in the URL, and `aria-current`), and the section in the Outlet.
 * The route is guarded by RequireAuth (staff only); each section also handles a
 * 403 on its own reads.
 */
export function Component() {
  const {t} = useT('staff');
  usePageTitle(t('title'));
  return (
    <Page>
      <div className="staff-console">
        <Section level={1} title={t('title')}>
          <p className="staff-intro">{t('header.text')}</p>
          <nav className="staff-nav" aria-label={t('nav.label')}>
            {SECTIONS.map((section) => (
              <NavLink key={section.key} to={section.to}>
                <Icon name={section.icon} />
                {t(`nav.${section.key}`)}
              </NavLink>
            ))}
          </nav>
        </Section>
        <Outlet />
      </div>
    </Page>
  );
}
