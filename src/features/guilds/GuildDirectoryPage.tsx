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
  BadgeList,
  EmptyState,
  ErrorState,
  GuildIcon,
  NsfwConfirmDialog,
  useNsfwConfirmed,
} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatCompact} from '@/lib/format';
import {Card, CardActions, Chip, Chips, LinkButton, Page, Select, Spinner, Switch, TextField} from '@/ui';
import {FIELD_LIMITS} from '@/api/limits';

import {
  type DirectoryUrlState,
  hasActiveFilters,
  parseDirectoryParams,
  toApiFilters,
  toDirectoryParams,
} from './directoryFilters';
import './guilds.css';

const SEARCH_DELAY_MS = 300;
const TAGS_SHOWN = 3;

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
    () => [
      {value: '', label: t('filters.themeAll')},
      ...(catalog.data?.themes ?? []).map((theme) => ({value: theme.id, label: label('themes', theme.id)})),
    ],
    [catalog.data, label, t],
  );

  const clear = () => {
    setText('');
    setParams(new URLSearchParams(), {replace: true});
  };

  const claimUrl = () => new URL(paths.guildClaim(), window.location.origin).href;
  const claim =
    status === 'anonymous' ? (
      <md-filled-button onclick={() => login(claimUrl())}>
        <md-icon slot="icon" className="filled" aria-hidden="true">
          add_circle
        </md-icon>
        {t('claim.action')}
      </md-filled-button>
    ) : (
      <LinkButton to={paths.guildClaim()} icon="add_circle">
        {t('claim.action')}
      </LinkButton>
    );

  const error = list.error;
  const badFilter = hasCode(error, 'theme_invalid');
  const badCursor = hasCode(error, 'cursor_invalid');
  const active = hasActiveFilters(state);

  return (
    <Page>
      <div className="guilds-page">
        <Card className="guilds-header" as="section">
          <h1>{t('title')}</h1>
          <p>{t('intro')}</p>
          <div className="guilds-filters" role="search">
            <TextField
              label={t('filters.search')}
              type="search"
              value={text}
              onValueChange={setText}
              maxLength={FIELD_LIMITS.query.qMax}
              autocomplete="off"
            />
            <Select
              label={t('filters.theme')}
              value={state.theme}
              options={themeOptions}
              onValueChange={(theme) => update({theme})}
            />
            <Switch checked={state.nsfw && confirmed} onCheckedChange={onNsfw} label={t('filters.nsfw')} />
          </div>
          <CardActions>
            {claim}
            {active && (
              <md-text-button onclick={clear}>{t('filters.clear')}</md-text-button>
            )}
          </CardActions>
        </Card>

        {list.isLoading ? (
          <Card>
            <Spinner />
          </Card>
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
      </div>
      <NsfwConfirmDialog
        open={askAge}
        onConfirmed={() => {
          setAskAge(false);
          update({nsfw: true});
        }}
        onCancel={() => setAskAge(false)}
      />
    </Page>
  );
}

function GuildCardLink({guild}: {guild: GuildCard}) {
  const {t} = useT('guilds');
  const {label} = useCatalogLabel();
  useLanguage();
  const name = guild.name ?? t('card.unknownName');
  const tags = guild.tags.slice(0, TAGS_SHOWN);
  const more = guild.tags.length - tags.length;
  return (
    <Card to={paths.guild(guild.id)} className="guild-card">
      <div className="guild-card-head">
        <GuildIcon id={guild.id} iconUrl={guild.icon_url} size="large" />
        <div className="guild-card-title">
          <h2>{name}</h2>
          <p className="guild-card-counts numeric">
            {guild.member_count === null && guild.presence_count === null ? (
              t('card.noCounts')
            ) : (
              <>
                {guild.member_count !== null && (
                  <span>{t('card.members', {count: guild.member_count, value: formatCompact(guild.member_count)})}</span>
                )}
                {guild.presence_count !== null && (
                  <span>{t('card.online', {value: formatCompact(guild.presence_count)})}</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>
      {(guild.theme || tags.length > 0) && (
        <Chips className="guild-card-chips">
          {guild.theme && <Chip icon="category">{label('themes', guild.theme)}</Chip>}
          {tags.map((tag) => (
            <Chip key={tag} mono>
              {tag}
            </Chip>
          ))}
          {more > 0 && <Chip>+{more}</Chip>}
        </Chips>
      )}
      {guild.badges.length > 0 && <BadgeList badges={guild.badges} variant="compact" max={5} focusable={false} />}
    </Card>
  );
}
