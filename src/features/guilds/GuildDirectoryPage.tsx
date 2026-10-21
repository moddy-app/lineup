import {useQueryClient} from '@tanstack/react-query';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode} from '@/api/client';
import {useCatalog, useGuildDirectory} from '@/api/queries';
import {queryKeys} from '@/api/queryKeys';
import {useInfiniteList} from '@/api/pagination';
import type {GuildCard} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {useSession} from '@/auth/session';
import {
  BadgeStrip,
  DisplayName,
  TagLabel,
  EmptyState,
  ErrorState,
  FilterBar,
  GuildIcon,
  InlineStats,
  NsfwConfirmDialog,
  useNsfwConfirmed,
} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {Card, LinkButton, PageHeader, ShowcasePage, Spinner} from '@/ui';

import {
  type DirectoryUrlState,
  hasActiveFilters,
  parseDirectoryParams,
  toApiFilters,
  toDirectoryParams,
} from './directoryFilters';
import './guilds.css';

const SEARCH_DELAY_MS = 300;

export function Component() {
  const {t} = useT('guilds');
  const {t: tCommon} = useT('common');
  usePageTitle(t('title'));

  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseDirectoryParams(params), [params]);
  const {confirmed} = useNsfwConfirmed();
  const {status, login} = useSession();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const {label} = useCatalogLabel();

  // The search box is typed in at once and reaches the URL after a short pause.
  const [text, setText] = useState(state.q);
  const urlQ = useRef(state.q);
  useEffect(() => {
    // The URL changed from elsewhere (back button, "clear filters"): follow it.
    if (state.q !== urlQ.current) {
      urlQ.current = state.q;
      setText(state.q);
    }
  }, [state.q]);

  const update = (next: Partial<DirectoryUrlState>) => {
    setParams(toDirectoryParams({...state, ...next}), {replace: true});
  };

  useEffect(() => {
    if (text.trim() === state.q.trim()) return;
    const timer = window.setTimeout(() => {
      urlQ.current = text.trim();
      setParams(toDirectoryParams({...state, q: text}), {replace: true});
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, state, setParams]);

  const [askAge, setAskAge] = useState(false);
  const onNsfw = (checked: boolean) => {
    if (checked && !confirmed) setAskAge(true);
    else update({nsfw: checked});
  };

  const filters = toApiFilters(state, confirmed);
  const query = useGuildDirectory(filters);
  const list = useInfiniteList<GuildCard, NonNullable<typeof query.data>['pages'][number]>(query);

  const themeOptions = useMemo(
    () => (catalog.data?.themes ?? []).map((theme) => ({value: theme.id, label: label('themes', theme.id)})),
    [catalog.data, label],
  );

  const clear = () => {
    setText('');
    setParams(new URLSearchParams(), {replace: true});
  };

  const claimUrl = () => new URL(paths.myGuilds(), window.location.origin).href;
  const add =
    status === 'anonymous' ? (
      <md-outlined-button onclick={() => login(claimUrl())}>
        <md-icon slot="icon" className="filled" aria-hidden="true">
          add_circle
        </md-icon>
        {t('add')}
      </md-outlined-button>
    ) : (
      <LinkButton to={paths.myGuilds()} variant="outlined" icon="add_circle">
        {t('add')}
      </LinkButton>
    );

  const error = list.error;
  const badFilter = hasCode(error, 'theme_invalid');
  const badCursor = hasCode(error, 'cursor_invalid');
  const active = hasActiveFilters(state);

  return (
    <ShowcasePage className="guilds-page">
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={add} />

      <FilterBar
        search={{value: text, onChange: setText, placeholder: t('filters.search')}}
        filters={{
          theme: {
            icon: 'category',
            label: t('filters.theme'),
            kind: 'single',
            options: themeOptions,
            value: state.theme ? [state.theme] : [],
            onChange: (values) => update({theme: values[0] ?? ''}),
          },
          nsfw: {
            icon: 'explicit',
            label: t('filters.adult'),
            kind: 'single',
            options: [{value: '1', label: t('filters.adultYes')}],
            value: state.nsfw && confirmed ? ['1'] : [],
            onChange: (values) => onNsfw(values.length > 0),
          },
        }}
      />

      {list.isLoading ? (
        <div className="guilds-more">
          <Spinner />
        </div>
      ) : list.isError ? (
        badFilter || badCursor ? (
          <ErrorState
            error={error}
            onRetry={() => {
              if (badCursor) void queryClient.resetQueries({queryKey: queryKeys.directories()});
              else clear();
            }}
          />
        ) : (
          <ErrorState error={error} onRetry={list.refetch} />
        )
      ) : list.isEmpty ? (
        active ? (
          <EmptyState
            icon="search_off"
            title={t('emptyFiltered.title')}
            action={<md-outlined-button onclick={clear}>{t('filters.clear')}</md-outlined-button>}
          >
            {t('emptyFiltered.body')}
          </EmptyState>
        ) : (
          <EmptyState icon="groups" title={t('empty.title')}>
            {t('empty.body')}
          </EmptyState>
        )
      ) : (
        <>
          <ul className="guild-grid" aria-label={t('list.label')} aria-busy={list.isPlaceholderData}>
            {list.items.map((guild) => (
              <li key={guild.id}>
                <GuildCardLink guild={guild} />
              </li>
            ))}
          </ul>
          {list.isLoadMoreError && (
            <ErrorState compact error={query.error} onRetry={list.loadMore} retrying={list.isLoadingMore} />
          )}
          {(list.hasMore || list.isLoadingMore) && !list.isLoadMoreError && (
            <div className="guilds-more">
              {list.isLoadingMore ? (
                <Spinner />
              ) : (
                <md-outlined-button onclick={list.loadMore}>{tCommon('actions.loadMore')}</md-outlined-button>
              )}
            </div>
          )}
        </>
      )}
      <NsfwConfirmDialog
        open={askAge}
        onConfirmed={() => {
          setAskAge(false);
          update({nsfw: true});
        }}
        onCancel={() => setAskAge(false)}
      />
    </ShowcasePage>
  );
}

function GuildCardLink({guild}: {guild: GuildCard}) {
  const {t} = useT('guilds');
  const {label} = useCatalogLabel();
  useLanguage();
  const name = guild.name ?? t('card.unknownName');
  return (
    <Card to={paths.guild(guild.id)} className="guild-card">
      <GuildIcon id={guild.id} iconUrl={guild.icon_url} />
      <div className="guild-card-body">
        <h2 className="guild-card-title">
          <DisplayName name={name} badges={guild.badges} entity="guild" focusable={false} />
        </h2>
        <InlineStats
          compact
          items={[
            {
              icon: 'group',
              value: guild.member_count,
              label: t('card.members', {count: guild.member_count ?? 0}),
            },
          ]}
        />
        {(guild.theme || guild.badges.length > 0) && (
          <div className="guild-card-foot">
            {guild.theme && <TagLabel icon="category">{label('themes', guild.theme)}</TagLabel>}
            <BadgeStrip badges={guild.badges} focusable={false} />
          </div>
        )}
      </div>
    </Card>
  );
}
