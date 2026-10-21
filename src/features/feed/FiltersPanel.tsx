/** The feed's filters: kind, search, positions, languages, theme, compensation, tags, adult content. */

import {useCatalogLabel} from '@/api/catalog';
import type {Catalog, PostKind} from '@/api/types';
import {NsfwConfirmDialog, useNsfwConfirmed} from '@/components';
import {useT} from '@/i18n/useT';
import {FIELD_LIMITS} from '@/api/limits';
import {Checkbox, Select, Switch, TextField} from '@/ui';
import {useState} from 'react';

import {filterableThemes, parseTags, SEARCH_DEBOUNCE_MS, type UiFilters} from './feedFilters';
import {useDebouncedField} from './useDebouncedField';

interface FiltersPanelProps {
  catalog: Catalog;
  filters: UiFilters;
  /** Replace some filters. `replace` keeps typing out of the history. */
  onChange: (patch: Partial<UiFilters>, options?: {replace?: boolean}) => void;
  onReset: () => void;
  active: number;
}

const KINDS: ReadonlyArray<PostKind | ''> = ['', 'guild', 'user'];

function toggle(list: string[] | undefined, id: string, on: boolean): string[] | undefined {
  const next = on ? [...(list ?? []), id] : (list ?? []).filter((value) => value !== id);
  return next.length > 0 ? next : undefined;
}

export function FiltersPanel({catalog, filters, onChange, onReset, active}: FiltersPanelProps) {
  const {t} = useT('feed');
  const {label} = useCatalogLabel();
  const {confirmed} = useNsfwConfirmed();
  const [confirming, setConfirming] = useState(false);

  const [q, setQ] = useDebouncedField(
    filters.q ?? '',
    (next) => onChange({q: next.trim() || undefined}, {replace: true}),
    SEARCH_DEBOUNCE_MS,
  );
  const [tags, setTags] = useDebouncedField(
    filters.tags?.join(', ') ?? '',
    (next) => onChange({tags: parseTags(next, catalog)}, {replace: true}),
    SEARCH_DEBOUNCE_MS,
  );

  const positionsFull = (filters.positions?.length ?? 0) >= FIELD_LIMITS.query.feedPositionsMax;

  return (
    <div className="filters">
      <Select
        label={t('filters.kind.label')}
        value={filters.kind ?? ''}
        onValueChange={(value) => onChange({kind: (value || undefined) as PostKind | undefined})}
        options={KINDS.map((kind) => ({value: kind, label: t(`filters.kind.${kind || 'all'}`)}))}
      />

      <TextField
        label={t('filters.q')}
        type="search"
        value={q}
        onValueChange={setQ}
        maxLength={FIELD_LIMITS.query.qMax}
        counter={false}
        autocomplete="off"
      />

      <details className="filter-group" open={(filters.positions?.length ?? 0) > 0 || undefined}>
        <summary>
          {t('filters.positions')}
          {filters.positions && <span className="filter-count numeric">{filters.positions.length}</span>}
        </summary>
        <div className="filter-options">
          {catalog.positions.map((position) => {
            const checked = filters.positions?.includes(position.id) ?? false;
            return (
              <Checkbox
                key={position.id}
                checked={checked}
                disabled={!checked && positionsFull}
                label={label('positions', position.id)}
                onCheckedChange={(on) => onChange({positions: toggle(filters.positions, position.id, on)})}
              />
            );
          })}
        </div>
      </details>

      <details className="filter-group" open={(filters.languages?.length ?? 0) > 0 || undefined}>
        <summary>
          {t('filters.languages')}
          {filters.languages && <span className="filter-count numeric">{filters.languages.length}</span>}
        </summary>
        <div className="filter-options">
          {catalog.languages.map((language) => (
            <Checkbox
              key={language.id}
              checked={filters.languages?.includes(language.id) ?? false}
              label={label('languages', language.id)}
              onCheckedChange={(on) => onChange({languages: toggle(filters.languages, language.id, on)})}
            />
          ))}
        </div>
      </details>

      <Select
        label={t('filters.theme')}
        value={filters.theme ?? ''}
        onValueChange={(value) => onChange({theme: value || undefined})}
        options={[
          {value: '', label: t('filters.allThemes')},
          ...filterableThemes(catalog).map((theme) => ({value: theme.id, label: label('themes', theme.id)})),
        ]}
      />

      <Select
        label={t('filters.compensation')}
        value={filters.compensation ?? ''}
        onValueChange={(value) => onChange({compensation: value || undefined})}
        options={[
          {value: '', label: t('filters.anyCompensation')},
          ...catalog.compensations.map((entry) => ({value: entry.id, label: label('compensations', entry.id)})),
        ]}
      />

      <TextField label={t('filters.tags')} value={tags} onValueChange={setTags} supportingText={t('filters.tagsHelp')} />

      <Switch
        checked={filters.include_nsfw === true && confirmed}
        label={t('filters.nsfw')}
        onCheckedChange={(on) => {
          if (!on) onChange({include_nsfw: undefined});
          else if (confirmed) onChange({include_nsfw: true});
          else setConfirming(true);
        }}
      />
      <NsfwConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirmed={() => {
          setConfirming(false);
          onChange({include_nsfw: true});
        }}
      />

      {active > 0 && (
        <md-text-button onclick={onReset}>
          <md-icon slot="icon" className="filled" aria-hidden="true">
            filter_alt_off
          </md-icon>
          {t('filters.reset')}
        </md-text-button>
      )}
    </div>
  );
}
