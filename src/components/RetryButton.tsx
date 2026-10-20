/**
 * "Réessayer". After a 429 or a 503 it waits out the delay the API gave
 * (`Retry-After`): disabled, with the seconds left on the button.
 */

import {useRetryAfter} from '@/api/useRetryAfter';
import {useT} from '@/i18n/useT';

interface RetryButtonProps {
  onRetry: () => void;
  /** The failure being retried: its `retryAfter` sets the wait. */
  error?: unknown;
  /** The retry is running. */
  busy?: boolean;
}

export function RetryButton({onRetry, error, busy}: RetryButtonProps) {
  const {t} = useT('components');
  const {t: tCommon} = useT('common');
  const {seconds, active} = useRetryAfter(error);
  return (
    <md-outlined-button disabled={active || busy} onclick={onRetry}>
      <md-icon slot="icon" className="filled" aria-hidden="true">
        refresh
      </md-icon>
      {active ? t('errorState.retryIn', {seconds}) : tCommon('actions.retry')}
    </md-outlined-button>
  );
}
