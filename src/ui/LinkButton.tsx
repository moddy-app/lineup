import type {ReactNode} from 'react';
import {useNavigate} from 'react-router';

import {clientNavigation} from '@/lib/clientNav';

type Variant = 'filled' | 'tonal' | 'outlined' | 'text';

interface LinkButtonProps {
  /** A path of the app (client-side navigation) or an absolute URL (new tab). */
  to: string;
  variant?: Variant;
  /** Material Symbol before the label. */
  icon?: string;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * A Material Web button that is a link. `href` makes the button render a real
 * <a> (middle click, copy link, open in a new tab all work); a plain click on a
 * path of the app goes through the router, so the page does not reload.
 */
export function LinkButton({to, variant = 'filled', icon, disabled, children}: LinkButtonProps) {
  const navigate = useNavigate();
  const external = /^[a-z][a-z\d+.-]*:/i.test(to);
  const props = {
    href: to,
    disabled,
    ...(external ? {target: '_blank' as const} : {onclick: clientNavigation(navigate)}),
  };
  const content = (
    <>
      {icon && (
        <md-icon slot="icon" className="filled" aria-hidden="true">
          {icon}
        </md-icon>
      )}
      {children}
    </>
  );
  switch (variant) {
    case 'filled':
      return <md-filled-button {...props}>{content}</md-filled-button>;
    case 'tonal':
      return <md-filled-tonal-button {...props}>{content}</md-filled-tonal-button>;
    case 'outlined':
      return <md-outlined-button {...props}>{content}</md-outlined-button>;
    case 'text':
      return <md-text-button {...props}>{content}</md-text-button>;
  }
}
