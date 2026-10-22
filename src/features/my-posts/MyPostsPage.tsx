import {useEffect, useState} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router';

import {errorMessage} from '@/api/errors';
import {useClosePost, useDeletePost, usePublishPost} from '@/api/mutations';
import {type InfiniteList, useInfiniteList} from '@/api/pagination';
import {useCatalog, useMyPosts} from '@/api/queries';
import type {GuildProfile, Paginated, PostStatus, PrivatePost} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {
  EmptyState,
  ErrorState,
  ExpiryLabel,
  isRetryable,
  PostStatusBadge,
  QuotaMeter,
  RelativeTime,
  RetryButton,
} from '@/components';
import {useT} from '@/i18n/useT';
import {Card, ConfirmDialog, Icon, LinkButton, SettingsLayout, Spinner, useSnackbar} from '@/ui';

import './myPosts.css';
import {countLivePosts} from './postsQuota';
import {RowMenu, type RowMenuItem} from './RowMenu';
import {useUserQuota} from './useUserQuota';

const TABS = ['all', 'published', 'draft', 'closed', 'hidden'] as const;
type Tab = (typeof TABS)[number];

const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab);

type RowAction = 'close' | 'publish' | 'delete';

/** /me/posts */
export function Component() {
  const {t} = useT('myPosts');
  usePageTitle(t('title'));
  return (
    <SettingsLayout
      title={t('title')}
      description={t('description')}
      actions={
        <LinkButton to={paths.postNew({kind: 'user'})} icon="add">
          {t('new')}
        </LinkButton>
      }
    >
      <PostsManager />
    </SettingsLayout>
  );
}

/**
 * The posts of the person (`/me/posts`) or of a server (`/guilds/:id/manage/posts`): a compact quota line,
 * status chips (`?status=`), then a card with one `InnerCard` per post.
 */
export function PostsManager({guild}: {guild?: GuildProfile}) {
  const {t} = useT('myPosts');
  const [params, setParams] = useSearchParams();
  const requested = params.get('status');
  const tab: Tab = isTab(requested) ? requested : 'all';
  const status: PostStatus | undefined = tab === 'all' ? undefined : tab;

  // My space: only my posts for myself; a server's dashboard: every post of the server.
  const list = useInfiniteList<PrivatePost, Paginated<PrivatePost>>(
    useMyPosts({status, guildId: guild?.id}, {personal: !guild}),
  );

  return (
    <>
      {guild ? <GuildQuota guildId={guild.id} /> : <UserQuota />}

      <div className="mp-filters" role="group" aria-label={t('tabsLabel')}>
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            className="mp-chip"
            aria-pressed={value === tab}
            onClick={() => setParams(value === 'all' ? {} : {status: value}, {replace: true})}
          >
            {value === tab && <Icon name="check" />}
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      <PostList list={list} tab={tab} guild={guild} />
    </>
  );
}

function UserQuota() {
  const {t} = useT('myPosts');
  const quota = useUserQuota();
  const catalog = useCatalog();
  const limit = catalog.data?.limits.max_published_posts_per_user ?? 3;
  return (
    <div className="mp-quota">
      {quota.ready ? (
        <QuotaMeter used={quota.used} limit={limit} scope="user" />
      ) : quota.list.isError ? (
        <ErrorState compact error={quota.list.error} onRetry={quota.list.refetch} />
      ) : (
        <p className="mp-quota-loading">{t('quota.loading')}</p>
      )}
    </div>
  );
}

/**
 * Published, unexpired posts of the server out of the catalog's limit. Nothing
 * while it loads or if it cannot be read (the editor enforces the quota).
 */
function GuildQuota({guildId}: {guildId: string}) {
  const {t} = useT('myPosts');
  const {data: catalog} = useCatalog();
  const published = useMyPosts({guildId, status: 'published'});
  const list = useInfiniteList<PrivatePost, Paginated<PrivatePost>>(published);

  // Expired posts stay "published" in the list: follow the pages until every one is read.
  const {hasMore, isLoadingMore, loadMore, isError} = list;
  useEffect(() => {
    if (hasMore && !isLoadingMore && !isError) loadMore();
  }, [hasMore, isLoadingMore, isError, loadMore]);

  if (!catalog || list.isError || hasMore) return null;
  return (
    <div className="mp-quota">
      {list.isLoading ? (
        <p className="mp-quota-loading">{t('quota.loading')}</p>
      ) : (
        <QuotaMeter
          used={countLivePosts(list.items)}
          limit={catalog.limits.max_published_posts_per_guild}
          scope="guild"
        />
      )}
    </div>
  );
}

function PostList({list, tab, guild}: {list: InfiniteList<PrivatePost>; tab: Tab; guild?: GuildProfile}) {
  const {t} = useT('myPosts');
  const {t: tCommon} = useT('common');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const {t: tErrors} = useT('errors');
  const close = useClosePost();
  const publish = usePublishPost();
  const remove = useDeletePost();
  const navigate = useNavigate();
  const goEdit = (id: string) => void navigate(paths.postEdit(id));

  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<{id: string; action: RowAction; error: unknown} | null>(null);
  const [toDelete, setToDelete] = useState<PrivatePost | null>(null);

  const run = async (post: PrivatePost, action: RowAction) => {
    setBusy(post.id);
    setFailure(null);
    try {
      const done = await auth.run(async () => {
        if (action === 'close') await close.mutateAsync(post.id);
        else if (action === 'publish') await publish.mutateAsync(post.id);
        else await remove.mutateAsync(post.id);
        return true;
      });
      if (done)
        snackbar.show({
          message: t(`done.${action === 'close' ? 'closed' : action === 'publish' ? 'published' : 'deleted'}`),
        });
    } catch (error) {
      setFailure({id: post.id, action, error});
    } finally {
      setBusy(null);
      setToDelete(null);
    }
  };

  if (list.isLoading)
    return (
      <Card className="mp-card">
        <Spinner />
      </Card>
    );
  if (list.isError)
    return (
      <Card className="mp-card">
        <ErrorState compact error={list.error} onRetry={list.refetch} retrying={list.isRefetching} />
      </Card>
    );
  if (list.isEmpty) {
    return (
      <Card className="mp-card">
        <EmptyState
          compact
          icon={
            tab === 'hidden'
              ? 'visibility_off'
              : tab === 'draft'
                ? 'draft'
                : tab === 'closed'
                  ? 'inventory_2'
                  : 'campaign'
          }
          title={t(`empty.${tab}.title`)}
          action={
            <LinkButton to={paths.postNew(guild ? {guildId: guild.id} : {kind: 'user'})} icon="add">
              {t('new')}
            </LinkButton>
          }
        >
          {t(`empty.${tab}.body`)}
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Card className="mp-card">
        <ul className="mp-list" aria-busy={list.isRefetching}>
          {list.items.map((post) => {
            const mine = busy === post.id;
            const error = failure?.id === post.id ? failure : null;
            const hidden = post.status === 'hidden';
            const off = mine || !canWrite;

            const menu: RowMenuItem[] = [];
            if (post.status === 'draft') {
              menu.push({key: 'edit', icon: 'edit', label: t('actions.edit'), onSelect: () => goEdit(post.id)});
            }
            if (post.status === 'published') {
              menu.push({
                key: 'close',
                icon: 'inventory_2',
                label: t('actions.close'),
                disabled: off,
                onSelect: () => void run(post, 'close'),
              });
            }
            if (post.status === 'closed') {
              menu.push({
                key: 'reopen',
                icon: 'lock_open',
                label: t('actions.reopen'),
                disabled: off,
                onSelect: () => void run(post, 'publish'),
              });
            }
            if (!hidden) {
              menu.push({
                key: 'delete',
                icon: 'delete',
                label: t('actions.delete'),
                danger: true,
                disabled: off,
                onSelect: () => setToDelete(post),
              });
            }

            return (
              <li key={post.id} className="mp-item inner-card">
                <div className="mp-line">
                  <div className="mp-main">
                    <p className="mp-title">
                      <Link to={paths.post(post.id)}>{post.title}</Link>
                    </p>
                    {/* Every row has the same owner (me, or the server of the dashboard): no name on the rows. */}
                    <p className="mp-meta">
                      <PostStatusBadge status={post.status} isExpired={post.is_expired} />
                      <RelativeTime
                        value={post.status === 'published' ? (post.published_at ?? post.created_at) : post.updated_at}
                      />
                      <ExpiryLabel expiresAt={post.expires_at} isExpired={false} />
                    </p>
                  </div>
                  {!hidden && (
                    <div className="mp-actions" role="group" aria-label={t('row.actions', {title: post.title})}>
                      {post.status === 'draft' ? (
                        <md-text-button disabled={off} onclick={() => void run(post, 'publish')}>
                          {t('actions.publish')}
                        </md-text-button>
                      ) : (
                        <LinkButton to={paths.postEdit(post.id)} variant="text">
                          {t('actions.edit')}
                        </LinkButton>
                      )}
                      <RowMenu label={post.title} items={menu} />
                    </div>
                  )}
                </div>
                {hidden && (
                  <p className="mp-note">
                    <Icon name="visibility_off" filled />
                    {post.hidden_reason ? t('row.hiddenReason', {reason: post.hidden_reason}) : t('row.hiddenNoReason')}
                  </p>
                )}
                {error && (
                  <div className="mp-error" role="alert">
                    <Icon name="error" filled />
                    <span>{errorMessage(error.error, tErrors)}</span>
                    {isRetryable(error.error) && (
                      <RetryButton error={error.error} busy={mine} onRetry={() => void run(post, error.action)} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {list.isLoadMoreError && <ErrorState compact error={list.error} onRetry={list.loadMore} />}
      {list.hasMore && !list.isLoadMoreError && (
        <div className="mp-more">
          <md-outlined-button disabled={list.isLoadingMore} onclick={list.loadMore}>
            {tCommon('actions.loadMore')}
          </md-outlined-button>
        </div>
      )}
      {list.isLoadingMore && <Spinner />}

      <ConfirmDialog
        open={toDelete !== null}
        destructive
        busy={busy !== null}
        title={t('delete.title')}
        body={t('delete.body', {title: toDelete?.title ?? ''})}
        confirmLabel={t('actions.delete')}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && void run(toDelete, 'delete')}
      />
    </>
  );
}
