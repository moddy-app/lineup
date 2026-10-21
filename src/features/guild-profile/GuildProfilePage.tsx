import {Link, useParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {useGuild} from '@/api/queries';
import type {GuildProfile, TeamMember} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {
  BadgeStrip,
  DisplayName,
  EmptyState,
  Fact,
  FactList,
  ErrorState,
  GuildIcon,
  isNsfw,
  LinkList,
  LanguageFlags,
  Markdown,
  NsfwGate,
  PostCard,
  StaleNotice,
  TagLabel,
  useNsfwConfirmed,
  UserAvatar,
} from '@/components';
import {safeLinks} from '@/components/links';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatMonthYear, formatNumber} from '@/lib/format';
import {safeHttpsUrl} from '@/lib/url';
import {Card, Icon, LinkButton, Page, PageHeader, InnerCard, InnerCards, PageLoading, ShowcasePage} from '@/ui';

import {GuildActionsMenu} from './GuildActionsMenu';
import './guildProfile.css';

export function Component() {
  const {guildId} = useParams();
  const {t} = useT('guildProfile');
  const query = useGuild(guildId);
  const guild = query.data;
  const {confirmed} = useNsfwConfirmed();
  usePageTitle(guild?.name ?? t('notFound.title'));

  if (query.isPending) return <PageLoading />;

  if (query.isError || !guild) {
    return (
      <ShowcasePage>
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
      </ShowcasePage>
    );
  }

  // The age screen sits in the page column; once confirmed, the profile takes its place.
  if (isNsfw(guild) && !confirmed) {
    return (
      <Page>
        <NsfwGate nsfw backTo={paths.guilds()} headingLevel={1}>
          {null}
        </NsfwGate>
      </Page>
    );
  }
  return <GuildView guild={guild} />;
}

function GuildView({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildProfile');
  useLanguage();
  const name = guild.name ?? t('unknownName');
  // No "Join" without a usable invitation: lost (`valid` false) or never created (`url` null).
  const inviteUrl = guild.invite?.valid ? safeHttpsUrl(guild.invite.url) : null;
  const banner = safeHttpsUrl(guild.banner_url) ?? safeHttpsUrl(guild.splash_url);
  const manageUrl = paths.guildManage(guild.id);

  return (
    <ShowcasePage className="guild-profile">
      <Card as="section" className="guild-head">
        {banner && <img className="guild-banner" src={banner} alt="" decoding="async" />}
        <PageHeader
          leading={<GuildIcon id={guild.id} iconUrl={guild.icon_url} size="xl" />}
          title={<DisplayName name={name} badges={guild.badges} entity="guild" />}
          meta={<BadgeStrip badges={guild.badges} />}
          actions={
            <>
              {inviteUrl && (
                <LinkButton to={inviteUrl} icon="login">
                  {t('join.action')}
                </LinkButton>
              )}
              {guild.can_manage && (
                <LinkButton to={manageUrl} variant="outlined" icon="settings">
                  {t('manage.action')}
                </LinkButton>
              )}
              <GuildActionsMenu guildId={guild.id} canReport={!guild.can_manage} />
            </>
          }
        />
      </Card>

      {guild.stale && <StaleNotice />}

      {guild.can_manage && (!guild.listed || (guild.invite && !guild.invite.valid)) && (
        <ul className="guild-notices" role="status">
          {!guild.listed && (
            <li>
              <Icon name="visibility_off" filled />
              <span>{t('notices.unlisted')}</span>
            </li>
          )}
          {guild.invite && !guild.invite.valid && (
            <li>
              <Icon name="link_off" filled />
              <span>{t('notices.inviteLost')}</span>
              <Link to={paths.guildManageInvite(guild.id)}>{t('notices.inviteLostAction')}</Link>
            </li>
          )}
        </ul>
      )}

      <div className="guild-body">
        <div className="guild-main">
          <AboutSection guild={guild} />
          <PostsSection guild={guild} />
        </div>
        <aside className="guild-side">
          <InfoCard guild={guild} />
          <LinksCard guild={guild} />
          <TeamCard team={guild.team} />
        </aside>
      </div>
    </ShowcasePage>
  );
}

function AboutSection({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildProfile');
  const description = guild.description?.trim();
  return (
    <Card as="section" className="guild-section" aria-labelledby="guild-about">
      <h2 id="guild-about">{t('about.title')}</h2>
      {description ? <Markdown>{description}</Markdown> : <p className="guild-empty">{t('about.none')}</p>}
      {guild.tags.length > 0 && (
        <ul className="guild-pills" aria-label={t('about.topics')}>
          {guild.tags.map((tag) => (
            <li key={tag}>
              <TagLabel>{tag}</TagLabel>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LinksCard({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildProfile');
  if (safeLinks(guild.links).length === 0) return null;
  return (
    <Card as="section" className="guild-links-card" aria-labelledby="guild-links">
      <h2 id="guild-links">{t('links.title')}</h2>
      <LinkList links={guild.links} />
    </Card>
  );
}

function PostsSection({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildProfile');
  return (
    <Card as="section" className="guild-section" aria-labelledby="guild-posts">
      <h2 id="guild-posts">
        {guild.posts.length > 0 ? t('posts.title', {count: guild.posts.length}) : t('posts.titleEmpty')}
      </h2>
      {guild.posts.length === 0 ? (
        <p className="guild-empty">{t('posts.empty')}</p>
      ) : (
        <InnerCards aria-label={t('posts.label')}>
          {guild.posts.map((post) => (
            <PostCard key={post.id} post={post} variant="row" />
          ))}
        </InnerCards>
      )}
    </Card>
  );
}

function InfoCard({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildProfile');
  const {label} = useCatalogLabel();
  useLanguage();
  const boosts = guild.boosts !== null && guild.boosts > 0 ? guild.boosts : null;
  return (
    <Card as="section" className="guild-info" aria-labelledby="guild-info-title">
      <h2 id="guild-info-title">{t('info.title')}</h2>
      <FactList>
        {guild.member_count !== null && (
          <Fact icon="group" label={t('stats.members', {count: guild.member_count})}>
            <strong className="numeric">{formatNumber(guild.member_count)}</strong>{' '}
            {t('stats.members', {count: guild.member_count})}
          </Fact>
        )}
        {boosts !== null && (
          <Fact icon="rocket_launch" label={t('stats.boosts', {count: boosts})}>
            <strong className="numeric">{formatNumber(boosts)}</strong> {t('stats.boosts', {count: boosts})}
          </Fact>
        )}
        <Fact icon="calendar_today">
          {t('stats.created')} <strong>{formatMonthYear(guild.created_at)}</strong>
        </Fact>
        {guild.theme && (
          <Fact icon="category" label={t('info.theme')}>
            {label('themes', guild.theme)}
          </Fact>
        )}
        {guild.languages.length > 0 && (
          <Fact icon="translate">
            <LanguageFlags codes={guild.languages} labelled="text" />
          </Fact>
        )}
      </FactList>
    </Card>
  );
}

function TeamCard({team}: {team: TeamMember[]}) {
  const {t} = useT('guildProfile');
  const {label} = useCatalogLabel();
  useLanguage();
  return (
    <Card as="section" className="guild-team" aria-labelledby="guild-team-title">
      <h2 id="guild-team-title">{t('team.title')}</h2>
      {team.length === 0 ? (
        <p className="guild-empty">{t('team.empty')}</p>
      ) : (
        <InnerCards aria-label={t('team.label')}>
          {team.map((member) => {
            const position =
              member.position === 'other' && member.position_other
                ? member.position_other
                : label('positions', member.position);
            const display = member.user.display_name ?? member.user.username ?? member.user.id;
            return (
              <InnerCard as="li" key={member.user.id} to={paths.user(member.user.id)}>
                <UserAvatar
                  id={member.user.id}
                  src={member.user.avatar_url}
                  decoration={member.user.avatar_decoration}
                  size="small"
                />
                <span className="guild-member">
                  <DisplayName
                    name={display}
                    badges={member.user.badges}
                    entity="user"
                    className="guild-member-name"
                    focusable={false}
                  />
                  <span className="guild-member-meta">
                    {t('team.since', {position, date: formatMonthYear(member.since)})}
                  </span>
                </span>
              </InnerCard>
            );
          })}
        </InnerCards>
      )}
    </Card>
  );
}
