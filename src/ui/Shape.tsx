import {cx} from '@/lib/cx';

import {Icon} from './Icon';

export type ShapeName = 'square' | 'diamond' | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon';
export type ShapeTone = 'primary' | 'secondary' | 'tertiary' | 'solid';

interface ShapeProps {
  shape?: ShapeName;
  /** `primary` is the default tone; `solid` is the one full accent. */
  tone?: ShapeTone;
  /** 36px instead of 56px. */
  small?: boolean;
  /** Material Symbol name. */
  icon: string;
  className?: string;
}

/**
 * A feature icon on a rounded polygon, never a circle. Vary shapes and tones
 * between neighbouring cards.
 */
export function Shape({shape = 'square', tone = 'primary', small, icon, className}: ShapeProps) {
  return (
    <span
      className={cx('shape', `shape-${shape}`, tone !== 'primary' && `tone-${tone}`, small && 'small', className)}
      aria-hidden="true"
    >
      <Icon name={icon} />
    </span>
  );
}
