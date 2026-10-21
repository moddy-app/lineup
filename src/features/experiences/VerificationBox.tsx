/**
 * The verification of one of my experiences: its state, what the check found
 * (owner only) and the actions. "Verify automatically" comes first for a current
 * server experience; every failure of it leads to the manual review in the same
 * place (LINEUP.md §7, §13).
 */

import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useRequestExperienceReview, useVerifyExperience} from '@/api/mutations';
import {queryKeys} from '@/api/queryKeys';
import type {PrivateExperience} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useSession} from '@/auth/session';
import {useReauthenticate} from '@/auth/reauth';
import {useAuthAction} from '@/auth/useAuthAction';
import {RelativeTime, RetryButton} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatDate} from '@/lib/format';
import {Chip, Chips, Icon, TextField, useSnackbar} from '@/ui';

import {NOTE_MAX, verificationOffer} from './experienceForm';

type Mode = 'idle' | 'review' | 'reauth';

export function VerificationBox({experience}: {experience: PrivateExperience}) {
  const {t} = useT('experiences');
  const {t: tErrors} = useT('errors');
  useLanguage();
  const session = useSession();
  const auth = useAuthAction();
  const reauthenticate = useReauthenticate();
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  const verify = useVerifyExperience();
  const review = useRequestExperienceReview();

  const [mode, setMode] = useState<Mode>('idle');
  const [note, setNote] = useState('');
  const [verifyError, setVerifyError] = useState<unknown>(null);
  const [reauthError, setReauthError] = useState<unknown>(null);
  const [reviewError, setReviewError] = useState<unknown>(null);
  const wait = useRetryAfter(verifyError);

  const {verification} = experience;
  const offer = verificationOffer(experience);
  const hasScopes = session.me?.has_lineup_scopes ?? true;
  const busy = verify.isPending || review.isPending || !session.canWrite;

  async function startVerify() {
    setVerifyError(null);
    setReviewError(null);
    if (!hasScopes) {
      setMode('reauth');
      return;
    }
    setMode('idle');
    try {
      const result = await auth.run(() => verify.mutateAsync(experience.id));
      if (result) snackbar.show({message: t('verify.success')});
    } catch (error) {
      if (hasCode(error, 'lineup_reauth_required')) {
        setReauthError(error);
        setMode('reauth');
        return;
      }
      setVerifyError(error);
    }
  }

  async function sendReview() {
    setReviewError(null);
    try {
      const result = await auth.run(() =>
        review.mutateAsync({experienceId: experience.id, note: note.trim() || undefined}),
      );
      if (result) {
        setMode('idle');
        setNote('');
        setVerifyError(null);
        snackbar.show({message: t('review.sent')});
      }
    } catch (error) {
      setReviewError(error);
      // The list was out of date (already verified, already pending): read it again.
      if (hasCode(error, 'lineup_experience_already_verified', 'lineup_review_already_pending')) {
        void queryClient.invalidateQueries({queryKey: queryKeys.myExperiences()});
      }
    }
  }

  const failedReason = hasCode(verifyError, 'lineup_verification_failed', 'lineup_verification_not_applicable');
  const outage = hasCode(verifyError, 'discord_unavailable');
  const limited = hasCode(verifyError, 'lineup_rate_limited');
  const otherError = verifyError != null && !failedReason && !outage && !limited;
  const evidence = verification.evidence;

  return (
    <div className="exp-verification">
      {verification.status === 'verified' && (
        <div className="exp-status-text">
          <p>
            <Icon name="verified" filled />
            <span>
              {verification.method === 'discord_oauth'
                ? t('status.verified.discord')
                : verification.method
                  ? t('status.verified.staff')
                  : t('status.verified.generic')}
              {verification.verified_at && <> {t('status.on', {date: formatDate(verification.verified_at, 'long')})}</>}
            </span>
          </p>
          {evidence &&
            (evidence.permissions?.length || evidence.owner || evidence.staff_note || evidence.checked_at) && (
              <details className="exp-evidence">
                <summary>{t('evidence.summary')}</summary>
                <dl>
                  {evidence.owner && (
                    <>
                      <dt>{t('evidence.owner')}</dt>
                      <dd>{t('evidence.ownerYes')}</dd>
                    </>
                  )}
                  {evidence.permissions && evidence.permissions.length > 0 && (
                    <>
                      <dt>{t('evidence.permissions')}</dt>
                      <dd>
                        <Chips>
                          {evidence.permissions.map((name) => (
                            <Chip key={name}>{t(`evidence.permission.${name}`, {defaultValue: name})}</Chip>
                          ))}
                        </Chips>
                      </dd>
                    </>
                  )}
                  {evidence.checked_at && (
                    <>
                      <dt>{t('evidence.checkedAt')}</dt>
                      <dd>
                        <RelativeTime value={evidence.checked_at} />
                      </dd>
                    </>
                  )}
                  {evidence.staff_note && (
                    <>
                      <dt>{t('evidence.staffNote')}</dt>
                      <dd>{evidence.staff_note}</dd>
                    </>
                  )}
                </dl>
                <p className="exp-evidence-note">{t('evidence.private')}</p>
              </details>
            )}
        </div>
      )}

      {verification.status === 'pending' && (
        <div className="exp-status-text">
          <p>
            <Icon name="hourglass_top" filled />
            <span>
              {t('status.pending')}
              {evidence?.requested_at && (
                <>
                  {' '}
                  <RelativeTime value={evidence.requested_at} />
                </>
              )}
            </span>
          </p>
          {evidence?.review_note && (
            <p className="exp-note">
              <strong>{t('review.yourNote')}</strong> {evidence.review_note}
            </p>
          )}
        </div>
      )}

      {verification.status === 'rejected' && (
        <div className="exp-status-text is-error">
          <p>
            <Icon name="block" filled />
            <span>
              <strong>{t('status.rejected')}</strong>{' '}
              {verification.rejection_reason ? verification.rejection_reason : t('status.rejectedNoReason')}
            </span>
          </p>
          <p className="exp-note">{t('status.rejectedHelp')}</p>
        </div>
      )}

      {verification.status === 'unverified' && (
        <p className="exp-note">
          {experience.kind === 'service'
            ? t('status.unverified.service')
            : experience.is_current
              ? t('status.unverified.current')
              : t('status.unverified.ended')}
        </p>
      )}

      {mode === 'reauth' && (
        <div className="exp-inline-panel" role="status">
          <p>
            <strong>{t('reauth.title')}</strong> {t('reauth.body')}
          </p>
          <div className="exp-actions-row">
            <md-outlined-button type="button" disabled={busy} onclick={() => reauthenticate(reauthError ?? undefined)}>
              <md-icon slot="icon" className="filled" aria-hidden="true">
                lock_open
              </md-icon>
              {t('reauth.action')}
            </md-outlined-button>
            <md-text-button type="button" onclick={() => setMode('idle')}>
              {t('review.cancel')}
            </md-text-button>
          </div>
        </div>
      )}

      {failedReason && (
        <div className="exp-inline-panel is-error" role="alert">
          <p>{errorMessage(verifyError, tErrors)}</p>
        </div>
      )}

      {limited && (
        <p className="exp-note" role="alert">
          {errorMessage(verifyError, tErrors, {seconds: wait.seconds})}
        </p>
      )}

      {outage && (
        <div className="exp-inline-panel" role="status">
          <p>{errorMessage(verifyError, tErrors)}</p>
          <div className="exp-actions-row">
            <RetryButton onRetry={() => void startVerify()} error={verifyError} busy={verify.isPending} />
          </div>
        </div>
      )}

      {otherError && (
        <p className="exp-error" role="alert">
          {errorMessage(verifyError, tErrors)}
        </p>
      )}

      {mode === 'review' && offer.review && (
        <div className="exp-inline-panel">
          <p>{t('review.intro')}</p>
          <TextField
            label={t('review.note')}
            value={note}
            onValueChange={setNote}
            rows={3}
            maxLength={NOTE_MAX}
            supportingText={t('review.noteHelp')}
          />
          {reviewError != null && (
            <p className="exp-error" role="alert">
              {errorMessage(reviewError, tErrors)}
            </p>
          )}
          <div className="exp-actions-row">
            <md-outlined-button type="button" disabled={busy} onclick={() => void sendReview()}>
              {review.isPending ? t('review.sending') : t('review.send')}
            </md-outlined-button>
            <md-text-button type="button" disabled={review.isPending} onclick={() => setMode('idle')}>
              {t('review.cancel')}
            </md-text-button>
          </div>
        </div>
      )}

      {mode !== 'review' && mode !== 'reauth' && (offer.auto || offer.review || offer.pending) && !outage && (
        <div className="exp-actions-row">
          {offer.auto && (
            <md-outlined-button type="button" disabled={busy || wait.active} onclick={() => void startVerify()}>
              <md-icon slot="icon" className="filled" aria-hidden="true">
                verified_user
              </md-icon>
              {wait.active ? t('verify.waiting', {seconds: wait.seconds}) : t('verify.action')}
            </md-outlined-button>
          )}
          {offer.review &&
            (offer.auto ? (
              <md-text-button type="button" disabled={busy} onclick={() => setMode('review')}>
                {t('review.open')}
              </md-text-button>
            ) : (
              <md-outlined-button type="button" disabled={busy} onclick={() => setMode('review')}>
                <md-icon slot="icon" className="filled" aria-hidden="true">
                  rate_review
                </md-icon>
                {t('review.open')}
              </md-outlined-button>
            ))}
          {offer.pending && (
            <md-outlined-button type="button" disabled>
              {t('review.pending')}
            </md-outlined-button>
          )}
        </div>
      )}
    </div>
  );
}
