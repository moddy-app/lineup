import type {AnchorHTMLAttributes, HTMLAttributes} from 'react';
import {Link} from 'react-router';

import {cx} from '@/lib/cx';

type CommonProps = {className?: string};

type InnerCardProps = CommonProps &
  Omit<HTMLAttributes<HTMLElement>, 'className'> & {
    /** `li` inside `InnerCards` (the default list), `div` elsewhere. */
    as?: 'div' | 'li';
    /** An in-app link: the whole card is a link (`a`) with a quiet hover. */
    to?: string;
    /** An external link: same, as a plain `a` (pass `target` and `rel` too). */
    href?: string;
  } & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'>;

/**
 * A card inside a card (docs/ui-redesign.md): `surface-container`, `--radius-l`,
 * no edge caps, no border, no shadow. For things you can point at inside a
 * section: an experience, a post, a link. With `to` or `href` it is a link.
 * Never a third level.
 */
export function InnerCard({as = 'div', to, href, className, target, rel, ...props}: InnerCardProps) {
  if (to !== undefined) {
    const link = <Link {...props} to={to} className={cx('inner-card', 'is-link', className)} />;
    return as === 'li' ? <li>{link}</li> : link;
  }
  if (href !== undefined) {
    const link = (
      <a {...props} href={href} target={target} rel={rel} className={cx('inner-card', 'is-link', className)} />
    );
    return as === 'li' ? <li>{link}</li> : link;
  }
  const Tag = as;
  return <Tag {...props} className={cx('inner-card', className)} />;
}

/** The stack of inner cards, `--gap-s` apart. A `ul` by default (children are `li`). */
export function InnerCards({
  as: Tag = 'ul',
  className,
  ...props
}: CommonProps & Omit<HTMLAttributes<HTMLElement>, 'className'> & {as?: 'ul' | 'div'}) {
  return <Tag {...props} className={cx('inner-cards', className)} />;
}
