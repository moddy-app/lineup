import {useState} from 'react';
import {useSearchParams} from 'react-router';

import {errorMessage} from '@/api/errors';
import {useClosePost, useDeletePost, usePublishPost} from '@/api/mutations';
import {type InfiniteList, useInfiniteList} from '@/api/pagination';
import {useCatalog, useMyPosts} from '@/api/queries';
import type {Paginated, PostStatus, PrivatePost} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {EmptyState, ErrorState, isRetryable, PostCard, QuotaMeter, RetryButton} from '@/components';
import {useT} from '@/i18n/useT';
import {AppLayout, Card, ConfirmDialog, Icon, LinkButton, Rows, Section, Spinner, useSnackbar} from '@/ui';

import './myPosts.css';
import {useUserQuota} from './useUserQuota';

const TABS = ['all', 'published', 'draft', 'closed', 'hidden'] as const;
type Tab = (typeof TABS)[number];

const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab);

type RowAction = 'close' | 'publish' | 'delete';

/** /me/posts */
export function Component() {
  const {t} = useT('myPosts');
  usePageTitle(t('title'));
  const [params, setParams] = useSearchParams();
  const requested = params.get('status');
  const tab: Tab = isTab(requested) ? requested : 'all';
  const status: PostStatus | undefined = tab === 'all' ? undefined : tab;

  const list = useInfiniteList<PrivatePost, Paginated<PrivatePost>>(useMyPosts({status}));
  const quota = useUserQuota();
  const catalog = useCatalog();
  const limit = catalog.data?.limits.max_published_posts_per_user ?? 3;
  const guildLimit = catalog.data?.limits.max_published_posts_per_guild ?? 5;

  return (
    <AppLayout
      stickyAside
      aside={
        <Card className="mp-quota">
          <h2>{t('quota.title')}</h2>
          {quota.ready ? (
            <QuotaMeter used={quota.used} limit={limit} scope="user" />
          ) : quota.list.isError ? (
            <ErrorState compact error={quota.list.error} onRetry={quota.list.refetch} />
          ) : (
            <p>{t('quota.loading')}</p>
          )}
          <p>{t('quota.body', {guildLimit})}</p>
        </Card>
      }
    >
      <Section
        level={1}
        title={t('title')}
        actions={
          <LinkButton to={paths.postNew()} icon="add">
            {t('new')}
          </LinkButton>
        }
      >
        <p className="mp-intro">{t('intro')}</p>
        <md-tabs
          aria-label={t('tabsLabel')}
          activeTabIndex={TABS.indexOf(tab)}
          onchange={(event) => {
            const next = TABS[event.currentTarget.activeTabIndex] ?? 'all';
            setParams(next === 'all' ? {} : {status: next}, {replace: true});
          }}
        >
          {TABS.map((value) => (
            <md-primary-tab key={value} id={`mp-tab-${value}`} aria-controls="mp-panel">
              {t(`tabs.${value}`)}
            </md-primary-tab>
          ))}
        </md-tabs>
        <div id="mp-panel" role="tabpanel" aria-labelledby={`mp-tab-${tab}`}>
          <PostList list={list} tab={tab} />
        </div>
      </Section>
    </AppLayout>
  );
}

function PostList({list, tab}: {list: InfiniteList<PrivatePost>; tab: Tab}) {
  const {t} = useT('myPosts');
  const {t: tCommon} = useT('common');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const {t: tErrors} = useT('errors');
  const close = useClosePost();
  const publish = usePublishPost();
  const remove = useDeletePost();

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
      if (done) snackbar.show({message: t(`done.${action === 'close' ? 'closed' : action === 'publish' ? 'published' : 'deleted'}`)});
    } catch (error) {
      setFailure({id: post.id, action, error});
    } finally {
      setBusy(null);
      setToDelete(null);
    }
  };

  if (list.isLoading) return <Spinner />;
  if (list.isError) return <ErrorState compact error={list.error} onRetry={list.refetch} retrying={list.isRefetching} />;
  if (list.isEmpty) {
    return (
      <EmptyState
        compact
        icon={tab === 'hidden' ? 'visibility_off' : tab === 'draft' ? 'draft' : tab === 'closed' ? 'inventory_2' : 'campaign'}
        title={t(`empty.${tab}.title`)}
        action={
          <LinkButton to={paths.postNew()} icon="add">
            {t('new')}
          </LinkButton>
        }
      >
        {t(`empty.${tab}.body`)}
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="mp-list" aria-busy={list.isRefetching}>
        {list.items.map((post) => {
          const mine = busy === post.id;
          const error = failure?.id === post.id ? failure : null;
          const editable = post.status !== 'hidden';
          return (
            <li key={post.id} className="mp-item">
              <Rows>
                <PostCard post={post} variant="row" showStatus />
              </Rows>
              {post.status === 'hidden' && (
                <p className="mp-note is-error">
                  <Icon name="visibility_off" filled />
                  {post.hidden_reason
                    ? t('row.hiddenReason', {reason: post.hidden_reason})
                    : t('row.hiddenNoReason')}
                </p>
              )}
              {post.status === 'published' && post.is_expired && (
                <p className="mp-note">
                  <Icon name="event_busy" filled />
                  {t('row.expired')}
                </p>
              )}
              {editable && (
                <div className="mp-actions" role="group" aria-label={t('row.actions', {title: post.title})}>
                  <LinkButton to={paths.postEdit(post.id)} variant="outlined" icon="edit">
                    {t('actions.edit')}
                  </LinkButton>
                  {post.status === 'published' && (
                    <md-outlined-button disabled={mine || !canWrite} onclick={() => void run(post, 'close')}>
                      <md-icon slot="icon" className="filled" aria-hidden="true">
                        inventory_2
                      </md-icon>
                      {t('actions.close')}
                    </md-outlined-button>
                  )}
                  {(post.status === 'draft' || post.status === 'closed') && (
                    <md-outlined-button disabled={mine || !canWrite} onclick={() => void run(post, 'publish')}>
                      <md-icon slot="icon" className="filled" aria-hidden="true">
                        publish
                      </md-icon>
                      {post.status === 'closed' ? t('actions.republish') : t('actions.publish')}
                    </md-outlined-button>
                  )}
                  <md-text-button className="mp-delete" disabled={mine || !canWrite} onclick={() => setToDelete(post)}>
                    <md-icon slot="icon" className="filled" aria-hidden="true">
                      delete
                    </md-icon>
                    {t('actions.delete')}
                  </md-text-button>
                </div>
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
