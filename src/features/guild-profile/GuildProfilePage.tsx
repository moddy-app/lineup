import {useParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {useGuild} from '@/api/queries';
import type {GuildProfile, TeamMember} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {
  BadgeList,
  EmptyState,
  ErrorState,
  GuildIcon,
  isNsfw,
  LanguageList,
  LinkList,
  NsfwGate,
  PostCard,
  ReportButton,
  StaleNotice,
  UserAvatar,
} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatDate, formatMonthYear} from '@/lib/format';
import {safeHttpsUrl} from '@/lib/url';
import {
  AppLayout,
  Card,
  CardActions,
  Chip,
  Chips,
  Icon,
  LinkButton,
  PageLoading,
  Row,
  RowBody,
  Rows,
  Section,
  Stat,
} from '@/ui';

import './guildProfile.css';

export function Component() {
  const {guildId} = useParams();
  const {t} = useT('guildProfile');
  const query = useGuild(guildId);
  const guild = query.data;
  usePageTitle(guild?.name ?? t('notFound.title'));

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
              <LinkButton to={paths.guilds()} variant="filled" icon="groups">
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

  return (
    <NsfwGate nsfw={isNsfw(guild)} backTo={paths.guilds()} headingLevel={1}>
      <GuildView guild={guild} />
    </NsfwGate>
  );
}

function GuildView({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildProfile');
  const {label} = useCatalogLabel();
  useLanguage();
  const name = guild.name ?? t('unknownName');
  const inviteUrl = guild.invite?.valid ? safeHttpsUrl(guild.invite.url) : null;
  const description = guild.description?.trim();

  return (
    <AppLayout
      aside={
        <>
          {guild.can_manage && (
            <Section title={t('manage.title')}>
              <p>{t('manage.body')}</p>
              <CardActions>
                <LinkButton to={paths.guildManage(guild.id)} icon="settings">
                  {t('manage.action')}
                </LinkButton>
              </CardActions>
            </Section>
          )}
          <TeamCard team={guild.team} />
          {!guild.can_manage && (
            <Card>
              <h2>{t('report.title')}</h2>
              <p>{t('report.body')}</p>
              <CardActions>
                <ReportButton target={{type: 'guild', id: guild.id}} />
              </CardActions>
            </Card>
          )}
        </>
      }
    >
      <Card as="section" className="guild-hero">
        <div className="guild-hero-head">
          <GuildIcon id={guild.id} iconUrl={guild.icon_url} size="xl" />
          <div className="guild-hero-title">
            <h1>{name}</h1>
            <BadgeList badges={guild.badges} />
          </div>
        </div>
        <div className="guild-stats">
          {guild.member_count !== null && <Stat value={guild.member_count} label={t('stats.members')} />}
          {guild.presence_count !== null && <Stat value={guild.presence_count} label={t('stats.online')} />}
          {guild.boosts !== null && guild.boosts > 0 && <Stat value={guild.boosts} label={t('stats.boosts')} />}
          <Stat value={formatDate(guild.created_at, 'medium')} label={t('stats.created')} />
        </div>
        {inviteUrl ? (
          <CardActions>
            <LinkButton to={inviteUrl} icon="login">
              {t('join.action')}
            </LinkButton>
          </CardActions>
        ) : (
          <p className="guild-note">
            <Icon name="link_off" filled />
            {t('join.unavailable')}
          </p>
        )}
        {guild.stale && <StaleNotice />}
      </Card>

      {guild.can_manage && !guild.listed && (
        <Card className="guild-notice" role="status">
          <h2>
            <Icon name="visibility_off" filled />
            {t('unlisted.title')}
          </h2>
          <p>{t('unlisted.body')}</p>
        </Card>
      )}

      {guild.can_manage && guild.invite && !guild.invite.valid && (
        <Card className="guild-notice" role="status">
          <h2>
            <Icon name="link_off" filled />
            {t('inviteLost.title')}
          </h2>
          <p>{t('inviteLost.body')}</p>
          <CardActions>
            <LinkButton to={paths.guildManage(guild.id)} variant="outlined" icon="edit">
              {t('inviteLost.action')}
            </LinkButton>
          </CardActions>
        </Card>
      )}

      <Section title={t('about.title')}>
        {description ? <p className="guild-description">{description}</p> : <p>{t('about.none')}</p>}
        {(guild.theme || guild.tags.length > 0) && (
          <Chips aria-label={t('about.topics')}>
            {guild.theme && <Chip icon="category">{label('themes', guild.theme)}</Chip>}
            {guild.tags.map((tag) => (
              <Chip key={tag} mono>
                {tag}
              </Chip>
            ))}
          </Chips>
        )}
        {guild.languages.length > 0 && <LanguageList codes={guild.languages} />}
        {guild.links.length > 0 && <LinkList links={guild.links} />}
      </Section>

      <Section title={guild.posts.length > 0 ? t('posts.title', {count: guild.posts.length}) : t('posts.titleEmpty')}>
        {guild.posts.length === 0 ? (
          <EmptyState compact icon="campaign" title={t('posts.emptyTitle')}>
            {t('posts.emptyBody')}
          </EmptyState>
        ) : (
          <Rows as="ul" aria-label={t('posts.label')}>
            {guild.posts.map((post) => (
              <PostCard key={post.id} post={post} variant="row" />
            ))}
          </Rows>
        )}
      </Section>
    </AppLayout>
  );
}

function TeamCard({team}: {team: TeamMember[]}) {
  const {t} = useT('guildProfile');
  const {label} = useCatalogLabel();
  useLanguage();
  return (
    <Section title={t('team.title')}>
      {team.length === 0 ? (
        <EmptyState compact icon="badge" title={t('team.emptyTitle')}>
          {t('team.emptyBody')}
        </EmptyState>
      ) : (
        <Rows as="ul" aria-label={t('team.label')}>
          {team.map((member) => {
            const position =
              member.position === 'other' && member.position_other
                ? member.position_other
                : label('positions', member.position);
            const display = member.user.display_name ?? member.user.username ?? member.user.id;
            return (
              <Row key={member.user.id} to={paths.user(member.user.id)}>
                <UserAvatar
                  id={member.user.id}
                  src={member.user.avatar_url}
                  decoration={member.user.avatar_decoration}
                />
                <RowBody
                  title={<strong>{display}</strong>}
                  meta={t('team.since', {position, date: formatMonthYear(member.since)})}
                />
              </Row>
            );
          })}
        </Rows>
      )}
    </Section>
  );
}
