import type {ReactNode} from 'react';

import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

interface TagLabelProps {
  children: ReactNode;
  /** Material Symbol drawn filled: `sell` for a tag, `null` for none (inside a line that already has the icon), `category` (or the theme's own icon) for a theme. */
  icon?: string | null;
  className?: string;
}

/**
 * A tag or a theme: a small rounded label in the site font with an icon.
 * For free words people chose. Real identifiers (ids, handles, invite codes,
 * time zones, domains) stay in a mono `Pill`.
 */
export function TagLabel({children, icon = 'sell', className}: TagLabelProps) {
  return (
    <span className={cx('tag-label', className)}>
      {icon && <Icon name={icon} filled />}
      <span className="tag-label-text">{children}</span>
    </span>
  );
}
