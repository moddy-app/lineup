import type {ReactNode} from 'react';

import {useT} from '@/i18n/useT';
import {Dropdown} from '@/ui';

export interface RowMenuItem {
  key: string;
  icon: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** The "more" button of a row and its menu (the shared `Dropdown`, lined up with the right edge). */
export function RowMenu({
  label,
  items,
  disabled,
}: {
  label: string;
  items: RowMenuItem[];
  disabled?: boolean;
}): ReactNode {
  const {t} = useT('myPosts');
  if (items.length === 0) return null;
  const title = t('row.more', {title: label});
  return (
    <span className="mp-menu">
      <Dropdown
        align="end"
        label={title}
        items={items.map((item) => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          destructive: item.danger,
          disabled: item.disabled,
          onSelect: item.onSelect,
        }))}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button {...aria} ref={ref} aria-label={title} disabled={disabled} onclick={onActivate}>
            <md-icon>more_vert</md-icon>
          </md-icon-button>
        )}
      />
    </span>
  );
}
