/**
 * The verification of an experience, kept quiet: a verified one is a small
 * check and "Vérifiée" in the accent color (how and when in a tooltip); the
 * other states are plain muted text, and `showAll` is for the owner's and the
 * staff's views, where pending and refused matter. Without `showAll`, only a
 * verification is shown.
 */

import {useId} from 'react';

import type {PublicVerification} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon, VisuallyHidden} from '@/ui';

import {verificationView} from './experienceFormat';

interface VerificationPillProps {
  verification: PublicVerification;
  /** Show pending, refused and not verified too. Default: true. */
  showAll?: boolean;
}

const ICONS: Record<string, string | undefined> = {
  verified: 'check_circle',
  pending: 'hourglass_top',
  rejected: 'block',
};

export function VerificationPill({verification, showAll = true}: VerificationPillProps) {
  const {t} = useT('components');
  useLanguage();
  const tipId = useId();
  const view = verificationView(verification, t);
  if (view.key !== 'verified' && !showAll) return null;
  const icon = ICONS[view.key];
  const tipProps = view.tip ? ({'data-tooltip': view.tip, tabIndex: 0, 'aria-describedby': tipId} as const) : undefined;

  return (
    <>
      <span className={cx('experience-status', `is-${view.key}`, view.tip && 'tooltip-end tooltip-wrap')} {...tipProps}>
        {icon && <Icon name={icon} filled />}
        {t(`experience.verification.${view.key}`)}
      </span>
      {view.tip && <VisuallyHidden id={tipId}>{view.tip}</VisuallyHidden>}
    </>
  );
}
