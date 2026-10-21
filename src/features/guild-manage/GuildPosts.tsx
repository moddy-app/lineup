import {useState} from 'react';

import {errorMessage} from '@/api/errors';
import {useClosePost, useDeletePost, usePublishPost} from '@/api/mutations';
import {useInfiniteList} from '@/api/pagination';
import {useMyPosts} from '@/api/queries';
import type {GuildProfile, PostStatus, PrivatePost} from '@/api/types';
import {paths} from '@/app/paths';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {EmptyState, ErrorState, PostCard} from '@/components';
import {useT} from '@/i18n/useT';
import {ConfirmDialog, LinkButton, Section, Spinner, useSnackbar} from '@/ui';

const TABS: ReadonlyArray<PostStatus | 'all'> = ['all', 'published', 'draft', 'closed', 'hidden'];

/** Every post of the server, whoever wrote it, in every status. */
export function GuildPosts({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const snackbar = useSnackbar();
  const [tab, setTab] = useState<PostStatus | 'all'>('all');
  const query = useMyPosts({guildId: guild.id, status: tab === 'all' ? undefined : tab});
  const list = useInfiniteList<PrivatePost, NonNullable<typeof query.data>['pages'][number]>(query);
  const close = useClosePost();
  const publish = usePublishPost();
  const remove = useDeletePost();
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PrivatePost | null>(null);

  const act = async (post: PrivatePost, run: () => Promise<unknown>, done: string) => {
    setBusy(post.id);
    try {
      const result = await auth.run(run);
      if (result !== undefined) snackbar.show({message: done});
    } catch (error) {
      snackbar.show({message: errorMessage(error, tErrors, {context: 'manage'})});
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      title={t('posts.title')}
      actions={
        <LinkButton to={`${paths.postNew()}?guild=${encodeURIComponent(guild.id)}`} icon="add">
          {t('posts.create')}
        </LinkButton>
      }
    >
      <md-tabs
        aria-label={t('posts.tabs')}
        activeTabIndex={TABS.indexOf(tab)}
        onchange={(event) => setTab(TABS[event.currentTarget.activeTabIndex] ?? 'all')}
      >
        {TABS.map((status) => (
          <md-primary-tab key={status} id={`manage-tab-${status}`} aria-controls="manage-posts-panel">
            {t(`posts.tab.${status}`)}
          </md-primary-tab>
        ))}
      </md-tabs>
      <div id="manage-posts-panel" role="tabpanel" aria-labelledby={`manage-tab-${tab}`} className="manage-posts">
        {list.isLoading ? (
          <Spinner />
        ) : list.isError ? (
          <ErrorState compact error={list.error} onRetry={list.refetch} />
        ) : list.isEmpty ? (
          <EmptyState compact icon="campaign" title={t('posts.emptyTitle')}>
            {tab === 'all' ? t('posts.emptyAll') : t('posts.emptyTab')}
          </EmptyState>
        ) : (
          <>
            <ul className="manage-post-list">
              {list.items.map((post) => (
                <li key={post.id} className="manage-post">
                  <PostCard post={post} variant="row" showStatus />
                  {post.status === 'hidden' ? (
                    <p className="manage-help">{t('posts.hidden')}</p>
                  ) : (
                    <div className="manage-post-actions">
                      <LinkButton to={paths.postEdit(post.id)} variant="text" icon="edit">
                        {t('posts.edit')}
                      </LinkButton>
                      {post.status === 'published' ? (
                        <md-text-button
                          disabled={!canWrite || busy === post.id}
                          onclick={() => void act(post, () => close.mutateAsync(post.id), t('posts.closed'))}
                        >
                          <md-icon slot="icon" className="filled" aria-hidden="true">
                            lock
                          </md-icon>
                          {t('posts.close')}
                        </md-text-button>
                      ) : (
                        <md-text-button
                          disabled={!canWrite || busy === post.id}
                          onclick={() => void act(post, () => publish.mutateAsync(post.id), t('posts.published'))}
                        >
                          <md-icon slot="icon" className="filled" aria-hidden="true">
                            {post.status === 'closed' ? 'lock_open' : 'publish'}
                          </md-icon>
                          {post.status === 'closed' ? t('posts.reopen') : t('posts.publish')}
                        </md-text-button>
                      )}
                      <md-text-button disabled={!canWrite || busy === post.id} onclick={() => setToDelete(post)}>
                        <md-icon slot="icon" className="filled" aria-hidden="true">
                          delete
                        </md-icon>
                        {t('posts.delete')}
                      </md-text-button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {list.isLoadMoreError && <ErrorState compact error={query.error} onRetry={list.loadMore} />}
            {(list.hasMore || list.isLoadingMore) && !list.isLoadMoreError && (
              <div className="manage-more">
                {list.isLoadingMore ? (
                  <Spinner />
                ) : (
                  <md-outlined-button onclick={list.loadMore}>{tCommon('actions.loadMore')}</md-outlined-button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={toDelete !== null}
        destructive
        title={t('posts.deleteTitle')}
        body={<p>{t('posts.deleteBody', {title: toDelete?.title ?? ''})}</p>}
        confirmLabel={t('posts.delete')}
        busy={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const post = toDelete;
          if (!post) return;
          setToDelete(null);
          void act(post, async () => (await remove.mutateAsync(post.id), true), t('posts.deleted'));
        }}
      />
    </Section>
  );
}
