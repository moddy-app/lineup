import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

import {tooltipSideProps} from './tooltipSide';
import {type Verification, type VerificationEntity, verificationLabel} from './verification';

interface VerifiedBadgeProps {
  kind: Verification;
  /** Names the mark: "Verified server" or "Verified account". */
  entity: VerificationEntity;
  className?: string;
  /** Reachable with the keyboard (default). Off inside a link or a link-card: the tooltip then stays on hover. */
  focusable?: boolean;
}

/**
 * The verification mark: a filled check_circle in the accent color, with its
 * meaning in a tooltip under it (hover and keyboard focus). Prefer
 * `DisplayName`, which decides whether to show it.
 */
export function VerifiedBadge({kind, entity, className, focusable = true}: VerifiedBadgeProps) {
  const {t} = useT('components');
  const text = verificationLabel(kind, entity, t);
  return (
    <span
      className={cx('verified-badge', className)}
      role="img"
      aria-label={text}
      tabIndex={focusable ? 0 : undefined}
      data-verification={kind}
      {...tooltipSideProps}
    >
      <Icon name="check_circle" filled />
      <span className="verified-badge-tip" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
