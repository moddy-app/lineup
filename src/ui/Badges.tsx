import type {HTMLAttributes} from 'react';

import {cx} from '@/lib/cx';

type SpanProps = Omit<HTMLAttributes<HTMLSpanElement>, 'className'> & {className?: string};

export type StatusVariant = 'default' | 'strong' | 'accent' | 'error';

/** A status on the right of a row: default, strong (tertiary), accent (the one full accent), error. */
export function Status({variant = 'default', className, ...props}: SpanProps & {variant?: StatusVariant}) {
  return <span {...props} className={cx('status', variant !== 'default' && variant, className)} />;
}

/** A value the person did not write (an id, a @handle, a URL): mono, never inline in a sentence. */
export function Pill({className, ...props}: SpanProps) {
  return <span {...props} className={cx('pill', className)} />;
}

/** Hidden on screen, read by screen readers. */
export function VisuallyHidden({className, ...props}: SpanProps) {
  return <span {...props} className={cx('visually-hidden', className)} />;
}
