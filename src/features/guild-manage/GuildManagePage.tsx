import {useParams} from 'react-router';

import {hasCode} from '@/api/client';
import {useGuild} from '@/api/queries';
import type {GuildProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {DisplayName, EmptyState, ErrorState} from '@/components';
import {useT} from '@/i18n/useT';
import {LinkButton, PageLoading, SettingsLayout} from '@/ui';

import {DangerZone} from './DangerZone';
import {GuildPosts} from './GuildPosts';
import {ProfileEditor} from './ProfileEditor';
import {SectionNav} from './SectionNav';
import {SnapshotCard} from './SnapshotCard';
import './guildManage.css';

export function Component() {
  const {guildId} = useParams();
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
              <LinkButton to={paths.guilds()} icon="groups">
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

  return <ManageView key={guild.id} guild={guild} />;
}

function ManageView({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const name = guild.name ?? t('unknownName');
  return (
    <SettingsLayout
      className="manage-page"
      title={<DisplayName name={name} badges={guild.badges} entity="guild" />}
      description={t('pageDescription')}
      actions={
        <LinkButton to={paths.guild(guild.id)} variant="outlined" icon="visibility">
          {t('viewProfile')}
        </LinkButton>
      }
    >
      <SectionNav />
      <ProfileEditor guild={guild} />
      <GuildPosts guild={guild} />
      <SnapshotCard guild={guild} />
      <DangerZone guild={guild} />
    </SettingsLayout>
  );
}
