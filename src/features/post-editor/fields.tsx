/** Small pieces the steps share: an error line, a checkbox group, a field wrapper. */

import type {ReactNode} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import type {CatalogKind} from '@/api/types';
import {useT} from '@/i18n/useT';
import {Checkbox, Icon} from '@/ui';

import type {FormState} from './form';

export type SetForm = (patch: Partial<FormState>) => void;

/** The shown message of a field, or undefined. */
export type ErrorOf = (field: string) => string | undefined;

/** A field with its error under it; `name` lets the page focus it. */
export function FieldBox({name, error, children}: {name: string; error?: string; children: ReactNode}) {
  return (
    <div className="ed-field" data-field={name}>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export function FieldError({children}: {children: ReactNode}) {
  return (
    <p className="ed-error" role="alert">
      <Icon name="error" filled />
      {children}
    </p>
  );
}

interface CheckGroupProps {
  legend: string;
  hint?: string;
  kind: Extract<CatalogKind, 'positions' | 'languages'>;
  ids: readonly string[];
  selected: readonly string[];
  max: number;
  onChange: (next: string[]) => void;
  error?: string;
  name: string;
  /** Called when an id is switched on (positions: "other" opens its labels). */
  onAdd?: (id: string) => void;
}

/** A fieldset of checkboxes from a catalog list, with a counter and a limit. */
export function CheckGroup({legend, hint, kind, ids, selected, max, onChange, error, name, onAdd}: CheckGroupProps) {
  const {t} = useT('editor');
  const {label} = useCatalogLabel();
  const full = selected.length >= max;
  return (
    <FieldBox name={name} error={error}>
      <fieldset className="ed-group">
        <legend>
          {legend}
          <span className="ed-count numeric">{t('count', {used: selected.length, max})}</span>
        </legend>
        {hint && <p className="ed-hint">{hint}</p>}
        <div className="ed-checks">
          {ids.map((id) => {
            const checked = selected.includes(id);
            return (
              <Checkbox
                key={id}
                className="ed-check"
                checked={checked}
                disabled={!checked && full}
                label={label(kind, id)}
                onCheckedChange={(on) => {
                  if (on) {
                    onChange([...selected, id]);
                    onAdd?.(id);
                  } else onChange(selected.filter((value) => value !== id));
                }}
              />
            );
          })}
        </div>
      </fieldset>
    </FieldBox>
  );
}
