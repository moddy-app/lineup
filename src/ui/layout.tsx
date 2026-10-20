import type {HTMLAttributes, ReactNode} from 'react';

import {cx} from '@/lib/cx';

import type {Span} from './Card';

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {className?: string; children?: ReactNode};

/** The content column (1240px at most, centered). `special`: 404, errors, sign-in; no footer. */
export function Page({special, className, ...props}: DivProps & {special?: boolean}) {
  return <div {...props} className={cx('page', special && 'special', className)} />;
}

/** The 12-column grid of cards. */
export function Bento({className, ...props}: DivProps) {
  return <div {...props} className={cx('bento', className)} />;
}

/** A column of cards inside the grid (a feed next to a side column). */
export function Stack({span, sticky, className, ...props}: DivProps & {span?: Span; sticky?: boolean}) {
  return <div {...props} className={cx('stack', span && `span-${span}`, sticky && 'sticky', className)} />;
}

/** Buttons at the bottom of a card, three at most in a row. */
export function CardActions({end, className, ...props}: DivProps & {end?: boolean}) {
  return <div {...props} className={cx('card-actions', end && 'end', className)} />;
}

/** A title next to a shape or an avatar. */
export function CardHead({className, ...props}: DivProps) {
  return <div {...props} className={cx('card-head', className)} />;
}

/** The text block of a split card. */
export function CardText({className, ...props}: DivProps) {
  return <div {...props} className={cx('card-text', className)} />;
}

/** The illustration or content under the text of a card. */
export function CardVisual({className, ...props}: DivProps) {
  return <div {...props} className={cx('card-visual', className)} />;
}

/** A softer panel inside a card (one step darker than the card). */
export function Panel({className, ...props}: DivProps) {
  return <div {...props} className={cx('panel', className)} />;
}
