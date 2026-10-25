import {Link, useParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {useGuild} from '@/api/queries';
import type {BotCard, GuildProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {
  BadgeStrip,
  BotRow,
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
} from '@/components';
import {safeLinks} from '@/components/links';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatMonthYear, formatNumber} from '@/lib/format';
import {safeHttpsUrl} from '@/lib/url';
import {Card, Icon, LinkButton, Page, PageHeader, InnerCards, PageLoading, ShowcasePage} from '@/ui';

import {GuildActionsMenu} from './GuildActionsMenu';
import {TeamCard} from './TeamCard';
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
              <LinkButton to={paths.feed()} variant="filled" icon="rocket_launch">
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
        <NsfwGate nsfw headingLevel={1}>
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
          className="profile-header"
          leading={<GuildIcon id={guild.id} iconUrl={guild.icon_url} size="xl" />}
          title={<DisplayName name={name} badges={guild.badges} entity="guild" />}
          meta={
            <div className="profile-meta-line">
              <BadgeStrip badges={guild.badges} />
            </div>
          }
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
          <BotsCard bots={guild.bots ?? []} />
          <TeamCard team={guild.team} title={t('team.title')} label={t('team.label')} empty={t('team.empty')} />
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

/** The bots whose support server this is: a link to each bot's profile. Nothing when there are none. */
function BotsCard({bots}: {bots: BotCard[]}) {
  const {t} = useT('guildProfile');
  if (bots.length === 0) return null;
  return (
    <Card as="section" className="guild-bots" aria-labelledby="guild-bots-title">
      <h2 id="guild-bots-title">{t('bots.title')}</h2>
      <InnerCards aria-label={t('bots.title')}>
        {bots.map((bot) => (
          <BotRow key={bot.id} bot={bot} />
        ))}
      </InnerCards>
    </Card>
  );
}
