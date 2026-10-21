import {useNavigate} from 'react-router';

import {DisplayName, UserAvatar} from '@/components';
import {avatarDecorationFromData} from '@/lib/discord';
import {kitLabels} from '@/i18n/kitLabels';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {useAccountEmail} from '@/api/queries';
import type {MeUser} from '@/api/types';
import {Dropdown} from '@/ui';

import {paths} from './paths';

/**
 * The account menu of the app bar. The kit's `moddy-user-menu` draws the
 * avatar in its shadow DOM, without Discord's decoration, and writes the
 * display name: this one keeps its look (32px round button, a card with the
 * person on top, the entries, "Sign out") with `UserAvatar`, the @username
 * and the e-mail (`GET /auth/me`) when the API gives one.
 */
export function UserMenu({user, onSignOut}: {user: MeUser; onSignOut: () => void}) {
  const {t} = useT('common');
  const labels = kitLabels(useLanguage()).userMenu;
  const email = useAccountEmail();
  const navigate = useNavigate();
  const go = (to: string) => () => void navigate(to);

  const card = (
    <div className="user-menu-card">
      <UserAvatar
        id={user.id}
        src={user.avatar_url}
        decoration={avatarDecorationFromData(user.avatar_decoration_data)}
        className="user-menu-avatar"
      />
      <div className="user-menu-text">
        <DisplayName name={`@${user.username}`} badges={user.badges} entity="user" className="user-menu-name" />
        {email && <span className="user-menu-email">{email}</span>}
      </div>
    </div>
  );

  return (
    <Dropdown
      align="end"
      wide
      label={labels.userMenu}
      className="user-menu-popover"
      top={card}
      items={[
        {key: 'profile', icon: 'person', label: t('userMenu.profile'), onSelect: go(paths.user(user.id))},
        {key: 'dashboard', icon: 'dashboard', label: t('nav.dashboard'), onSelect: go(paths.me())},
        {key: 'posts', icon: 'campaign', label: t('userMenu.posts'), onSelect: go(paths.myPosts())},
        {
          key: 'experiences',
          icon: 'work_history',
          label: t('userMenu.experiences'),
          onSelect: go(paths.myExperiences()),
        },
        {
          key: 'sign-out',
          icon: 'logout',
          label: labels.signOut,
          destructive: true,
          separated: true,
          onSelect: onSignOut,
        },
      ]}
      trigger={({ref, onActivate, ...aria}) => (
        <md-icon-button
          ref={ref}
          className="user-menu-button"
          aria-label={labels.userMenu}
          title={`@${user.username}`}
          onclick={onActivate}
          {...aria}
        >
          <UserAvatar
            id={user.id}
            src={user.avatar_url}
            decoration={avatarDecorationFromData(user.avatar_decoration_data)}
            size="small"
          />
        </md-icon-button>
      )}
    />
  );
}
