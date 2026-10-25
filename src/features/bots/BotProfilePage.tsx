import {Link, useParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {useBot} from '@/api/queries';
import type {BotProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {
  BadgeStrip,
  BotAvatar,
  DisplayName,
  EmptyState,
  ErrorState,
  Fact,
  FactList,
  GuildIcon,
  isNsfw,
  LanguageFlags,
  LinkList,
  Markdown,
  NsfwGate,
  PostCard,
  RelativeTime,
  StaleNotice,
  TagLabel,
  useNsfwConfirmed,
} from '@/components';
import {safeLinks} from '@/components/links';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatMonthYear, formatNumber} from '@/lib/format';
import {safeHttpsUrl} from '@/lib/url';
import {Card, Icon, InnerCard, InnerCards, LinkButton, Page, PageHeader, PageLoading, ShowcasePage} from '@/ui';

import {TeamCard} from '../guild-profile/TeamCard';
import {BotActionsMenu} from './BotActionsMenu';
import '../guild-profile/guildProfile.css';
import './bots.css';

/** `/bots/:botId`: a bot's public profile. */
export function Component() {
  const {botId} = useParams();
  const {t} = useT('bots');
  const query = useBot(botId);
  const bot = query.data;
  const {confirmed} = useNsfwConfirmed();
  usePageTitle(bot?.name ?? t('notFound.title'));

  if (query.isPending) return <PageLoading />;

  if (query.isError || !bot) {
    return (
      <ShowcasePage>
        {hasCode(query.error, 'lineup_bot_not_found') ? (
          <EmptyState
            icon="search_off"
            shape="octagon"
            tone="tertiary"
            title={t('notFound.title')}
            action={
              <LinkButton to={paths.bots()} variant="filled" icon="smart_toy">
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

  if (isNsfw(bot) && !confirmed) {
    return (
      <Page>
        <NsfwGate nsfw headingLevel={1}>
          {null}
        </NsfwGate>
      </Page>
    );
  }
  return <BotView bot={bot} />;
}

function BotView({bot}: {bot: BotProfile}) {
  const {t} = useT('bots');
  const {t: tc} = useT('components');
  useLanguage();
  const name = bot.name ?? t('unknownName');
  const addUrl = safeHttpsUrl(bot.add_url);
  const banner = safeHttpsUrl(bot.banner_url);

  return (
    <ShowcasePage className="guild-profile bot-profile">
      <Card as="section" className="guild-head">
        {banner && <img className="guild-banner" src={banner} alt="" decoding="async" />}
        <PageHeader
          className="profile-header"
          leading={<BotAvatar id={bot.id} src={bot.avatar_url} size="xl" />}
          title={<DisplayName name={name} badges={bot.badges} entity="bot" />}
          meta={
            <div className="profile-meta-line">
              {bot.is_verified && (
                <span className="bot-verified-app">
                  <Icon name="verified" filled />
                  {tc('bot.verifiedApp')}
                </span>
              )}
              {bot.guild_count !== null && (
                <span className="bot-guild-count">
                  <strong className="numeric">{formatNumber(bot.guild_count)}</strong>{' '}
                  {tc('bot.servers', {count: bot.guild_count})}
                </span>
              )}
              <BadgeStrip badges={bot.badges} />
            </div>
          }
          actions={
            <>
              {addUrl && (
                <LinkButton to={addUrl} icon="add">
                  {t('profile.add')}
                </LinkButton>
              )}
              {bot.can_manage && (
                <LinkButton to={paths.botManage(bot.id)} variant="outlined" icon="settings">
                  {t('profile.manage')}
                </LinkButton>
              )}
              <BotActionsMenu botId={bot.id} canReport={!bot.can_manage} />
            </>
          }
        />
      </Card>

      {bot.stale && <StaleNotice />}

      {bot.can_manage && (!bot.listed || !bot.discoverable) && (
        <ul className="guild-notices" role="status">
          {!bot.discoverable && (
            <li>
              <Icon name="travel_explore" filled />
              <span>{t('notices.notDiscoverable')}</span>
            </li>
          )}
          {!bot.listed && (
            <li>
              <Icon name="visibility_off" filled />
              <span>{t('notices.unlisted')}</span>
              <Link to={paths.botManageSettings(bot.id)}>{t('notices.unlistedAction')}</Link>
            </li>
          )}
        </ul>
      )}

      <div className="guild-body">
        <div className="guild-main">
          <AboutSection bot={bot} />
          <PostsSection bot={bot} />
        </div>
        <aside className="guild-side">
          <InfoCard bot={bot} />
          <SupportCard bot={bot} />
          {safeLinks(bot.links).length > 0 && (
            <Card as="section" className="guild-links-card" aria-labelledby="bot-links">
              <h2 id="bot-links">{t('links.title')}</h2>
              <LinkList links={bot.links} />
            </Card>
          )}
          <TeamCard team={bot.team} title={t('team.title')} label={t('team.label')} empty={t('team.empty')} />
        </aside>
      </div>
    </ShowcasePage>
  );
}

function AboutSection({bot}: {bot: BotProfile}) {
  const {t} = useT('bots');
  const description = bot.description?.trim();
  return (
    <Card as="section" className="guild-section" aria-labelledby="bot-about">
      <h2 id="bot-about">{t('about.title')}</h2>
      {description ? <Markdown>{description}</Markdown> : <p className="guild-empty">{t('about.none')}</p>}
      {bot.tags.length > 0 && (
        <ul className="guild-pills" aria-label={t('about.tags')}>
          {bot.tags.map((tag) => (
            <li key={tag}>
              <TagLabel>{tag}</TagLabel>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PostsSection({bot}: {bot: BotProfile}) {
  const {t} = useT('bots');
  return (
    <Card as="section" className="guild-section" aria-labelledby="bot-posts">
      <h2 id="bot-posts">
        {bot.posts.length > 0 ? t('posts.title', {count: bot.posts.length}) : t('posts.titleEmpty')}
      </h2>
      {bot.posts.length === 0 ? (
        <p className="guild-empty">{t('posts.empty')}</p>
      ) : (
        <InnerCards aria-label={t('posts.label')}>
          {bot.posts.map((post) => (
            <PostCard key={post.id} post={post} variant="row" />
          ))}
        </InnerCards>
      )}
    </Card>
  );
}

/** The facts: server count, creation on Discord, theme, languages, the App Directory's categories. */
function InfoCard({bot}: {bot: BotProfile}) {
  const {t} = useT('bots');
  const {t: tc} = useT('components');
  const {label} = useCatalogLabel();
  useLanguage();
  const discordTopics = [...bot.categories, ...bot.discord_tags.filter((tag) => !bot.categories.includes(tag))];
  return (
    <Card as="section" className="guild-info" aria-labelledby="bot-info-title">
      <h2 id="bot-info-title">{t('info.title')}</h2>
      <FactList>
        {bot.guild_count !== null && (
          <Fact icon="dns" label={tc('bot.servers', {count: bot.guild_count})}>
            <strong className="numeric">{formatNumber(bot.guild_count)}</strong>{' '}
            {tc('bot.servers', {count: bot.guild_count})}
          </Fact>
        )}
        <Fact icon="calendar_today">
          {t('info.created')} <strong>{formatMonthYear(bot.created_at)}</strong>
        </Fact>
        {bot.theme && (
          <Fact icon="category" label={t('info.theme')}>
            {label('themes', bot.theme)}
          </Fact>
        )}
        {bot.languages.length > 0 && (
          <Fact icon="translate">
            <LanguageFlags codes={bot.languages} labelled="text" />
          </Fact>
        )}
        {discordTopics.length > 0 && (
          <Fact icon="apps" label={t('info.discordTopics')}>
            <ul className="tag-labels">
              {discordTopics.map((topic) => (
                <li key={topic}>
                  <TagLabel icon={null}>{topic}</TagLabel>
                </li>
              ))}
            </ul>
          </Fact>
        )}
        {bot.snapshot_at && (
          <Fact icon="sync" label={t('info.snapshot')}>
            <RelativeTime value={bot.snapshot_at} format={(relative) => t('info.updated', {relative})} />
          </Fact>
        )}
      </FactList>
    </Card>
  );
}

/**
 * The support server: a link to its Lineup profile when it has one, else its
 * name and icon alone. Name and icon can be missing just after the developer
 * changed it: the id stands in.
 */
function SupportCard({bot}: {bot: BotProfile}) {
  const {t} = useT('bots');
  const support = bot.support_guild;
  if (!support) return null;
  const name = support.name ?? support.id;
  const content = (
    <>
      <GuildIcon id={support.id} iconUrl={support.icon_url} />
      <span className="guild-member">
        {support.profile ? (
          <DisplayName
            className="guild-member-name"
            name={name}
            badges={support.profile.badges}
            entity="guild"
            focusable={false}
          />
        ) : (
          <span className="guild-member-name">{name}</span>
        )}
        {support.member_count !== null && (
          <span className="guild-member-meta">
            {t('support.members', {count: support.member_count, value: formatNumber(support.member_count)})}
          </span>
        )}
      </span>
    </>
  );
  return (
    <Card as="section" className="guild-info" aria-labelledby="bot-support-title">
      <h2 id="bot-support-title">{t('support.title')}</h2>
      {support.profile ? (
        <InnerCard to={paths.guild(support.id)}>{content}</InnerCard>
      ) : (
        <InnerCard className="bot-support-plain">{content}</InnerCard>
      )}
    </Card>
  );
}
