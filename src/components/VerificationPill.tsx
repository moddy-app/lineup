/**
 * The verification status of an experience as a pill: verified (accent, with a
 * check and, in a tooltip, how and when), pending (tertiary), not verified
 * (grey), refused (error). Refused and pending only reach the owner and the staff.
 */

import {useId} from 'react';

import type {PublicVerification} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon, Status, VisuallyHidden} from '@/ui';

import {verificationView} from './experienceFormat';

export function VerificationPill({verification}: {verification: PublicVerification}) {
  const {t} = useT('components');
  useLanguage();
  const tipId = useId();
  const view = verificationView(verification, t);
  const tipProps = view.tip ? ({'data-tooltip': view.tip, tabIndex: 0, 'aria-describedby': tipId} as const) : undefined;

  return (
    <>
      <Status
        variant={view.variant === 'neutral' ? 'default' : view.variant}
        className={cx(
          view.variant === 'neutral' && 'neutral',
          view.icon && 'with-icon',
          view.tip && 'tooltip-end tooltip-wrap',
        )}
        {...tipProps}
      >
        {view.icon && <Icon name={view.icon} filled />}
        {t(`experience.verification.${view.key}`)}
      </Status>
      {view.tip && <VisuallyHidden id={tipId}>{view.tip}</VisuallyHidden>}
    </>
  );
}
