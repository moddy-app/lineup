import type {HTMLAttributes} from 'react';

import {cx} from '@/lib/cx';

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {className?: string};

/** A grid of tiles. */
export function Tiles({className, ...props}: DivProps) {
  return <div {...props} className={cx('tiles', className)} />;
}

/** A large soft-tinted area (never a container color: too loud at this size). */
export function Tile({
  tint = 'primary',
  className,
  ...props
}: DivProps & {tint?: 'primary' | 'secondary' | 'tertiary'}) {
  return <div {...props} className={cx('tile', tint !== 'primary' && `tint-${tint}`, className)} />;
}
