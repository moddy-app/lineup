import type {ReactNode} from 'react';

import {cx} from '@/lib/cx';
import {Icon, VisuallyHidden} from '@/ui';

/** A card's facts: one list, an icon then the value per line. No sub-titles, no rules. */
export function FactList({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <ul {...props} className={cx('fact-list', className)}>
      {children}
    </ul>
  );
}

interface FactProps {
  /** Material Symbol, drawn filled, 20 px. */
  icon: string;
  /** What the line is, read by screen readers before the value (no tooltip: the value shows it). Left out when the value says it. */
  label?: string;
  children: ReactNode;
}

/** One line of a `FactList`: icon on the left, the value in small text, wrapping beside the icon. */
export function Fact({icon, label, children}: FactProps) {
  return (
    <li className="fact">
      <span className="fact-icon" aria-hidden="true">
        <Icon name={icon} filled />
      </span>
      <div className="fact-value">
        {label && <VisuallyHidden>{label} : </VisuallyHidden>}
        {children}
      </div>
    </li>
  );
}
