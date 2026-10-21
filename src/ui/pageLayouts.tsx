import type {MdMenu} from '@material/web/menu/menu.js';
import {Fragment, type HTMLAttributes, type ReactNode, useId, useLayoutEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router';

import {useMyGuilds} from '@/api/queries';
import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';

import {Card} from './Card';
import {Icon} from './Icon';
import {Page} from './layout';

/**
 * The two page families of the redesign (docs/ui-redesign.md):
 *
 *  - showcase (public, read-only): `ShowcasePage` + `PageHeader`, content
 *    directly on the page background;
 *  - management (private, settings): `SettingsLayout`, a side navigation
 *    ("Mon espace") and form panels (`SettingsPanel`).
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
// Management pages
// ---------------------------------------------------------------------------

/** `/posts/new` and `/posts/:id/edit` belong to the posts of "My space". */
const EDITOR_PATH = /^\/posts\/[^/]+\/edit\/?$/;

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export interface SettingsLink {
  to: string;
  icon: string;
  label: string;
  current: boolean;
}

export interface SettingsNavGroup {
  /** Name of the group ("My space", "Managed servers"); also names the `nav`. */
  title?: string;
  links: SettingsLink[];
}

/**
 * Under 900 px (CSS): one full-width button showing where you are ("My space ·
 * Servers"), opening a menu with the same entries as the side navigation,
 * a divider between groups. Hidden above 900 px.
 */
export function CompactNav({groups}: {groups: SettingsNavGroup[]}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuRef = useRef<MdMenu | null>(null);
  useLayoutEffect(() => {
    if (menuRef.current) menuRef.current.anchorElement = anchor;
  }, [anchor]);

  const currentGroup = groups.find((group) => group.links.some((link) => link.current));
  const current = currentGroup?.links.find((link) => link.current);
  const label = [currentGroup?.title, current?.label].filter(Boolean).join(' · ');

  return (
    <div className="settings-compact-nav">
      <md-outlined-button
        ref={setAnchor}
        trailing-icon
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={() => setOpen((previous) => !previous)}
      >
        {current && <Icon name={current.icon} />}
        <span className="settings-compact-label">{label}</span>
        <md-icon slot="icon">expand_more</md-icon>
      </md-outlined-button>
      <md-menu ref={menuRef} open={open} onclose={() => setOpen(false)} className="settings-compact-menu">
        {groups.map((group, index) => (
          <Fragment key={group.title ?? index}>
            {index > 0 && <md-divider />}
            {group.links.map((link) => (
              <md-menu-item key={link.to} selected={link.current} onclick={() => navigate(link.to)}>
                <md-icon slot="start">{link.icon}</md-icon>
                <div slot="headline">{link.label}</div>
              </md-menu-item>
            ))}
          </Fragment>
        ))}
      </md-menu>
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

/**
 * The side navigation of "My space": the four pages, then the servers you
 * manage. The servers come from `useMyGuilds`; while they load, or if the
 * request fails or asks for a new sign-in, the list is simply left out.
 */
function SettingsNav() {
  const {t} = useT('components');
  const {pathname} = useLocation();
  const myGuilds = useMyGuilds();
  const managed = (myGuilds.data ?? []).filter((guild) => guild.claimed);

  const links: SettingsLink[] = [
    {
      to: paths.me(),
      icon: 'person',
      label: t('settings.nav.profile'),
      current: pathname.replace(/\/$/, '') === paths.me(),
    },
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
      current: under(pathname, paths.myPosts()) || under(pathname, paths.postNew()) || EDITOR_PATH.test(pathname),
    },
    {
      to: paths.myGuilds(),
      icon: 'groups',
      label: t('settings.nav.guilds'),
      current: under(pathname, paths.myGuilds()),
    },
  ];

  const groups: SettingsNavGroup[] = [{title: t('settings.title'), links}];
  if (managed.length > 0) {
    groups.push({
      title: t('settings.managed'),
      links: managed.map((guild) => ({
        to: paths.guildManage(guild.id),
        icon: 'settings',
        label: guild.name ?? guild.id,
        current: under(pathname, paths.guildManage(guild.id)),
      })),
    });
  }

  return (
    <div className="settings-nav">
      <CompactNav groups={groups} />
      <nav aria-labelledby="settings-nav-title">
        <p className="settings-nav-title" id="settings-nav-title">
          {t('settings.title')}
        </p>
        <ul>
          {links.map((link) => (
            <li key={link.to}>
              <SettingsNavLink {...link} />
            </li>
          ))}
        </ul>
      </nav>
      {managed.length > 0 && (
        <nav aria-labelledby="settings-managed-title">
          <p className="settings-nav-title" id="settings-managed-title">
            {t('settings.managed')}
          </p>
          <ul>
            {managed.map((guild) => (
              <li key={guild.id}>
                <SettingsNavLink
                  to={paths.guildManage(guild.id)}
                  icon="settings"
                  label={guild.name ?? guild.id}
                  current={under(pathname, paths.guildManage(guild.id))}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
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
}

/**
 * A management page: the "My space" navigation on the left (a compact list
 * above the content under 900 px), then the page's title and its content,
 * usually `SettingsPanel`s.
 */
export function SettingsLayout({title, description, actions, children, className}: SettingsLayoutProps) {
  return (
    <Page className={cx('settings-page', className)}>
      <div className="settings-layout">
        <SettingsNav />
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
