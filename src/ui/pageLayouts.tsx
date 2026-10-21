import {type HTMLAttributes, type ReactNode, useId} from 'react';
import {Link, useLocation, useNavigate} from 'react-router';

import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';

import {Card} from './Card';
import {ContextSwitcher} from './ContextSwitcher';
import {type DashboardContext, dashboardContext} from './dashboardContext';
import {Dropdown} from './Dropdown';
import {Icon} from './Icon';
import {Page} from './layout';

/**
 * The two page families of the redesign (docs/ui-redesign.md):
 *
 *  - showcase (public, read-only): `ShowcasePage` + `PageHeader`, content
 *    directly on the page background;
 *  - management (private, settings): `SettingsLayout`, a side navigation
 *    (context selector and pages) and form panels (`SettingsPanel`).
 */

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {className?: string};

/**
 * A showcase page: the kit's `Page` (centered, `--content-width`), without a
 * bento grid. Children sit on the page background: a `PageHeader`, then
 * sections, lists and dividers. Cards are only for objects you can point at.
 */
export function ShowcasePage({className, ...props}: DivProps) {
  return <Page {...props} className={cx('showcase-page', className)} />;
}

interface PageHeaderProps {
  /** The page's one big text: the name of a server or of a person, the page title. A `DisplayName` fits here. */
  title: ReactNode;
  /** One short line under the title. */
  subtitle?: ReactNode;
  /** The main action and its neighbors (three buttons at most, one filled), at the right. */
  actions?: ReactNode;
  /** An avatar or an icon shape, before the title. */
  leading?: ReactNode;
  /** A line of metadata under the subtitle (`InlineStats`, pills). */
  meta?: ReactNode;
  className?: string;
}

/** The head of a showcase page: [leading] title / subtitle / meta, actions on the right. The one `h1` of the page. */
export function PageHeader({title, subtitle, actions, leading, meta, className}: PageHeaderProps) {
  return (
    <header className={cx('page-header', className)}>
      {leading && <div className="page-header-leading">{leading}</div>}
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        {meta && <div className="page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Management pages (the dashboard)
// ---------------------------------------------------------------------------

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
const same = (pathname: string, path: string) => pathname.replace(/\/$/, '') === path;
/** `/posts/new` and `/posts/:id/edit` belong to the posts of the dashboard. */
const EDITOR_PATH = /^\/posts\/(?:new|[^/]+\/edit)\/?$/;

export interface SettingsLink {
  to: string;
  icon: string;
  label: string;
  current: boolean;
}

export interface SettingsNavGroup {
  /** Name of the group; also names the `nav`. */
  title?: string;
  links: SettingsLink[];
}

/**
 * Under 900 px (CSS): one full-width button showing where you are, opening a
 * popover (`Dropdown`) with the same entries as the side navigation. Hidden
 * above 900 px.
 */
export function CompactNav({groups, placeholder}: {groups: SettingsNavGroup[]; placeholder?: string}) {
  const navigate = useNavigate();
  const currentGroup = groups.find((group) => group.links.some((link) => link.current));
  const current = currentGroup?.links.find((link) => link.current);
  const label = [currentGroup?.title, current?.label].filter(Boolean).join(' · ') || (placeholder ?? '');

  return (
    <div className="settings-compact-nav">
      <Dropdown
        label={label}
        matchTrigger
        items={groups.flatMap((group, groupIndex) =>
          group.links.map((link, index) => ({
            key: link.to,
            label: link.label,
            icon: link.icon,
            selected: link.current,
            separated: groupIndex > 0 && index === 0,
            onSelect: () => void navigate(link.to),
          })),
        )}
        trigger={({ref, onActivate, ...aria}) => (
          <md-outlined-button {...aria} ref={ref} trailing-icon onclick={onActivate}>
            {current && <Icon name={current.icon} />}
            <span className="settings-compact-label">{label}</span>
            <md-icon slot="icon">expand_more</md-icon>
          </md-outlined-button>
        )}
      />
    </div>
  );
}

function SettingsNavLink({to, icon, label, current}: SettingsLink) {
  return (
    <Link to={to} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} />
      <span className="settings-nav-label">{label}</span>
    </Link>
  );
}

/** The entries of a context: the person's four pages, or a server's five. */
function useContextLinks(context: DashboardContext): SettingsLink[] {
  const {t} = useT('components');
  const {pathname} = useLocation();
  if (context.kind === 'guild') {
    const id = context.guildId;
    return [
      {
        to: paths.guildManage(id),
        icon: 'badge',
        label: t('settings.guildNav.profile'),
        current: same(pathname, paths.guildManage(id)),
      },
      {
        to: paths.guildManageInvite(id),
        icon: 'link',
        label: t('settings.guildNav.invite'),
        current: under(pathname, paths.guildManageInvite(id)),
      },
      {
        to: paths.guildManagePosts(id),
        icon: 'campaign',
        label: t('settings.guildNav.posts'),
        current: under(pathname, paths.guildManagePosts(id)) || EDITOR_PATH.test(pathname),
      },
      {
        to: paths.guildManageDiscord(id),
        icon: 'sync',
        label: t('settings.guildNav.discord'),
        current: under(pathname, paths.guildManageDiscord(id)),
      },
      {
        to: paths.guildManageSettings(id),
        icon: 'settings',
        label: t('settings.guildNav.settings'),
        current: under(pathname, paths.guildManageSettings(id)),
      },
    ];
  }
  return [
    {to: paths.me(), icon: 'person', label: t('settings.nav.profile'), current: same(pathname, paths.me())},
    {
      to: paths.myExperiences(),
      icon: 'work_history',
      label: t('settings.nav.experiences'),
      current: under(pathname, paths.myExperiences()),
    },
    {
      to: paths.myPosts(),
      icon: 'campaign',
      label: t('settings.nav.posts'),
      current: under(pathname, paths.myPosts()) || EDITOR_PATH.test(pathname),
    },
  ];
}

/**
 * The side navigation of the dashboard: the context selector (you, or one of
 * the servers you manage), then the pages of that context. Under 900 px the
 * pages become a `CompactNav` under the selector.
 */
function SettingsNav({context}: {context: DashboardContext}) {
  const {t} = useT('components');
  const links = useContextLinks(context);

  return (
    <div className="settings-nav">
      <ContextSwitcher context={context} />
      <CompactNav groups={[{links}]} placeholder={t('settings.context.manage')} />
      <nav aria-label={t('settings.navLabel')}>
        <ul>
          {links.map((link) => (
            <li key={link.to}>
              <SettingsNavLink {...link} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

interface SettingsLayoutProps {
  /** Reminds where you are: the name of the page. The one `h1`. */
  title: ReactNode;
  description?: ReactNode;
  /** Buttons at the right of the title. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Whose dashboard this is. By default deduced from the address
   * (`dashboardContext`); a page that knows better (the editor of a server's
   * post) says so.
   */
  context?: DashboardContext;
}

/**
 * A management page: the context selector and the navigation on the left (a
 * selector and a compact list above the content under 900 px), then the
 * page's title and its content, usually `SettingsPanel`s.
 */
export function SettingsLayout({title, description, actions, children, className, context}: SettingsLayoutProps) {
  const {pathname, search} = useLocation();
  const current = context ?? dashboardContext(pathname, search);
  return (
    <Page className={cx('settings-page', className)}>
      <div className="settings-layout">
        <SettingsNav context={current} />
        <div className="settings-main">
          <header className="settings-head">
            <div className="settings-head-text">
              <h1 className="settings-title">{title}</h1>
              {description && <p className="settings-description">{description}</p>}
            </div>
            {actions && <div className="settings-head-actions">{actions}</div>}
          </header>
          {children}
        </div>
      </div>
    </Page>
  );
}

interface SettingsPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'title'> {
  title: ReactNode;
  /** One or two short sentences. */
  description?: ReactNode;
  /** Buttons at the bottom right (one `md-filled-button` at most). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** A form panel: a card (edge caps) with a title, a short description, the fields, and the actions at the bottom right. */
export function SettingsPanel({title, description, actions, children, className, ...props}: SettingsPanelProps) {
  const titleId = useId();
  return (
    <Card {...props} aria-labelledby={titleId} className={cx('settings-panel', className)}>
      <h2 id={titleId}>{title}</h2>
      {description && <p className="settings-panel-description">{description}</p>}
      {children && <div className="settings-panel-body">{children}</div>}
      {actions && <div className="settings-panel-actions">{actions}</div>}
    </Card>
  );
}
