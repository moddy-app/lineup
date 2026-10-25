import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useInfiniteList} from '@/api/pagination';
import {useBots, useCatalog} from '@/api/queries';
import type {BotCard, BotDirectoryFilters, Catalog} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useSession} from '@/auth/session';
import {
  BotTile,
  EmptyState,
  ErrorState,
  FilterBar,
  type FilterDefinition,
  NsfwConfirmDialog,
  useNsfwConfirmed,
} from '@/components';
import {useT} from '@/i18n/useT';
import {Icon, LinkButton, PageHeader, ShowcasePage, Spinner} from '@/ui';

import {filterableThemes, SEARCH_DEBOUNCE_MS} from '../feed/feedFilters';
import {useDebouncedField} from '../feed/useDebouncedField';
import {effectiveBotFilters, parseBotParams, serializeBotFilters} from './botFilters';
import '../feed/feed.css';
import './bots.css';

/** `/bots`: the directory of the bots on Lineup (search, theme, adult content). */
export function Component() {
  const {t} = useT('bots');
  const catalog = useCatalog();
  usePageTitle(t('directory.title'));
  if (catalog.data) return <Directory catalog={catalog.data} />;
  return (
    <ShowcasePage className="bots-page">
      <DirectoryHeader />
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

/** The title, one line, and "Add a bot" (through Discord when signed out). */
function DirectoryHeader() {
  const {t} = useT('bots');
  const {status, login} = useSession();
  return (
    <PageHeader
      title={t('directory.title')}
      subtitle={t('directory.subtitle')}
      actions={
        status === 'anonymous' ? (
          <md-filled-button onclick={() => login(paths.botClaim())}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              add
            </md-icon>
            {t('directory.add')}
          </md-filled-button>
        ) : (
          <LinkButton to={paths.botClaim()} icon="add" disabled={status === 'suspended'}>
            {t('directory.add')}
          </LinkButton>
        )
      }
    />
  );
}

type FilterKey = 'theme' | 'nsfw';

function Directory({catalog}: {catalog: Catalog}) {
  const {t} = useT('bots');
  const {t: tFeed} = useT('feed');
  const {label} = useCatalogLabel();
  const {confirmed} = useNsfwConfirmed();
  const [params, setParams] = useSearchParams();
  const [confirming, setConfirming] = useState(false);

  const paramsKey = params.toString();
  const filters = useMemo(() => parseBotParams(new URLSearchParams(paramsKey), catalog), [paramsKey, catalog]);
  const active = [filters.q, filters.theme, filters.include_nsfw].filter(Boolean).length;

  const update = useCallback(
    (patch: Partial<BotDirectoryFilters>, options?: {replace?: boolean}) =>
      setParams((current) => serializeBotFilters({...parseBotParams(current, catalog), ...patch}), {
        replace: options?.replace ?? false,
      }),
    [setParams, catalog],
  );
  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams]);
  const [q, setQ] = useDebouncedField(
    filters.q ?? '',
    (next) => update({q: next.trim() || undefined}, {replace: true}),
    SEARCH_DEBOUNCE_MS,
  );

  const definitions: Record<FilterKey, FilterDefinition> = {
    theme: {
      icon: 'palette',
      label: tFeed('filters.theme'),
      kind: 'single',
      options: filterableThemes(catalog).map((entry) => ({value: entry.id, label: label('themes', entry.id)})),
      value: filters.theme ? [filters.theme] : [],
      onChange: (values) => update({theme: values[0]}),
    },
    nsfw: {
      icon: 'explicit',
      label: tFeed('filters.nsfw'),
      kind: 'single',
      options: [
        {value: 'hide', label: tFeed('filters.nsfwHide'), icon: 'visibility_off'},
        {value: 'show', label: tFeed('filters.nsfwShow'), icon: 'visibility'},
      ],
      value: filters.include_nsfw === true && confirmed ? ['show'] : [],
      onChange: (values) => {
        if (values[0] !== 'show') update({include_nsfw: undefined});
        else if (confirmed) update({include_nsfw: true});
        else setConfirming(true);
      },
    },
  };

  return (
    <ShowcasePage className="bots-page">
      <DirectoryHeader />
      <FilterBar search={{value: q, onChange: setQ, placeholder: t('directory.search')}} filters={definitions} />
      <BotList filters={effectiveBotFilters(filters, confirmed)} active={active} onReset={reset} />
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

function BotList({filters, active, onReset}: {filters: BotDirectoryFilters; active: number; onReset: () => void}) {
  const {t} = useT('bots');
  const {t: tFeed} = useT('feed');
  const {t: tCommon} = useT('common');
  const {t: tErrors} = useT('errors');
  const query = useBots(filters);
  const list = useInfiniteList<BotCard, NonNullable<typeof query.data>['pages'][number]>(query);

  // Load the next page when the sentinel comes near the screen.
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

  if (list.isLoading) {
    return (
      <div className="feed-state" aria-busy="true">
        <Spinner />
      </div>
    );
  }
  if (list.isError) {
    if (hasCode(list.error, 'theme_invalid', 'cursor_invalid')) {
      return (
        <EmptyState
          compact
          icon="filter_alt_off"
          title={tFeed('invalid.title')}
          action={<md-filled-button onclick={onReset}>{tFeed('filters.reset')}</md-filled-button>}
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
        title={tFeed('empty.filteredTitle')}
        action={
          <md-outlined-button onclick={onReset}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              filter_alt_off
            </md-icon>
            {tFeed('filters.reset')}
          </md-outlined-button>
        }
      >
        {tFeed('empty.filteredBody')}
      </EmptyState>
    ) : (
      <EmptyState compact icon="smart_toy" title={t('directory.emptyTitle')}>
        {t('directory.emptyBody')}
      </EmptyState>
    );
  }

  return (
    <>
      <p className="visually-hidden" role="status">
        {list.isPlaceholderData ? tFeed('updating') : ''}
      </p>
      <h2 className="visually-hidden">{t('directory.list')}</h2>
      <ul className="bot-grid" aria-label={t('directory.list')} aria-busy={list.isPlaceholderData || undefined}>
        {list.items.map((bot) => (
          <li key={bot.id}>
            <BotTile bot={bot} />
          </li>
        ))}
      </ul>
      {isLoadMoreError && (
        <div className="feed-more">
          <p className="feed-more-error" role="alert">
            <Icon name="error" filled />
            {errorMessage(list.error, tErrors)}
          </p>
          <md-outlined-button onclick={loadMore}>{tCommon('actions.retry')}</md-outlined-button>
        </div>
      )}
      {hasMore && !isLoadMoreError && (
        <div ref={sentinel} className="feed-more">
          {isLoadingMore ? (
            <Spinner label={tFeed('loadingMore')} />
          ) : (
            <md-outlined-button onclick={loadMore}>{tCommon('actions.loadMore')}</md-outlined-button>
          )}
        </div>
      )}
      {!hasMore && itemCount > 0 && <p className="feed-end">{t('directory.end', {count: itemCount})}</p>}
    </>
  );
}
