import {useParams} from 'react-router';

import {hasCode} from '@/api/client';
import {useGuild} from '@/api/queries';
import type {GuildProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {EmptyState, ErrorState, GuildIcon} from '@/components';
import {useT} from '@/i18n/useT';
import {AppLayout, Card, LinkButton, PageLoading, Status} from '@/ui';

import {DangerZone} from './DangerZone';
import {GuildPosts} from './GuildPosts';
import {ProfileEditor} from './ProfileEditor';
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
      <AppLayout>
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
      </AppLayout>
    );
  }

  if (!guild.can_manage) {
    return (
      <AppLayout>
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
      </AppLayout>
    );
  }

  return <ManageView key={guild.id} guild={guild} />;
}

function ManageView({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const name = guild.name ?? t('unknownName');
  return (
    <AppLayout
      stickyAside
      aside={
        <>
          <SnapshotCard guild={guild} />
          <DangerZone guild={guild} />
        </>
      }
    >
      <Card as="section" className="manage-head">
        <GuildIcon id={guild.id} iconUrl={guild.icon_url} size="large" />
        <div className="manage-head-text">
          <h1>{t('heading', {name})}</h1>
          <p>
            <Status variant={guild.listed ? 'accent' : 'default'}>
              {guild.listed ? t('status.listed') : t('status.unlisted')}
            </Status>
          </p>
        </div>
        <LinkButton to={paths.guild(guild.id)} variant="outlined" icon="visibility">
          {t('viewProfile')}
        </LinkButton>
      </Card>
      <ProfileEditor guild={guild} />
      <GuildPosts guild={guild} />
    </AppLayout>
  );
}
