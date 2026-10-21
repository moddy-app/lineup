/** The last step: what will be sent, step by step, and the banner of a failed submit. */

import {useMemo} from 'react';

import {isApiError} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {paths} from '@/app/paths';
import {isRetryable, QuotaMeter, RetryButton} from '@/components';
import {useT} from '@/i18n/useT';
import {Icon, LinkButton, Row, RowBody, Rows, Shape} from '@/ui';

import type {StepId} from './form';

const SHAPES = ['hexagon', 'square', 'pentagon', 'diamond', 'heptagon', 'octagon'] as const;
const TONES = ['primary', 'tertiary', 'secondary'] as const;

export interface ReviewRow {
  step: StepId;
  title: string;
  summary: string;
  state: 'done' | 'error' | 'todo';
}

interface ReviewStepProps {
  rows: ReviewRow[];
  onGo: (step: StepId) => void;
  quota?: {used: number; limit: number} | null;
}

export function ReviewStep({rows, onGo, quota}: ReviewStepProps) {
  const {t} = useT('editor');
  const invalid = rows.filter((row) => row.state === 'error').length;
  return (
    <div className="ed-fields">
      {invalid > 0 && (
        <p className="ed-error" role="alert">
          <Icon name="error" filled />
          {t('review.invalid', {count: invalid})}
        </p>
      )}
      <Rows as="ul" className="ed-review">
        {rows.map((row, index) => (
          <Row key={row.step}>
            <Shape
              small
              shape={SHAPES[index % SHAPES.length]}
              tone={row.state === 'error' ? 'solid' : TONES[index % TONES.length]}
              icon={row.state === 'error' ? 'priority_high' : row.state === 'done' ? 'check' : 'more_horiz'}
            />
            <RowBody title={row.title} meta={row.summary} />
            <md-text-button aria-label={t('review.edit', {step: row.title})} onclick={() => onGo(row.step)}>
              {t('review.editShort')}
            </md-text-button>
          </Row>
        ))}
      </Rows>
      {quota && <QuotaMeter used={quota.used} limit={quota.limit} scope="user" />}
      {quota && quota.used >= quota.limit && <p className="ed-hint">{t('review.quotaFull')}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failed submit
// ---------------------------------------------------------------------------

const QUOTA_CODES = ['lineup_quota_exceeded'];
const CLAIM_CODES = ['lineup_guild_profile_missing', 'guild_suspended', 'lineup_guild_forbidden'];
const LEAVE_CODES = ['lineup_post_hidden', 'lineup_post_forbidden', 'lineup_post_not_found', 'lineup_post_invalid_status'];

interface SubmitBannerProps {
  error: unknown;
  /** The write that failed in a post being edited was partly done (the changes are saved). */
  editing: boolean;
  /** "Save as draft" after a quota error on a new post. */
  onSaveDraft?: () => void;
  onRetry: () => void;
  busy: boolean;
}

export function SubmitBanner({error, editing, onSaveDraft, onRetry, busy}: SubmitBannerProps) {
  const {t} = useT('editor');
  const {t: tErrors} = useT('errors');
  const code = isApiError(error) ? error.code : null;
  const message = useMemo(() => errorMessage(error, tErrors), [error, tErrors]);
  const quota = code !== null && QUOTA_CODES.includes(code);
  const claim = code !== null && CLAIM_CODES.includes(code);
  const leave = code !== null && LEAVE_CODES.includes(code);

  return (
    <div className="ed-banner" role="alert">
      <Icon name={quota ? 'inventory_2' : 'error'} filled />
      <div className="ed-banner-body">
        <p>{message}</p>
        {quota && <p className="ed-hint">{editing ? t('banner.quotaEdit') : t('banner.quotaNew')}</p>}
        <div className="ed-banner-actions">
          {quota && !editing && onSaveDraft && (
            <md-filled-button disabled={busy} onclick={onSaveDraft}>
              {t('banner.saveDraft')}
            </md-filled-button>
          )}
          {(quota || leave) && (
            <LinkButton to={paths.myPosts()} variant="outlined">
              {t('banner.myPosts')}
            </LinkButton>
          )}
          {claim && (
            <LinkButton to={paths.guildClaim()} variant="outlined">
              {t('banner.claim')}
            </LinkButton>
          )}
          {!quota && !leave && !claim && isRetryable(error) && <RetryButton onRetry={onRetry} error={error} busy={busy} />}
        </div>
      </div>
    </div>
  );
}
