import {ExperienceList} from '@/components/ExperienceRow';
import {useQueryClient} from '@tanstack/react-query';
import {type ReactNode, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useClosePost, useDeletePost, usePublishPost} from '@/api/mutations';
import {useGuild, useMyExperiences, useMyProfile, usePost, useUser} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import type {PostDetail} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {
  ApplicationAction,
  DisplayName,
  Fact,
  FactList,
  TagLabel,
  ErrorState,
  ExperienceRow,
  ExpiryLabel,
  GuildIcon,
  InlineStats,
  isNsfw,
  LanguageFlags,
  Markdown,
  NsfwGate,
  RelativeTime,
  ReportDialog,
  RequirementList,
  type RequirementViewer,
  RetryButton,
  TimezoneLabel,
  UserAvatar,
} from '@/components';
import {positionItems} from '@/components/positions';
import {formatNumber} from '@/lib/format';
import {useT} from '@/i18n/useT';
import {
  Card,
  CardActions,
  ConfirmDialog,
  Dropdown,
  type DropdownItem,
  Icon,
  LinkButton,
  Page,
  Pill,
  ShowcasePage,
  Shape,
  Spinner,
  useSnackbar,
} from '@/ui';

import {type OwnerAction, ownerActions} from './postActions';
import './post.css';

export function Component() {
  const {postId} = useParams();
  const [deleted, setDeleted] = useState(false);
  const query = usePost(deleted ? undefined : postId);
  const {t} = useT('post');
  const post = query.data;
  usePageTitle(post?.title ?? t('title'));

  if (deleted) return <Loading />;
  if (query.isPending) return <Loading />;
  if (query.isError) {
    if (hasCode(query.error, 'lineup_post_not_found')) return <NotFound />;
    return (
      <ShowcasePage className="post-page">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </ShowcasePage>
    );
  }
  return <PostView post={query.data} onDeleted={() => setDeleted(true)} />;
}

function Loading() {
  const {t} = useT('post');
  return (
    <ShowcasePage className="post-page">
      <h1 className="visually-hidden">{t('title')}</h1>
      <div className="post-state" aria-busy="true">
        <Spinner />
      </div>
    </ShowcasePage>
  );
}

function NotFound() {
  const {t} = useT('post');
  const {t: tCommon} = useT('common');
  return (
    <Page special>
      <Card variant="hero">
        <Shape shape="hexagon" tone="tertiary" icon="search_off" />
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.body')}</p>
        <CardActions>
          <LinkButton to={paths.feed()} icon="arrow_back">
            {tCommon('actions.backToFeed')}
          </LinkButton>
        </CardActions>
      </Card>
    </Page>
  );
}

// ---------------------------------------------------------------------------

/** Who posts: the server (kind `guild`) or the person (kind `user`), with what the page can tell of them. */
function usePoster(post: PostDetail) {
  const {t: tc} = useT('components');
  const isGuild = post.kind === 'guild' && post.guild_id !== null;
  const guild = useGuild(isGuild ? post.guild_id! : undefined);
  const user = useUser(isGuild ? undefined : post.author_id);
  const name = isGuild
    ? (post.guild?.name ?? guild.data?.name ?? tc('post.unknownGuild'))
    : (post.author.global_name ?? post.author.username ?? tc('post.unknownAuthor'));
  return {
    isGuild,
    name,
    badges: isGuild ? (post.guild?.badges ?? guild.data?.badges) : post.author.badges,
    to: isGuild ? paths.guild(post.guild_id!) : paths.user(post.author_id),
    guild: guild.data,
    user: user.data,
  };
}

function PostView({post, onDeleted}: {post: PostDetail; onDeleted: () => void}) {
  const nsfw = isNsfw({theme: post.theme, guild: post.guild});
  const poster = usePoster(post);
  return (
    <ShowcasePage className="post-page">
      <NsfwGate nsfw={nsfw} headingLevel={1}>
        <Banners post={post} />
        <PostHeader post={post} poster={poster} onDeleted={onDeleted} />
        <div className="post-body">
          <Summary post={post} />
          <Card as="article" className="post-content">
            <Description post={post} />
            <Requirements post={post} />
            <FeaturedExperience post={post} poster={poster} />
          </Card>
          <Poster post={post} poster={poster} />
        </div>
      </NsfwGate>
    </ShowcasePage>
  );
}

// ---------------------------------------------------------------------------
// Status lines
// ---------------------------------------------------------------------------

function Banner({icon, children}: {icon: string; children: ReactNode}) {
  return (
    <p className="post-banner" role="status">
      <Icon name={icon} filled />
      <span>{children}</span>
    </p>
  );
}

function Banners({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const expired = post.status === 'published' && post.is_expired;
  return (
    <>
      {post.status === 'draft' && <Banner icon="edit_note">{t('banner.draft')}</Banner>}
      {post.status === 'closed' && <Banner icon="lock">{t('banner.closed')}</Banner>}
      {post.status === 'hidden' && (
        <Banner icon="visibility_off">
          {t('banner.hidden')}
          {post.hidden_reason && <> {t('banner.hiddenReason', {reason: post.hidden_reason})}</>}
        </Banner>
      )}
      {expired && (
        <Banner icon="event_busy">
          {post.can_edit ? t('banner.expiredEditor') : t('banner.expired')}
          {post.can_edit && (
            <>
              {' '}
              <Link to={`${paths.postEdit(post.id)}?focus=expiry`} className="post-link">
                {t('banner.expiredEdit')}
              </Link>
            </>
          )}
        </Banner>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Header: title, who and when, the main action and the menu
// ---------------------------------------------------------------------------

type Poster = ReturnType<typeof usePoster>;

function PostHeader({post, poster, onDeleted}: {post: PostDetail; poster: Poster; onDeleted: () => void}) {
  const {t} = useT('post');
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const publish = usePublishPost();
  const close = useClosePost();
  const remove = useDeletePost();

  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  // The report dialog is mounted on first use, then kept so that it can animate out.
  const [reportMounted, setReportMounted] = useState(false);
  const [last, setLast] = useState<(() => Promise<void>) | null>(null);
  const wait = useRetryAfter(error);

  const actions = ownerActions(post);
  const editor = actions.length > 0;
  const canReport = !post.can_edit && post.status === 'published';
  const busy = publish.isPending || close.isPending || remove.isPending;
  const disabled = busy || !canWrite || wait.active;

  /** Runs a write; a failure that means "the post is not what the page shows" reloads the post. */
  const run = (action: () => Promise<void>) => {
    setLast(() => action);
    setError(null);
    return auth.run(action).catch((failure: unknown) => {
      setError(failure);
      if (hasCode(failure, 'lineup_post_hidden', 'lineup_post_invalid_status', 'lineup_post_not_found')) {
        void queryClient.invalidateQueries({queryKey: queryKeys.postDetail(post.id), exact: true});
      }
    });
  };

  const change = (kind: 'publish' | 'reopen' | 'close') =>
    run(async () => {
      if (kind === 'close') await close.mutateAsync(post.id);
      else await publish.mutateAsync(post.id);
      snackbar.show({message: t(`snackbar.${kind}`)});
    });

  const doDelete = () =>
    run(async () => {
      await remove.mutateAsync(post.id);
      setConfirming(false);
      onDeleted();
      snackbar.show({message: t('snackbar.delete')});
      void navigate(paths.myPosts());
    }).finally(() => setConfirming(false));

  const message =
    error === null
      ? null
      : errorMessage(error, tErrors, wait.active || !hasCode(error, 'lineup_rate_limited') ? undefined : {seconds: 0});
  const quota = hasCode(error, 'lineup_quota_exceeded');
  const expired = hasCode(error, 'lineup_post_expired');
  const retryable = hasCode(error, 'discord_unavailable');

  const primary = actions[0];
  const menuActions = actions.slice(1);

  const primaryButton = () => {
    switch (primary) {
      case 'publish':
      case 'reopen':
        return (
          <md-filled-button disabled={disabled || post.is_expired} onclick={() => void change(primary)}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              {primary === 'publish' ? 'publish' : 'replay'}
            </md-icon>
            {t(`actions.${primary}`)}
          </md-filled-button>
        );
      case 'edit':
        return (
          <LinkButton to={paths.postEdit(post.id)} icon="edit" disabled={!canWrite}>
            {t('actions.edit')}
          </LinkButton>
        );
      default:
        return null;
    }
  };

  const menuItem = (action: OwnerAction): DropdownItem => {
    switch (action) {
      case 'edit':
        return {
          key: 'edit',
          icon: 'edit',
          label: t('actions.edit'),
          disabled: !canWrite,
          onSelect: () => void navigate(paths.postEdit(post.id)),
        };
      case 'publish':
      case 'reopen':
        return {
          key: action,
          icon: action === 'publish' ? 'publish' : 'replay',
          label: t(`actions.${action}`),
          disabled: disabled || post.is_expired,
          onSelect: () => void change(action),
        };
      case 'close':
        return {key: 'close', icon: 'lock', label: t('actions.close'), disabled, onSelect: () => void change('close')};
      case 'delete':
        return {
          key: 'delete',
          icon: 'delete',
          label: tCommon('actions.delete'),
          destructive: true,
          disabled,
          onSelect: () => setConfirming(true),
        };
    }
  };

  const menuItems: DropdownItem[] = [
    ...menuActions.map(menuItem),
    ...(canReport
      ? [
          {
            key: 'report',
            icon: 'flag',
            label: t('menu.report'),
            disabled: !canWrite,
            onSelect: () =>
              void auth.run(() => {
                setReportMounted(true);
                setReporting(true);
              }),
          },
        ]
      : []),
  ];

  const hasMenu = menuActions.length > 0 || canReport;

  return (
    <>
      <Card as="section" className="post-header-card" aria-labelledby="post-title">
        <div className="post-header">
          <div className="post-heading">
            <h1 id="post-title" className="post-title">
              {post.title}
            </h1>
            <p className="post-byline">
              <Link to={poster.to} className="post-poster-link">
                {poster.isGuild ? (
                  <GuildIcon id={post.guild_id!} iconUrl={post.guild?.icon_url} size="small" />
                ) : (
                  <UserAvatar id={post.author.id} src={post.author.avatar_url} size="small" />
                )}
                <DisplayName
                  name={poster.name}
                  badges={poster.badges}
                  entity={poster.isGuild ? 'guild' : 'user'}
                  focusable={false}
                />
              </Link>
              {post.published_at && (
                <span className="post-dates">
                  {t('dates.published')} <RelativeTime value={post.published_at} />
                </span>
              )}
              {Date.parse(post.updated_at) - Date.parse(post.published_at ?? post.created_at) > 60_000 && (
                <span className="post-dates">
                  {t('dates.updated')} <RelativeTime value={post.updated_at} />
                </span>
              )}
            </p>
          </div>
          <div className="post-actions">
            {editor ? primaryButton() : <ApplicationAction post={post} />}
            {hasMenu && (
              <span className="post-menu">
                <Dropdown
                  align="end"
                  label={t('menu.label')}
                  items={menuItems}
                  trigger={({ref, onActivate, ...aria}) => (
                    <md-icon-button
                      {...aria}
                      ref={ref}
                      aria-label={t('menu.label')}
                      title={t('menu.label')}
                      onclick={onActivate}
                    >
                      <md-icon>more_vert</md-icon>
                    </md-icon-button>
                  )}
                />
              </span>
            )}
          </div>
        </div>
      </Card>

      {message && (
        <div className="post-error" role="alert">
          <p>
            <Icon name="error" filled />
            {message}
          </p>
          {quota && (
            <Link to={paths.myPosts()} className="post-link">
              {t('errorLinks.myPosts')}
            </Link>
          )}
          {expired && (
            <Link to={`${paths.postEdit(post.id)}?focus=expiry`} className="post-link">
              {t('errorLinks.editExpiry')}
            </Link>
          )}
          {retryable && last && <RetryButton error={error} busy={busy} onRetry={() => void run(last)} />}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        destructive
        busy={remove.isPending}
        title={t('confirmDelete.title')}
        body={t('confirmDelete.body', {title: post.title})}
        confirmLabel={tCommon('actions.delete')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void doDelete()}
      />
      {reportMounted && (
        <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{type: 'post', id: post.id}} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function Description({post}: {post: PostDetail}) {
  return (
    <section className="post-description" aria-label={post.title}>
      <Markdown>{post.description}</Markdown>
    </section>
  );
}

function Requirements({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const {status: sessionStatus} = useSession();
  const profile = useMyProfile();
  const experiences = useMyExperiences();
  if (post.requirements.length === 0) return null;

  const viewer: RequirementViewer | undefined =
    sessionStatus === 'authenticated' && profile.data && experiences.data
      ? {
          accountCreatedAt: profile.data.created_at,
          hasVerifiedExperience: experiences.data.items.some(
            (experience) => experience.verification.status === 'verified',
          ),
        }
      : undefined;

  return (
    <section className="post-section" aria-labelledby="post-requirements">
      <h2 id="post-requirements">{t('sections.requirements')}</h2>
      <RequirementList requirements={post.requirements} viewer={viewer} />
    </section>
  );
}

function FeaturedExperience({post, poster}: {post: PostDetail; poster: Poster}) {
  const {t} = useT('post');
  const experience = poster.user?.experiences.find((item) => item.id === post.featured_experience_id);
  if (post.kind !== 'user' || post.featured_experience_id === null || !experience) return null;
  return (
    <section className="post-section" aria-labelledby="post-featured">
      <h2 id="post-featured">{t('featured.title')}</h2>
      <ExperienceList>
        <ExperienceRow
          experience={experience}
          href={experience.kind === 'guild' && experience.guild_id ? paths.guild(experience.guild_id) : undefined}
        />
      </ExperienceList>
    </section>
  );
}

/** The facts of the post: one list, an icon then the value. The field name is the icon's tooltip. */
function Summary({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const {t: tc} = useT('components');
  const {label} = useCatalogLabel();
  const positions = positionItems(post.positions, post.positions_other, (id) => label('positions', id));
  const commitment = post.commitment;

  return (
    <Card as="section" className="post-summary" aria-labelledby="post-summary-title">
      <h2 id="post-summary-title">{t('sections.summary')}</h2>
      <FactList>
        {positions.length > 0 && (
          <Fact icon="work" label={t('facts.positions')}>
            <ul className="tag-labels">
              {positions.map((position) => (
                <li key={position.key}>
                  <TagLabel icon={null}>{position.label}</TagLabel>
                </li>
              ))}
            </ul>
          </Fact>
        )}
        {commitment?.compensation && (
          <Fact icon="payments" label={t('facts.commitment')}>
            {label('compensations', commitment.compensation)}
          </Fact>
        )}
        {commitment?.hours_per_week != null && (
          <Fact icon="schedule" label={t('facts.commitment')}>
            {tc('post.hoursPerWeek', {value: formatNumber(commitment.hours_per_week)})}
          </Fact>
        )}
        {commitment?.openings != null && (
          <Fact icon="group_add" label={t('facts.commitment')}>
            {tc('post.openings', {count: commitment.openings, value: formatNumber(commitment.openings)})}
          </Fact>
        )}
        {post.languages.length > 0 && (
          <Fact icon="translate" label={t('facts.languages')}>
            <LanguageFlags codes={post.languages} labelled="text" />
          </Fact>
        )}
        {post.timezone && (
          <Fact icon="public" label={t('facts.timezone')}>
            <TimezoneLabel timezone={post.timezone} bare />
          </Fact>
        )}
        {post.theme && (
          <Fact icon="category" label={t('facts.theme')}>
            {label('themes', post.theme)}
          </Fact>
        )}
        {post.tags.length > 0 && (
          <Fact icon="sell" label={t('facts.tags')}>
            <ul className="tag-labels">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <TagLabel icon={null}>{tag}</TagLabel>
                </li>
              ))}
            </ul>
          </Fact>
        )}
        <Fact icon={post.is_expired ? 'event_busy' : 'hourglass_empty'} label={t('facts.expiry')}>
          <ExpiryLabel expiresAt={post.expires_at} isExpired={post.is_expired} mode="always" />
        </Fact>
      </FactList>
    </Card>
  );
}

/** The server or the person behind the post: a small card that leads to their profile. */
function Poster({post, poster}: {post: PostDetail; poster: Poster}) {
  const {t} = useT('post');
  const {guild} = poster;
  const stats = poster.isGuild
    ? [
        {
          icon: 'group',
          value: guild?.member_count ?? null,
          label: t('stats.members', {count: guild?.member_count ?? 0}),
        },
      ]
    : [];

  return (
    <Card as="section" className="post-poster" aria-labelledby="post-poster-title">
      <h2 id="post-poster-title" className="visually-hidden">
        {poster.isGuild ? t('author.guild') : t('author.user')}
      </h2>
      <div className="post-poster-head">
        {poster.isGuild ? (
          <GuildIcon id={post.guild_id!} iconUrl={post.guild?.icon_url} />
        ) : (
          <UserAvatar id={post.author.id} src={post.author.avatar_url} />
        )}
        <div className="post-poster-text">
          <DisplayName
            as="strong"
            name={poster.name}
            badges={poster.badges}
            entity={poster.isGuild ? 'guild' : 'user'}
          />
          {!poster.isGuild && post.author.username && <Pill>@{post.author.username}</Pill>}
          <InlineStats items={stats} compact />
        </div>
      </div>
      <CardActions>
        <LinkButton variant="outlined" icon={poster.isGuild ? 'groups' : 'person'} to={poster.to}>
          {poster.isGuild ? t('author.viewGuild') : t('author.viewUser')}
        </LinkButton>
      </CardActions>
    </Card>
  );
}
