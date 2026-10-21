import type {AnchorHTMLAttributes, HTMLAttributes, ReactNode, Ref} from 'react';
import {Link, type LinkProps, type To} from 'react-router';

import {cx} from '@/lib/cx';

import {EdgeCaps} from './EdgeCaps';

export type Span = 3 | 4 | 5 | 6 | 7 | 8;
export type CardVariant = 'split' | 'hero' | 'split reverse';

interface CardBaseProps {
  /** Columns in the bento grid (12 when omitted); the spans of a row add up to 12. */
  span?: Span;
  variant?: CardVariant;
  className?: string;
  children?: ReactNode;
}

type PlainCardProps = CardBaseProps &
  Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'> & {
    as?: 'section' | 'article' | 'div';
    ref?: Ref<HTMLElement>;
    to?: undefined;
    href?: undefined;
  };

/** A card that is a link to a page of the app (client-side navigation). */
type RouteCardProps = CardBaseProps &
  Omit<LinkProps, 'className' | 'children' | 'to'> & {as?: 'a'; to: To; href?: undefined};

/** A card that is a link out of the app. */
type ExternalCardProps = CardBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    as: 'a';
    href: string;
    to?: undefined;
  };

export type CardProps = PlainCardProps | RouteCardProps | ExternalCardProps;

/**
 * A card of the bento grid. The edge-caps are always its first child: they
 * draw the rounded corners. `section` by default; `article` for a post;
 * `a.card` (the only card with a hover state) when `to` or `href` is given.
 */
export function Card(props: CardProps) {
  const {span, variant, className, children, as, to, href, ...rest} = props;
  const classes = cx('card', span && `span-${span}`, variant, className);
  const content = (
    <>
      <EdgeCaps />
      {children}
    </>
  );

  if (to !== undefined) {
    return (
      <Link {...(rest as Omit<LinkProps, 'to'>)} to={to} className={classes}>
        {content}
      </Link>
    );
  }
  if (as === 'a') {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} href={href} className={classes}>
        {content}
      </a>
    );
  }
  const Tag = as ?? 'section';
  return (
    <Tag {...(rest as HTMLAttributes<HTMLElement>)} className={classes}>
      {content}
    </Tag>
  );
}
