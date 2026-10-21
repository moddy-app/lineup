import {useQueryClient} from '@tanstack/react-query';
import {type ReactNode, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useClosePost, useDeletePost, usePublishPost} from '@/api/mutations';
import {useMyExperiences, useMyProfile, usePost, useUser} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import type {PostDetail} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {
  ApplicationAction,
  CommitmentSummary,
  ErrorState,
  ExperienceRow,
  ExpiryLabel,
  GuildIcon,
  isNsfw,
  LanguageList,
  NsfwGate,
  PostStatusBadge,
  RelativeTime,
  ReportButton,
  RequirementList,
  type RequirementViewer,
  RetryButton,
  TimezoneLabel,
  UserAvatar,
} from '@/components';
import {positionItems} from '@/components/positions';
import {useT} from '@/i18n/useT';
import {
  Bento,
  Card,
  CardActions,
  Chip,
  Chips,
  ConfirmDialog,
  Icon,
  LinkButton,
  Page,
  Pill,
  Rows,
  Shape,
  Spinner,
  Stack,
  Status,
  useSnackbar,
} from '@/ui';

import {ownerActions} from './postActions';
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
      <Page>
        <Bento>
          <Stack span={8}>
            <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
          </Stack>
        </Bento>
      </Page>
    );
  }
  return <PostView post={query.data} onDeleted={() => setDeleted(true)} />;
}

function Loading() {
  const {t} = useT('post');
  return (
    <Page>
      <Bento>
        <Stack span={8}>
          <Card aria-busy="true">
            <h1 className="visually-hidden">{t('title')}</h1>
            <Spinner />
          </Card>
        </Stack>
      </Bento>
    </Page>
  );
}

function NotFound() {
  const {t} = useT('post');
  const {t: tCommon} = useT('common');
  return (
    <Page special>
      <Bento>
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
      </Bento>
    </Page>
  );
}

// ---------------------------------------------------------------------------

function PostView({post, onDeleted}: {post: PostDetail; onDeleted: () => void}) {
  const nsfw = isNsfw({theme: post.theme});
  return (
    <Page>
      <NsfwGate nsfw={nsfw} headingLevel={1}>
        <Bento>
          <Stack span={8}>
            <Banners post={post} />
            <PostMain post={post} />
          </Stack>
          <Stack span={4} sticky>
            <OwnerCard post={post} onDeleted={onDeleted} />
            <ApplyCard post={post} />
            <AuthorCard post={post} />
            <FeaturedExperience post={post} />
            {!post.can_edit && <ReportCard post={post} />}
          </Stack>
        </Bento>
      </NsfwGate>
    </Page>
  );
}

function Banner({icon, tone, children}: {icon: string; tone: 'tertiary' | 'secondary' | 'primary'; children: ReactNode}) {
  return (
    <Card className="post-banner" role="status">
      <Shape shape="octagon" tone={tone} icon={icon} small />
      <div className="post-banner-text">{children}</div>
    </Card>
  );
}

function Banners({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const expired = post.status === 'published' && post.is_expired;
  return (
    <>
      {post.status === 'draft' && (
        <Banner icon="edit_note" tone="secondary">
          <strong>{t('banner.draft.title')}</strong>
          <p>{t('banner.draft.body')}</p>
        </Banner>
      )}
      {post.status === 'closed' && (
        <Banner icon="lock" tone="secondary">
          <strong>{t('banner.closed.title')}</strong>
          <p>{t('banner.closed.body')}</p>
        </Banner>
      )}
      {post.status === 'hidden' && (
        <Banner icon="visibility_off" tone="tertiary">
          <strong>{t('banner.hidden.title')}</strong>
          <p>{t('banner.hidden.body')}</p>
          {post.hidden_reason && <p className="post-banner-reason">{t('banner.hidden.reason', {reason: post.hidden_reason})}</p>}
        </Banner>
      )}
      {expired && (
        <Banner icon="event_busy" tone="tertiary">
          <strong>{t('banner.expired.title')}</strong>
          <p>{post.can_edit ? t('banner.expired.editor') : t('banner.expired.body')}</p>
          {post.can_edit && (
            <Link to={paths.postEdit(post.id)} className="post-banner-link">
              {t('banner.expired.edit')}
            </Link>
          )}
        </Banner>
      )}
    </>
  );
}

function Author({post}: {post: PostDetail}) {
  const {t: tc} = useT('components');
  const isGuild = post.kind === 'guild';
  const name = isGuild
    ? (post.guild?.name ?? tc('post.unknownGuild'))
    : (post.author.global_name ?? post.author.username ?? tc('post.unknownAuthor'));
  const to = isGuild && post.guild_id ? paths.guild(post.guild_id) : paths.user(post.author_id);
  return (
    <Link to={to} className="post-author">
      {isGuild && post.guild_id ? (
        <GuildIcon id={post.guild_id} iconUrl={post.guild?.icon_url} />
      ) : (
        <UserAvatar id={post.author.id} src={post.author.avatar_url} />
      )}
      <strong>{name}</strong>
    </Link>
  );
}

function PostMain({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const {t: tc} = useT('components');
  const {label} = useCatalogLabel();
  const {status: sessionStatus} = useSession();
  const signedIn = sessionStatus === 'authenticated';
  const profile = useMyProfile();
  const experiences = useMyExperiences();

  const viewer: RequirementViewer | undefined =
    signedIn && profile.data && experiences.data
      ? {
          accountCreatedAt: profile.data.created_at,
          hasVerifiedExperience: experiences.data.items.some((experience) => experience.verification.status === 'verified'),
        }
      : undefined;

  const positions = positionItems(post.positions, post.positions_other, (id) => label('positions', id));
  const hasCommitment =
    post.commitment !== null &&
    (post.commitment.compensation != null || post.commitment.hours_per_week != null || post.commitment.openings != null);
  const hasDetails = post.languages.length > 0 || post.timezone !== null || post.theme !== null || post.tags.length > 0;

  return (
    <>
      <Card as="article" className="post-main" aria-labelledby="post-title">
        <div className="post-main-top">
          <Author post={post} />
          <div className="post-tags">
            <Status variant={post.kind === 'guild' ? 'default' : 'strong'}>{tc(`post.kind.${post.kind}`)}</Status>
            {post.status !== 'published' && <PostStatusBadge status={post.status} />}
            {post.status === 'published' && post.is_expired && <PostStatusBadge status="published" isExpired />}
          </div>
        </div>
        <h1 id="post-title" className="post-page-title">
          {post.title}
        </h1>
        <p className="post-description">{post.description}</p>
        <ul className="meta-list post-dates">
          {post.published_at && (
            <li className="meta-item">
              <Icon name="event_available" />
              <span>
                {t('dates.published')} <RelativeTime value={post.published_at} />
              </span>
            </li>
          )}
          {post.updated_at !== (post.published_at ?? post.created_at) && (
            <li className="meta-item">
              <Icon name="edit_calendar" />
              <span>
                {t('dates.updated')} <RelativeTime value={post.updated_at} />
              </span>
            </li>
          )}
          <li className="meta-item">
            <Icon name={post.is_expired ? 'event_busy' : 'hourglass_bottom'} />
            <ExpiryLabel expiresAt={post.expires_at} isExpired={post.is_expired} mode="always" />
          </li>
        </ul>
      </Card>

      <Card as="section" aria-labelledby="post-positions">
        <h2 id="post-positions">{t('sections.positions')}</h2>
        {positions.length > 0 && (
          <Chips aria-label={t('sections.positions')}>
            {positions.map((position) => (
              <Chip key={position.key} icon={position.icon}>
                <span className="chip-label">{position.label}</span>
              </Chip>
            ))}
          </Chips>
        )}
        {hasCommitment && (
          <ul className="meta-list post-commitment">
            <CommitmentSummary commitment={post.commitment} bare />
          </ul>
        )}
      </Card>

      {post.requirements.length > 0 && (
        <Card as="section" aria-labelledby="post-requirements">
          <h2 id="post-requirements">{t('sections.requirements')}</h2>
          <RequirementList requirements={post.requirements} viewer={viewer} />
        </Card>
      )}

      {hasDetails && (
        <Card as="section" aria-labelledby="post-details">
          <h2 id="post-details">{t('sections.details')}</h2>
          <dl className="post-facts">
            {post.languages.length > 0 && (
              <div>
                <dt>{t('facts.languages')}</dt>
                <dd>
                  <LanguageList codes={post.languages} />
                </dd>
              </div>
            )}
            {post.timezone && (
              <div>
                <dt>{t('facts.timezone')}</dt>
                <dd>
                  <TimezoneLabel timezone={post.timezone} />
                </dd>
              </div>
            )}
            {post.theme && (
              <div>
                <dt>{t('facts.theme')}</dt>
                <dd>{label('themes', post.theme)}</dd>
              </div>
            )}
            {post.tags.length > 0 && (
              <div>
                <dt>{t('facts.tags')}</dt>
                <dd>
                  <Chips aria-label={t('facts.tags')}>
                    {post.tags.map((tag) => (
                      <Chip key={tag} mono>
                        {tag}
                      </Chip>
                    ))}
                  </Chips>
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Side column
// ---------------------------------------------------------------------------

function ApplyCard({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const {application} = post;
  const open = post.status === 'published' && !post.is_expired;
  if (!application || !open || application.type === 'lineup_form') return null;
  return (
    <Card as="section" aria-labelledby="post-apply">
      <h2 id="post-apply">{t('apply.title')}</h2>
      <p>{application.type === 'external_url' ? t('apply.external') : t('apply.dm')}</p>
      <CardActions>
        <ApplicationAction post={post} />
      </CardActions>
    </Card>
  );
}

function AuthorCard({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const {t: tc} = useT('components');
  const isGuild = post.kind === 'guild' && post.guild_id;
  const name = isGuild
    ? (post.guild?.name ?? tc('post.unknownGuild'))
    : (post.author.global_name ?? post.author.username ?? tc('post.unknownAuthor'));
  return (
    <Card as="section" aria-labelledby="post-author">
      <h2 id="post-author">{isGuild ? t('author.guild') : t('author.user')}</h2>
      <div className="post-author-card">
        {isGuild && post.guild_id ? (
          <GuildIcon id={post.guild_id} iconUrl={post.guild?.icon_url} size="large" />
        ) : (
          <UserAvatar id={post.author.id} src={post.author.avatar_url} size="large" />
        )}
        <div className="post-author-name">
          <strong>{name}</strong>
          {!isGuild && post.author.username && <Pill>@{post.author.username}</Pill>}
        </div>
      </div>
      <CardActions>
        <LinkButton
          variant="outlined"
          icon={isGuild ? 'groups' : 'person'}
          to={isGuild && post.guild_id ? paths.guild(post.guild_id) : paths.user(post.author_id)}
        >
          {isGuild ? t('author.viewGuild') : t('author.viewUser')}
        </LinkButton>
      </CardActions>
    </Card>
  );
}

function FeaturedExperience({post}: {post: PostDetail}) {
  const {t} = useT('post');
  const wanted = post.kind === 'user' && post.featured_experience_id !== null;
  const user = useUser(wanted ? post.author_id : undefined);
  const experience = user.data?.experiences.find((item) => item.id === post.featured_experience_id);
  if (!wanted || !experience) return null;
  return (
    <Card as="section" aria-labelledby="post-featured">
      <h2 id="post-featured">{t('featured.title')}</h2>
      <Rows as="ul">
        <ExperienceRow
          experience={experience}
          href={experience.kind === 'guild' && experience.guild_id ? paths.guild(experience.guild_id) : undefined}
        />
      </Rows>
    </Card>
  );
}

function ReportCard({post}: {post: PostDetail}) {
  const {t} = useT('post');
  if (post.status !== 'published') return null;
  return (
    <Card as="section" className="post-report" aria-label={t('report.label')}>
      <ReportButton target={{type: 'post', id: post.id}} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Owner actions
// ---------------------------------------------------------------------------

type Pending = 'publish' | 'reopen' | 'close';

function OwnerCard({post, onDeleted}: {post: PostDetail; onDeleted: () => void}) {
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
  const [last, setLast] = useState<(() => Promise<void>) | null>(null);
  const wait = useRetryAfter(error);

  const actions = ownerActions(post);
  if (actions.length === 0) return null;
  const busy = publish.isPending || close.isPending || remove.isPending;
  const disabled = busy || !canWrite || wait.active;

  /** Runs a write; a failure that means "the post is not what the page shows" reloads the post. */
  const run = (action: () => Promise<void>) => {
    setLast(() => action);
    setError(null);
    return auth
      .run(action)
      .catch((failure: unknown) => {
        setError(failure);
        if (hasCode(failure, 'lineup_post_hidden', 'lineup_post_invalid_status', 'lineup_post_not_found')) {
          void queryClient.invalidateQueries({queryKey: queryKeys.postDetail(post.id), exact: true});
        }
      });
  };

  const change = (kind: Pending) =>
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

  const message = error === null ? null : errorMessage(error, tErrors, wait.active || !hasCode(error, 'lineup_rate_limited') ? undefined : {seconds: 0});
  const quota = hasCode(error, 'lineup_quota_exceeded');
  const expired = hasCode(error, 'lineup_post_expired');
  const retryable = hasCode(error, 'discord_unavailable');

  const primary = actions[0];
  const button = (action: (typeof actions)[number]) => {
    switch (action) {
      case 'publish':
      case 'reopen':
        return (
          <md-filled-button key={action} disabled={disabled || post.is_expired} onclick={() => void change(action)}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              {action === 'publish' ? 'publish' : 'replay'}
            </md-icon>
            {t(`actions.${action}`)}
          </md-filled-button>
        );
      case 'edit':
        return (
          <LinkButton key="edit" to={paths.postEdit(post.id)} icon="edit" variant={primary === 'edit' ? 'filled' : 'outlined'} disabled={!canWrite}>
            {t('actions.edit')}
          </LinkButton>
        );
      case 'close':
        return (
          <md-outlined-button key="close" disabled={disabled} onclick={() => void change('close')}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              lock
            </md-icon>
            {t('actions.close')}
          </md-outlined-button>
        );
      case 'delete':
        return (
          <md-text-button key="delete" disabled={disabled} onclick={() => setConfirming(true)}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              delete
            </md-icon>
            {tCommon('actions.delete')}
          </md-text-button>
        );
    }
  };

  return (
    <Card as="section" aria-labelledby="post-manage">
      <h2 id="post-manage">{t('manage.title')}</h2>
      <p>{t('manage.body')}</p>
      {message && (
        <div className="post-error" role="alert">
          <p>
            <Icon name="error" filled />
            {message}
          </p>
          {quota && (
            <Link to={paths.myPosts()} className="post-banner-link">
              {t('errorLinks.myPosts')}
            </Link>
          )}
          {expired && (
            <Link to={paths.postEdit(post.id)} className="post-banner-link">
              {t('errorLinks.editExpiry')}
            </Link>
          )}
          {retryable && last && (
            <RetryButton error={error} busy={busy} onRetry={() => void run(last)} />
          )}
        </div>
      )}
      <CardActions>{actions.map(button)}</CardActions>
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
    </Card>
  );
}
