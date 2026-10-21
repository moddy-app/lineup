import {Outlet, useLocation, useParams} from 'react-router';

import {hasCode} from '@/api/client';
import {useGuild} from '@/api/queries';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {DisplayName, EmptyState, ErrorState} from '@/components';
import {useT} from '@/i18n/useT';
import {LinkButton, PageLoading, SettingsLayout} from '@/ui';

import './guildManage.css';

type Section = 'profile' | 'invite' | 'posts' | 'discord' | 'settings';

function sectionOf(pathname: string, guildId: string): Section {
  const at = (path: string) => pathname.replace(/\/$/, '') === path;
  if (at(paths.guildManageInvite(guildId))) return 'invite';
  if (at(paths.guildManagePosts(guildId))) return 'posts';
  if (at(paths.guildManageDiscord(guildId))) return 'discord';
  if (at(paths.guildManageSettings(guildId))) return 'settings';
  return 'profile';
}

/**
 * Parent of the management pages of a server. Reads the server once, handles
 * loading, not found and refused access, then shows the dashboard layout
 * (title, short description of the page, link to the public profile) around the
 * page (`<Outlet context={guild}>`).
 */
export function Component() {
  const {guildId} = useParams();
  const {pathname} = useLocation();
  const {t} = useT('guildManage');
  const query = useGuild(guildId);
  const guild = query.data;
  usePageTitle(guild?.name ? t('pageTitle', {name: guild.name}) : t('title'));

  if (query.isPending) return <PageLoading />;

  if (query.isError || !guild) {
    return (
      <SettingsLayout title={t('title')}>
        {hasCode(query.error, 'lineup_guild_not_found') ? (
          <EmptyState
            icon="search_off"
            shape="octagon"
            tone="tertiary"
            title={t('notFound.title')}
            action={
              <LinkButton to={paths.feed()} icon="rocket_launch">
                {t('notFound.action')}
              </LinkButton>
            }
          >
            {t('notFound.body')}
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        )}
      </SettingsLayout>
    );
  }

  if (!guild.can_manage) {
    return (
      <SettingsLayout title={t('title')}>
        <EmptyState
          icon="lock"
          shape="pentagon"
          tone="tertiary"
          title={t('forbidden.title')}
          action={
            <LinkButton to={paths.guild(guild.id)} icon="groups">
              {t('forbidden.action')}
            </LinkButton>
          }
        >
          {t('forbidden.body')}
        </EmptyState>
      </SettingsLayout>
    );
  }

  const section = sectionOf(pathname, guild.id);
  return (
    <SettingsLayout
      className="manage-page"
      title={<DisplayName name={guild.name ?? t('unknownName')} badges={guild.badges} entity="guild" />}
      description={t(`pages.${section}`)}
      actions={
        <>
          <LinkButton to={paths.guild(guild.id)} variant="outlined" icon="visibility">
            {t('viewProfile')}
          </LinkButton>
          {section === 'posts' && (
            <LinkButton to={paths.postNew({guildId: guild.id})} icon="add">
              {t('newPost')}
            </LinkButton>
          )}
        </>
      }
    >
      <Outlet key={guild.id} context={guild} />
    </SettingsLayout>
  );
}
