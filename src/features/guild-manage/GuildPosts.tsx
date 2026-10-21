import type {MdMenu} from '@material/web/menu/menu.js';
import {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router';

import {errorMessage} from '@/api/errors';
import {useClosePost, useDeletePost, usePublishPost} from '@/api/mutations';
import {useInfiniteList} from '@/api/pagination';
import {useCatalog, useMyPosts} from '@/api/queries';
import type {GuildProfile, PostStatus, PrivatePost} from '@/api/types';
import {paths} from '@/app/paths';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {EmptyState, ErrorState, PostStatusBadge, QuotaMeter, RelativeTime} from '@/components';
import {useT} from '@/i18n/useT';
import {ConfirmDialog, Icon, LinkButton, SettingsPanel, Spinner, useSnackbar} from '@/ui';

import {countLivePosts} from './postsQuota';
import {SECTION_IDS} from './sectionIds';

const FILTERS: ReadonlyArray<PostStatus | 'all'> = ['all', 'published', 'draft', 'closed', 'hidden'];

/** Every post of the server, whoever wrote it, in every status. */
export function GuildPosts({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostStatus | 'all'>('all');
  const query = useMyPosts({guildId: guild.id, status: filter === 'all' ? undefined : filter});
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
    <>
      <SettingsPanel id={SECTION_IDS.posts} className="manage-panel" title={t('posts.title')}>
        <div className="manage-posts-head">
          <div className="manage-filters" role="group" aria-label={t('posts.filters')}>
            {FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                className="manage-filter"
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {t(`posts.filter.${status}`)}
              </button>
            ))}
          </div>
          <LinkButton to={`${paths.postNew()}?guild=${encodeURIComponent(guild.id)}`} variant="outlined" icon="add">
            {t('posts.create')}
          </LinkButton>
        </div>
        <GuildQuota guildId={guild.id} />
        {list.isLoading ? (
          <Spinner />
        ) : list.isError ? (
          <ErrorState compact error={list.error} onRetry={list.refetch} />
        ) : list.isEmpty ? (
          <EmptyState compact icon="campaign" title={t('posts.emptyTitle')}>
            {filter === 'all' ? t('posts.emptyAll') : t('posts.emptyTab')}
          </EmptyState>
        ) : (
          <>
            <ul className="manage-post-list">
              {list.items.map((post) => (
                <li key={post.id} className="manage-post inner-card">
                  <Link to={paths.post(post.id)} className="manage-post-title">
                    {post.title}
                  </Link>
                  <span className="manage-post-status">
                    <PostStatusBadge status={post.status} isExpired={post.is_expired} />
                  </span>
                  <RelativeTime className="manage-post-date" value={post.published_at ?? post.created_at} />
                  {post.status === 'hidden' ? (
                    <span className="manage-post-locked" title={t('posts.hidden')}>
                      <Icon name="lock" label={t('posts.hidden')} />
                    </span>
                  ) : (
                    <PostMenu label={t('posts.menu', {title: post.title})} disabled={busy === post.id}>
                      <md-menu-item onclick={() => void navigate(paths.postEdit(post.id))}>
                        <md-icon slot="start">edit</md-icon>
                        <div slot="headline">{t('posts.edit')}</div>
                      </md-menu-item>
                      {post.status === 'published' ? (
                        <md-menu-item
                          disabled={!canWrite}
                          onclick={() => void act(post, () => close.mutateAsync(post.id), t('posts.closed'))}
                        >
                          <md-icon slot="start">lock</md-icon>
                          <div slot="headline">{t('posts.close')}</div>
                        </md-menu-item>
                      ) : (
                        <md-menu-item
                          disabled={!canWrite}
                          onclick={() => void act(post, () => publish.mutateAsync(post.id), t('posts.published'))}
                        >
                          <md-icon slot="start">{post.status === 'closed' ? 'lock_open' : 'publish'}</md-icon>
                          <div slot="headline">{post.status === 'closed' ? t('posts.reopen') : t('posts.publish')}</div>
                        </md-menu-item>
                      )}
                      <md-menu-item disabled={!canWrite} onclick={() => setToDelete(post)}>
                        <md-icon slot="start">delete</md-icon>
                        <div slot="headline">{t('posts.delete')}</div>
                      </md-menu-item>
                    </PostMenu>
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
      </SettingsPanel>
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
    </>
  );
}

/**
 * Published, unexpired posts of the server out of the catalog's limit. Nothing
 * while it loads or if it cannot be read (the editor enforces the quota).
 */
function GuildQuota({guildId}: {guildId: string}) {
  const {data: catalog} = useCatalog();
  const published = useMyPosts({guildId, status: 'published'});
  const list = useInfiniteList<PrivatePost, NonNullable<typeof published.data>['pages'][number]>(published);

  // Expired posts stay "published" in the list: follow the pages until every one is read.
  const {hasMore, isLoadingMore, loadMore, isError} = list;
  useEffect(() => {
    if (hasMore && !isLoadingMore && !isError) loadMore();
  }, [hasMore, isLoadingMore, isError, loadMore]);

  if (!catalog || list.isLoading || list.isError || hasMore) return null;
  return (
    <QuotaMeter
      className="manage-quota"
      used={countLivePosts(list.items)}
      limit={catalog.limits.max_published_posts_per_guild}
      scope="guild"
    />
  );
}

interface PostMenuProps {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

/** The actions of one row, behind a "more" button. */
function PostMenu({label, disabled, children}: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuRef = useRef<MdMenu | null>(null);

  useLayoutEffect(() => {
    if (menuRef.current) menuRef.current.anchorElement = anchor;
  }, [anchor]);

  return (
    <span className="manage-menu-wrap">
      <md-icon-button
        ref={setAnchor}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onclick={() => setOpen((previous) => !previous)}
      >
        <Icon name="more_vert" />
      </md-icon-button>
      <md-menu ref={menuRef} open={open} onclose={() => setOpen(false)} className="manage-menu">
        {children}
      </md-menu>
    </span>
  );
}
