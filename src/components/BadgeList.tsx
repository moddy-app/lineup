/**
 * The badges of a server or a person, in the order the API gives (it follows
 * the catalog). `full`: icon and name, for a profile. `compact`: the icon
 * alone with its name in a tooltip, for a card or a row. `max` keeps a card
 * to one line: the rest is a "+n" whose tooltip lists them.
 *
 * Manual badges (granted by the Moddy team) are slightly emphasized: their
 * icon is in the accent color. Discord's and computed ones stay neutral.
 */

import {useCatalogLabel} from '@/api/catalog';
import type {Badge} from '@/api/types';
import {cx} from '@/lib/cx';
import {formatNumber} from '@/lib/format';
import {useT} from '@/i18n/useT';
import {Icon} from '@/ui';

import {badgeIcon} from './badgeIcons';
import {tooltipSideProps} from './tooltipSide';

interface BadgeListProps {
  badges: readonly Badge[];
  variant?: 'full' | 'compact';
  /** Show this many, then "+n". */
  max?: number;
  /**
   * Compact icons take keyboard focus so that their tooltip shows. Turn it off
   * inside a link card, where a focusable child would nest interactive elements.
   */
  focusable?: boolean;
  className?: string;
}

export function BadgeList({badges, variant = 'full', max, focusable = true, className}: BadgeListProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  if (badges.length === 0) return null;

  const shown = max !== undefined && badges.length > max ? badges.slice(0, Math.max(0, max)) : badges;
  const hidden = badges.slice(shown.length);
  const name = (badge: Badge) => label('badges', badge.id, badge.label);
  const tipProps = (text: string) => ({
    'data-tooltip': text,
    'aria-label': text,
    role: 'img',
    tabIndex: focusable ? 0 : undefined,
    ...tooltipSideProps,
  });

  return (
    <ul className={cx('badge-list', className)} aria-label={t('badges.label')}>
      {shown.map((badge) => {
        const classes = cx('badge-item', variant === 'compact' && 'compact', badge.source === 'manual' && 'manual');
        return (
          <li key={badge.id}>
            {variant === 'compact' ? (
              <span className={classes} {...tipProps(name(badge))}>
                <Icon name={badgeIcon(badge.id)} filled />
              </span>
            ) : (
              <span className={classes}>
                <Icon name={badgeIcon(badge.id)} filled />
                <span className="badge-label">{name(badge)}</span>
              </span>
            )}
          </li>
        );
      })}
      {hidden.length > 0 && (
        <li>
          <span
            className="badge-item compact badge-more numeric"
            {...tipProps(t('badges.more', {count: hidden.length, list: hidden.map(name).join(', ')}))}
            data-tooltip={hidden.map(name).join('\n')}
          >
            +{formatNumber(hidden.length)}
          </span>
        </li>
      )}
    </ul>
  );
}
