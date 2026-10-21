import {useNavigate} from 'react-router';

import {useGuild, useMyGuilds} from '@/api/queries';
import {paths} from '@/app/paths';
import {useSession} from '@/auth/session';
import {GuildIcon} from '@/components/GuildIcon';
import {useT} from '@/i18n/useT';
import {defaultAvatarUrl} from '@/lib/discord';

import {Avatar} from './Avatar';
import {type DashboardContext, ME_CONTEXT, sameContext} from './dashboardContext';
import {Dropdown, type DropdownItem} from './Dropdown';

/**
 * "Who am I managing": you, or one of your claimed servers, then "Add a
 * server". One full-width outlined button and the shared `Dropdown`. While the
 * list of servers loads or if it fails, only you (and the server of the
 * current address, read with `useGuild`) are offered.
 */
export function ContextSwitcher({context}: {context: DashboardContext}) {
  const {t} = useT('components');
  const navigate = useNavigate();
  const {me} = useSession();
  const myGuilds = useMyGuilds();
  const currentGuildId = context.kind === 'guild' ? context.guildId : undefined;
  const currentGuild = useGuild(currentGuildId);

  const user = me?.user;
  const myName = user?.global_name ?? user?.username ?? t('settings.context.me');
  const myAvatar = user ? (user.avatar_url ?? defaultAvatarUrl(user.id)) : undefined;

  const options: Array<{context: DashboardContext; label: string; leading: React.ReactNode}> = [
    {
      context: ME_CONTEXT,
      label: myName,
      leading: myAvatar ? <Avatar src={myAvatar} size="small" /> : undefined,
    },
  ];
  const claimed = (myGuilds.data ?? []).filter((guild) => guild.claimed);
  for (const guild of claimed) {
    options.push({
      context: {kind: 'guild', guildId: guild.id},
      label: guild.name ?? guild.id,
      leading: <GuildIcon id={guild.id} iconUrl={guild.icon_url} size="small" />,
    });
  }
  if (currentGuildId && !claimed.some((guild) => guild.id === currentGuildId)) {
    options.push({
      context: context,
      label: currentGuild.data?.name ?? currentGuildId,
      leading: <GuildIcon id={currentGuildId} iconUrl={currentGuild.data?.icon_url} size="small" />,
    });
  }

  const current = options.find((option) => sameContext(option.context, context)) ?? options[0]!;
  const items: DropdownItem[] = options.map((option) => ({
    key: option.context.kind === 'guild' ? option.context.guildId : 'me',
    label: option.label,
    leading: option.leading,
    selected: sameContext(option.context, context),
    onSelect: () =>
      void navigate(option.context.kind === 'guild' ? paths.guildManage(option.context.guildId) : paths.me()),
  }));
  items.push({
    key: 'add',
    label: t('settings.context.manage'),
    icon: 'groups',
    separated: true,
    onSelect: () => void navigate(paths.myGuilds()),
  });

  return (
    <div className="settings-context">
      <Dropdown
        label={t('settings.context.label')}
        matchTrigger
        header={{icon: 'swap_horiz', label: t('settings.context.label')}}
        items={items}
        trigger={({ref, onActivate, ...aria}) => (
          <md-outlined-button {...aria} ref={ref} trailing-icon onclick={onActivate}>
            <span className="settings-context-current">
              {current.leading}
              <span className="settings-context-name">{current.label}</span>
            </span>
            <md-icon slot="icon">expand_more</md-icon>
          </md-outlined-button>
        )}
      />
    </div>
  );
}
