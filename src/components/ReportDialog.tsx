/**
 * Reporting a post, a profile or a server (LINEUP.md §6.5).
 *
 * The person picks a reason, may add details (1000 characters at most) and
 * sends. The result is one of:
 *  - sent: the dialog closes and a snackbar thanks them;
 *  - already reported (`created: false`): not an error, a calm confirmation in
 *    the dialog;
 *  - the content is the person's own (`lineup_report_self`) or no longer exists
 *    (`lineup_report_target_not_found`): the message stays, sending is off;
 *  - too many reports (`lineup_rate_limited`): sending is off with a countdown
 *    on the button;
 *  - anything else: the usual message, and they can try again.
 * A signed-out visitor is sent to sign in (ReportButton does it before the
 * dialog opens; the dialog does it too if used alone).
 */

import {useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useCreateReport} from '@/api/mutations';
import type {ReportReason, ReportTargetType} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Dialog, Icon, TextField, useSnackbar} from '@/ui';

export interface ReportTarget {
  type: ReportTargetType;
  /** A post's UUID, or a profile's or server's Discord id. */
  id: string;
}

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
}

const REASONS: readonly ReportReason[] = ['spam', 'scam', 'inappropriate', 'impersonation', 'other'];
const DETAILS_MAX = 1000;
/** After these, sending again cannot work: the content is the person's own or gone. */
const FINAL_ERRORS = ['lineup_report_self', 'lineup_report_target_not_found'];

export function ReportDialog({open, onClose, target}: ReportDialogProps) {
  const {t} = useT('components');
  const {t: tCommon} = useT('common');
  const {t: tErrors} = useT('errors');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const report = useCreateReport();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [already, setAlready] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const retry = useRetryAfter(error);

  // Each opening starts from a clean form (adjusting state while rendering, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason(null);
      setDetails('');
      setError(null);
      setAlready(false);
    }
  }

  const final = hasCode(error, ...FINAL_ERRORS);
  const limited = hasCode(error, 'lineup_rate_limited');
  const canSend = reason !== null && canWrite && !report.isPending && !retry.active && !final;

  async function send() {
    if (reason === null) return;
    setError(null);
    try {
      const result = await auth.run(() =>
        report.mutateAsync({
          target_type: target.type,
          target_id: target.id,
          reason,
          details: details.trim() === '' ? undefined : details.trim(),
        }),
      );
      if (!result) return; // The sign-in started, or the account is suspended.
      if (result.created) {
        snackbar.show({message: t('report.sent')});
        onClose();
      } else {
        setAlready(true);
      }
    } catch (failure) {
      setError(failure);
    }
  }

  // The wait is on the button; the sentence names it once and says "you can retry" when it ends.
  const message =
    error === null ? null : errorMessage(error, tErrors, limited && !retry.active ? {seconds: 0} : undefined);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="report-dialog"
      headline={already ? t('report.alreadyTitle') : t(`report.title.${target.type}`)}
      actions={
        already ? (
          <md-text-button onclick={onClose}>{tCommon('actions.close')}</md-text-button>
        ) : (
          <>
            <md-text-button onclick={onClose}>{tCommon('actions.cancel')}</md-text-button>
            <md-filled-button disabled={!canSend} onclick={() => void send()}>
              {retry.active ? t('report.retryIn', {seconds: retry.seconds}) : t('report.submit')}
            </md-filled-button>
          </>
        )
      }
    >
      {already ? (
        <p className="report-already">
          <Icon name="check_circle" filled />
          {t('report.already')}
        </p>
      ) : (
        <div className="report-form">
          <p>{t('report.intro')}</p>
          <fieldset className="report-reasons">
            <legend>{t('report.reason')}</legend>
            {REASONS.map((value) => (
              <label key={value} className="report-reason">
                <md-radio
                  name="report-reason"
                  value={value}
                  checked={reason === value}
                  aria-label={t(`report.reasons.${value}.label`)}
                  onchange={() => setReason(value)}
                />
                <span className="report-reason-text">
                  <span className="report-reason-label">{t(`report.reasons.${value}.label`)}</span>
                  <span className="report-reason-hint">{t(`report.reasons.${value}.hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <TextField
            label={t('report.details')}
            value={details}
            onValueChange={setDetails}
            rows={3}
            maxLength={DETAILS_MAX}
          />
          {message && (
            <p className="report-error" role="alert">
              <Icon name="error" filled />
              {message}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

interface ReportButtonProps {
  target: ReportTarget;
  className?: string;
}

/** "Signaler", with a flag. Opens the dialog; a signed-out visitor is sent to sign in instead. */
export function ReportButton({target, className}: ReportButtonProps) {
  const {t} = useT('components');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const [open, setOpen] = useState(false);
  // The dialog is mounted on first use, then kept so that it can animate out.
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <md-text-button
        className={className}
        disabled={!canWrite}
        onclick={() =>
          void auth.run(() => {
            setMounted(true);
            setOpen(true);
          })
        }
      >
        <md-icon slot="icon" className="filled" aria-hidden="true">
          flag
        </md-icon>
        {t('report.button')}
      </md-text-button>
      {mounted && <ReportDialog open={open} onClose={() => setOpen(false)} target={target} />}
    </>
  );
}
