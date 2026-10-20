import type {HTMLAttributes} from 'react';

import {cx} from '@/lib/cx';

interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Material Symbols Outlined ligature name ("campaign", "groups"…). */
  name: string;
  /** Filled variant: the kit fills icons in shapes, menus and badges. */
  filled?: boolean;
  /** Names the icon for assistive tech; without it the icon is decorative. */
  label?: string;
}

/**
 * A Material Symbol. Decorative by default (aria-hidden): the ligature text
 * would otherwise be read out ("campaign"). translate="no" keeps browser
 * translation from turning the ligature name into a word.
 */
export function Icon({name, filled, label, className, ...props}: IconProps) {
  return (
    <span
      {...props}
      className={cx('material-symbols-outlined', filled && 'filled', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      translate="no"
    >
      {name}
    </span>
  );
}
