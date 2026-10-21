import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useCatalog, useFeed, useMyPosts} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import {useInfiniteList} from '@/api/pagination';
import type {Catalog, Post} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useSession} from '@/auth/session';
import {EmptyState, ErrorState, PostCard, QuotaMeter, useNsfwConfirmed} from '@/components';
import {useT} from '@/i18n/useT';
import {Bento, Card, CardActions, Dialog, Icon, LinkButton, Page, Spinner, Stack} from '@/ui';

import {
  activeFilterCount,
  effectiveFilters,
  parseFeedParams,
  serializeFeedFilters,
  type UiFilters,
} from './feedFilters';
import {FiltersPanel} from './FiltersPanel';
import {useMediaQuery} from './useMediaQuery';
import './feed.css';

/** Same breakpoint as the bento: the side column goes under the main one. */
const WIDE = '(min-width: 1101px)';

export function Component() {
  const {t} = useT('feed');
  const catalog = useCatalog();
  usePageTitle(t('title'));

  if (catalog.data) return <FeedContent catalog={catalog.data} />;
  return (
    <Page>
      <Bento>
        <Stack span={8}>
          {catalog.isError ? (
            <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
          ) : (
            <Card className="feed-head">
              <h1 className="feed-title">{t('title')}</h1>
              <Spinner />
            </Card>
          )}
        </Stack>
      </Bento>
    </Page>
  );
}

function FeedContent({catalog}: {catalog: Catalog}) {
  const {t} = useT('feed');
  const wide = useMediaQuery(WIDE);
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Parsing returns a new object each render; the string key keeps the identity steady.
  const paramsKey = params.toString();
  const filters = useMemo(() => parseFeedParams(new URLSearchParams(paramsKey), catalog), [paramsKey, catalog]);
  const active = activeFilterCount(filters);

  const update = useCallback(
    (patch: Partial<UiFilters>, options?: {replace?: boolean}) => {
      setParams(
        (current) => {
          const next = {...parseFeedParams(current, catalog), ...patch};
          return serializeFeedFilters(next);
        },
        {replace: options?.replace ?? false},
      );
    },
    [setParams, catalog],
  );
  const reset = useCallback(() => setParams(new URLSearchParams(), {replace: false}), [setParams]);

  const panel = (
    <FiltersPanel catalog={catalog} filters={filters} onChange={update} onReset={reset} active={active} />
  );

  return (
    <Page>
      <Bento>
        <Stack span={8}>
          <Card className="feed-head">
            <div className="feed-head-text">
              <h1 className="feed-title">{t('title')}</h1>
              <p>{t('intro')}</p>
            </div>
            {!wide && (
              <CardActions>
                <PublishButton />
                <md-outlined-button onclick={() => setFiltersOpen(true)}>
                  <md-icon slot="icon" className="filled" aria-hidden="true">
                    tune
                  </md-icon>
                  {active > 0 ? t('filters.openCount', {count: active}) : t('filters.open')}
                </md-outlined-button>
              </CardActions>
            )}
          </Card>
          {!wide && <QuotaCard compact />}
          <FeedList filters={filters} active={active} onReset={reset} />
        </Stack>

        {wide && (
          <Stack span={4} sticky>
            <Card className="publish-card">
              <h2>{t('publish.title')}</h2>
              <p>{t('publish.body')}</p>
              <QuotaCard inline />
              <CardActions>
                <PublishButton />
              </CardActions>
            </Card>
            <Card className="filters-card" aria-labelledby="filters-title">
              <h2 id="filters-title">{t('filters.title')}</h2>
              {panel}
            </Card>
          </Stack>
        )}
      </Bento>

      {!wide && (
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          className="filters-dialog"
          headline={t('filters.title')}
          actions={<md-filled-button onclick={() => setFiltersOpen(false)}>{t('filters.show')}</md-filled-button>}
        >
          {filtersOpen && panel}
        </Dialog>
      )}
    </Page>
  );
}

/** The primary action. Signed out, it goes through Discord and lands on the editor. */
function PublishButton() {
  const {t} = useT('feed');
  const {status, login} = useSession();
  if (status === 'anonymous') {
    return (
      <md-filled-button onclick={() => login(paths.postNew())}>
        <md-icon slot="icon" className="filled" aria-hidden="true">
          edit_square
        </md-icon>
        {t('publish.action')}
      </md-filled-button>
    );
  }
  return (
    <LinkButton to={paths.postNew()} icon="edit_square" disabled={status === 'suspended'}>
      {t('publish.action')}
    </LinkButton>
  );
}

/**
 * The person's own quota: their published, unexpired `user` posts out of the
 * catalog's limit. Nothing for a visitor, nothing while it loads or if it
 * cannot be read (the quota is a convenience here, the editor enforces it).
 */
function QuotaCard({compact, inline}: {compact?: boolean; inline?: boolean}) {
  const {status} = useSession();
  const {data: catalog} = useCatalog();
  const mine = useMyPosts({status: 'published'});
  const list = useInfiniteList<Post, NonNullable<typeof mine.data>['pages'][number]>(mine);

  // Expired posts stay "published" in the list: follow the pages until every one is read.
  const {hasMore, isLoadingMore, loadMore, isError} = list;
  useEffect(() => {
    if (status === 'authenticated' && hasMore && !isLoadingMore && !isError) loadMore();
  }, [status, hasMore, isLoadingMore, isError, loadMore]);

  if (status !== 'authenticated' || !catalog || list.isLoading || list.isError || hasMore) return null;
  const used = list.items.filter((post) => post.kind === 'user' && post.status === 'published' && !post.is_expired).length;
  const meter = <QuotaMeter used={used} limit={catalog.limits.max_published_posts_per_user} scope="user" />;
  if (inline) return meter;
  return compact ? <Card className="quota-card">{meter}</Card> : meter;
}

function FeedList({filters, active, onReset}: {filters: UiFilters; active: number; onReset: () => void}) {
  const {t} = useT('feed');
  const {t: tCommon} = useT('common');
  const {t: tErrors} = useT('errors');
  const {confirmed} = useNsfwConfirmed();
  const queryClient = useQueryClient();
  const query = useFeed(effectiveFilters(filters, confirmed));
  const list = useInfiniteList<Post, NonNullable<typeof query.data>['pages'][number]>(query);

  // The sentinel: load the next page when it comes near the screen.
  const sentinel = useRef<HTMLDivElement>(null);
  const {hasMore, isLoadingMore, isLoadMoreError, loadMore} = list;
  const itemCount = list.items.length;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || isLoadingMore || isLoadMoreError || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      {rootMargin: '400px 0px'},
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadMoreError, loadMore, itemCount]);

  const startOver = () => void queryClient.resetQueries({queryKey: queryKeys.feeds()});

  if (list.isLoading) {
    return (
      <Card aria-busy="true">
        <Spinner />
      </Card>
    );
  }

  if (list.isError) {
    if (hasCode(list.error, 'lineup_filter_invalid', 'cursor_invalid')) {
      return (
        <EmptyState
          icon="filter_alt_off"
          title={t('invalid.title')}
          action={
            <md-filled-button onclick={active > 0 ? onReset : startOver}>
              {active > 0 ? t('filters.reset') : t('invalid.restart')}
            </md-filled-button>
          }
        >
          {errorMessage(list.error, tErrors)}
        </EmptyState>
      );
    }
    return <ErrorState error={list.error} onRetry={list.refetch} retrying={query.isFetching} />;
  }

  if (list.isEmpty) {
    return active > 0 ? (
      <EmptyState
        icon="search_off"
        title={t('empty.filteredTitle')}
        action={
          <md-filled-button onclick={onReset}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              filter_alt_off
            </md-icon>
            {t('filters.reset')}
          </md-filled-button>
        }
      >
        {t('empty.filteredBody')}
      </EmptyState>
    ) : (
      <EmptyState icon="campaign" title={t('empty.noneTitle')} action={<PublishButton />}>
        {t('empty.noneBody')}
      </EmptyState>
    );
  }

  return (
    <>
      <p className="visually-hidden" role="status">
        {list.isPlaceholderData ? t('updating') : ''}
      </p>
      <ul className="feed-list" aria-label={t('list')} aria-busy={list.isPlaceholderData || undefined}>
        {list.items.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>

      {isLoadMoreError && (
        <Card className="feed-more-error">
          <p role="alert">
            <Icon name="error" filled />
            {errorMessage(list.error, tErrors)}
          </p>
          <CardActions>
            {hasCode(list.error, 'cursor_invalid') ? (
              <md-outlined-button onclick={startOver}>{t('invalid.restart')}</md-outlined-button>
            ) : (
              <md-outlined-button onclick={loadMore}>{tCommon('actions.retry')}</md-outlined-button>
            )}
          </CardActions>
        </Card>
      )}

      {hasMore && !isLoadMoreError && (
        <div ref={sentinel} className="feed-more">
          {isLoadingMore ? (
            <Spinner label={t('loadingMore')} />
          ) : (
            <md-outlined-button onclick={loadMore}>{tCommon('actions.loadMore')}</md-outlined-button>
          )}
        </div>
      )}
      {!hasMore && itemCount > 0 && <p className="feed-end">{t('end', {count: itemCount})}</p>}
    </>
  );
}
