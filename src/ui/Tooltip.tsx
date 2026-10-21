import type {HTMLAttributes} from 'react';

interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'className'> {
  /** The tooltip text. */
  text: string;
  className?: string;
}

/**
 * The kit's tooltip (data-tooltip): shown on hover and keyboard focus, so the
 * wrapper takes focus. Use it on short, secondary information (the kind of a
 * badge), never for what is needed to use the page.
 */
export function Tooltip({text, className, children, ...props}: TooltipProps) {
  return (
    <span {...props} className={className} data-tooltip={text} tabIndex={0}>
      {children}
    </span>
  );
}
