import {useCatalogLabel} from '@/api/catalog';
import type {Badge} from '@/api/types';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

import {badgeIcon} from './badgeIcons';
import {tooltipSideProps} from './tooltipSide';
import {isStripBadge} from './stripBadges';

interface BadgeStripProps {
  badges: readonly Badge[] | undefined | null;
  /**
   * The icons take keyboard focus so that their tooltip shows. Turn it off
   * inside a link card, where a focusable child would nest interactive elements.
   */
  focusable?: boolean;
  className?: string;
}

/**
 * The badges of a server or a person as a strip of icons on a
 * `surface-container` rectangle, each with its name in a tooltip. Nothing is
 * rendered when no badge qualifies.
 */
export function BadgeStrip({badges, focusable = true, className}: BadgeStripProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  const shown = (badges ?? []).filter(isStripBadge);
  if (shown.length === 0) return null;

  return (
    <ul className={cx('badge-strip', className)} aria-label={t('badges.label')}>
      {shown.map((badge) => {
        const name = label('badges', badge.id, badge.label);
        return (
          <li key={badge.id}>
            <span
              className="badge-strip-item"
              data-tooltip={name}
              aria-label={name}
              role="img"
              tabIndex={focusable ? 0 : undefined}
              {...tooltipSideProps}
            >
              <Icon name={badgeIcon(badge.id)} filled />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
