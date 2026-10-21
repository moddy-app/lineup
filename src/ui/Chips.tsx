import type {HTMLAttributes, ReactNode} from 'react';
import {Link, type LinkProps} from 'react-router';

import {cx} from '@/lib/cx';

import {Icon} from './Icon';

/** A wrapping row of chips (tags, skills, languages). */
export function Chips({className, ...props}: Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {className?: string}) {
  return <div {...props} className={cx('chips', className)} />;
}

interface ChipBase {
  /** Material Symbol shown before the label. */
  icon?: string;
  mono?: boolean;
  className?: string;
  children?: ReactNode;
}
type StaticChipProps = ChipBase & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'> & {to?: undefined};
type LinkChipProps = ChipBase & Omit<LinkProps, 'className' | 'children'>;

/**
 * A tag. Static by default; with `to` it is a link that fills in on hover and
 * slides its arrow out.
 */
export function Chip(props: StaticChipProps | LinkChipProps) {
  const {icon, mono, className, children, ...rest} = props;
  const classes = cx('chip', mono && 'mono', className);
  const content = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  );
  if (rest.to !== undefined) {
    return (
      <Link {...(rest as LinkProps)} className={classes}>
        {content}
        <Icon name="arrow_forward" className="chip-go" />
      </Link>
    );
  }
  return (
    <span {...(rest as HTMLAttributes<HTMLSpanElement>)} className={classes}>
      {content}
    </span>
  );
}
