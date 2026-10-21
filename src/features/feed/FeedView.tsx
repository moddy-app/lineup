import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Navigate, useSearchParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {FIELD_LIMITS} from '@/api/limits';
import {useInfiniteList} from '@/api/pagination';
import {useCatalog, useFeed} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import type {Catalog, Post, PostKind} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useSession} from '@/auth/session';
import {
  EmptyState,
  ErrorState,
  FilterBar,
  type FilterDefinition,
  NsfwConfirmDialog,
  PostCard,
  useNsfwConfirmed,
} from '@/components';
import {useT} from '@/i18n/useT';
import {Icon, LinkButton, PageHeader, ShowcasePage, Spinner} from '@/ui';

import {
  activeFilterCount,
  effectiveFilters,
  filterableThemes,
  legacyKindRedirect,
  parseFeedParams,
  SEARCH_DEBOUNCE_MS,
  serializeFeedFilters,
  type UiFilters,
} from './feedFilters';
import {useDebouncedField} from './useDebouncedField';
import './feed.css';

const pathOf = (kind: PostKind) => (kind === 'guild' ? paths.feed() : paths.people());

/**
 * The two lists of posts, one component: `guild` is "Projets" (servers
 * that recruit, `/`), `user` is "Profils" (people who offer their services,
 * `/people`). The route fixes the kind; the other filters live in the URL.
 */
export function FeedView({kind}: {kind: PostKind}) {
  const {t} = useT('feed');
  const [params] = useSearchParams();
  const catalog = useCatalog();
  usePageTitle(t(`${kind}.title`));

  // An old address (`/?type=user`) goes to the page of that kind, other filters kept.
  const redirect = legacyKindRedirect(params, kind);
  if (redirect) {
    const search = redirect.search.toString();
    return <Navigate replace to={{pathname: pathOf(redirect.kind), search: search ? `?${search}` : ''}} />;
  }

  if (catalog.data) return <FeedContent kind={kind} catalog={catalog.data} />;
  return (
    <ShowcasePage className="feed-page">
      <FeedHeader kind={kind} />
      {catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
      ) : (
        <div className="feed-state" aria-busy="true">
          <Spinner />
        </div>
      )}
    </ShowcasePage>
  );
}

/** The title, one line, and the main action. */
function FeedHeader({kind}: {kind: PostKind}) {
  const {t} = useT('feed');
  return (
    <PageHeader title={t(`${kind}.title`)} subtitle={t(`${kind}.subtitle`)} actions={<PublishButton kind={kind} />} />
  );
}

/** The primary action. Signed out, it goes through Discord and lands on the editor. */
function PublishButton({kind}: {kind: PostKind}) {
  const {t} = useT('feed');
  const {status, login} = useSession();
  const label = t(`${kind}.action`);
  if (status === 'anonymous') {
    return (
      <md-filled-button onclick={() => login(paths.postNew({kind: kind === 'user' ? 'user' : 'guild'}))}>
        <md-icon slot="icon" className="filled" aria-hidden="true">
          edit_square
        </md-icon>
        {label}
      </md-filled-button>
    );
  }
  return (
    <LinkButton
      to={paths.postNew({kind: kind === 'user' ? 'user' : 'guild'})}
      icon="edit_square"
      disabled={status === 'suspended'}
    >
      {label}
    </LinkButton>
  );
}

type FilterKey = 'positions' | 'languages' | 'theme' | 'compensation' | 'nsfw';

function FeedContent({kind, catalog}: {kind: PostKind; catalog: Catalog}) {
  const {t} = useT('feed');
  const {label} = useCatalogLabel();
  const {confirmed} = useNsfwConfirmed();
  const [params, setParams] = useSearchParams();
  const [confirming, setConfirming] = useState(false);

  // Parsing returns a new object each render; the string key keeps the identity steady.
  const paramsKey = params.toString();
  const filters = useMemo(() => parseFeedParams(new URLSearchParams(paramsKey), catalog), [paramsKey, catalog]);
  const active = activeFilterCount(filters);

  const update = useCallback(
    (patch: Partial<UiFilters>, options?: {replace?: boolean}) => {
      setParams((current) => serializeFeedFilters({...parseFeedParams(current, catalog), ...patch}), {
        replace: options?.replace ?? false,
      });
    },
    [setParams, catalog],
  );
  const reset = useCallback(() => setParams(new URLSearchParams(), {replace: false}), [setParams]);

  const [q, setQ] = useDebouncedField(
    filters.q ?? '',
    (next) => update({q: next.trim() || undefined}, {replace: true}),
    SEARCH_DEBOUNCE_MS,
  );

  const list = (values: readonly string[], max?: number) => {
    const next = max ? values.slice(0, max) : [...values];
    return next.length > 0 ? next : undefined;
  };
  const options = (ids: readonly string[], type: 'positions' | 'languages' | 'themes' | 'compensations') =>
    ids.map((id) => ({value: id, label: label(type, id)}));

  const definitions: Record<FilterKey, FilterDefinition> = {
    positions: {
      icon: 'work',
      label: t('filters.positions'),
      kind: 'multi',
      options: options(
        catalog.positions.map((entry) => entry.id),
        'positions',
      ),
      value: filters.positions ?? [],
      onChange: (values) => update({positions: list(values, FIELD_LIMITS.query.feedPositionsMax)}),
    },
    languages: {
      icon: 'translate',
      label: t('filters.languages'),
      kind: 'multi',
      options: options(
        catalog.languages.map((entry) => entry.id),
        'languages',
      ),
      value: filters.languages ?? [],
      onChange: (values) => update({languages: list(values)}),
    },
    theme: {
      icon: 'palette',
      label: t('filters.theme'),
      kind: 'single',
      options: options(
        filterableThemes(catalog).map((entry) => entry.id),
        'themes',
      ),
      value: filters.theme ? [filters.theme] : [],
      onChange: (values) => update({theme: values[0]}),
    },
    compensation: {
      icon: 'payments',
      label: t('filters.compensation'),
      kind: 'single',
      options: options(
        catalog.compensations.map((entry) => entry.id),
        'compensations',
      ),
      value: filters.compensation ? [filters.compensation] : [],
      onChange: (values) => update({compensation: values[0]}),
    },
    nsfw: {
      icon: 'explicit',
      label: t('filters.nsfw'),
      kind: 'single',
      options: [
        {value: 'hide', label: t('filters.nsfwHide'), icon: 'visibility_off'},
        {value: 'show', label: t('filters.nsfwShow'), icon: 'visibility'},
      ],
      // Shown only once the age is confirmed; "hide" is the default and is not a value.
      value: filters.include_nsfw === true && confirmed ? ['show'] : [],
      onChange: (values) => {
        if (values[0] !== 'show') update({include_nsfw: undefined});
        else if (confirmed) update({include_nsfw: true});
        else setConfirming(true);
      },
    },
  };

  return (
    <ShowcasePage className="feed-page">
      <FeedHeader kind={kind} />
      <FilterBar search={{value: q, onChange: setQ, placeholder: t('filters.search')}} filters={definitions} />
      <FeedList kind={kind} filters={filters} active={active} onReset={reset} />
      <NsfwConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirmed={() => {
          setConfirming(false);
          update({include_nsfw: true});
        }}
      />
    </ShowcasePage>
  );
}

function FeedList({
  kind,
  filters,
  active,
  onReset,
}: {
  kind: PostKind;
  filters: UiFilters;
  active: number;
  onReset: () => void;
}) {
  const {t} = useT('feed');
  const {t: tCommon} = useT('common');
  const {t: tErrors} = useT('errors');
  const {confirmed} = useNsfwConfirmed();
  const queryClient = useQueryClient();
  const query = useFeed(effectiveFilters(filters, kind, confirmed));
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
      <div className="feed-state" aria-busy="true">
        <Spinner />
      </div>
    );
  }

  if (list.isError) {
    if (hasCode(list.error, 'lineup_filter_invalid', 'cursor_invalid')) {
      return (
        <EmptyState
          compact
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
        compact
        icon="search_off"
        title={t('empty.filteredTitle')}
        action={
          <md-outlined-button onclick={onReset}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              filter_alt_off
            </md-icon>
            {t('filters.reset')}
          </md-outlined-button>
        }
      >
        {t('empty.filteredBody')}
      </EmptyState>
    ) : (
      <EmptyState compact icon={kind === 'guild' ? 'rocket_launch' : 'badge'} title={t(`${kind}.emptyTitle`)}>
        {t(`${kind}.emptyBody`)}
      </EmptyState>
    );
  }

  return (
    <>
      <p className="visually-hidden" role="status">
        {list.isPlaceholderData ? t('updating') : ''}
      </p>
      <h2 className="visually-hidden">{t('list')}</h2>
      <ul className="feed-grid" aria-label={t('list')} aria-busy={list.isPlaceholderData || undefined}>
        {list.items.map((post) => (
          <li key={post.id}>
            <PostCard post={post} variant="tile" />
          </li>
        ))}
      </ul>

      {isLoadMoreError && (
        <div className="feed-more">
          <p className="feed-more-error" role="alert">
            <Icon name="error" filled />
            {errorMessage(list.error, tErrors)}
          </p>
          {hasCode(list.error, 'cursor_invalid') ? (
            <md-outlined-button onclick={startOver}>{t('invalid.restart')}</md-outlined-button>
          ) : (
            <md-outlined-button onclick={loadMore}>{tCommon('actions.retry')}</md-outlined-button>
          )}
        </div>
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
