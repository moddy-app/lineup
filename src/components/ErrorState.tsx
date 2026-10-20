/**
 * What shows in place of content that failed to load. The sentence comes from
 * `errorMessage` (one specific sentence per API code). A 404 is "not found",
 * not an outage, and has no retry. A network failure, a server error, a 429
 * or a 503 can be retried; the last two wait out the delay the API gave.
 */

import {errorMessage} from '@/api/errors';
import {isApiError} from '@/api/client';
import {useT} from '@/i18n/useT';
import {Card, CardActions, Shape} from '@/ui';

import {isRetryable} from './isRetryable';
import {RetryButton} from './RetryButton';

interface ErrorStateProps {
  error: unknown;
  /** Reload the content. The button shows only when trying again can help. */
  onRetry?: () => void;
  /** The retry is running. */
  retrying?: boolean;
  /** A band inside a Section instead of a card. */
  compact?: boolean;
}

export function ErrorState({error, onRetry, retrying, compact}: ErrorStateProps) {
  const {t} = useT('components');
  const {t: tErrors} = useT('errors');
  const notFound = isApiError(error) && error.status === 404;
  const offline = isApiError(error) && error.code === 'network_error';
  const title = notFound ? t('errorState.notFoundTitle') : t('errorState.title');
  const icon = notFound ? 'search_off' : offline ? 'wifi_off' : 'error';
  const retry = onRetry && isRetryable(error) ? <RetryButton onRetry={onRetry} error={error} busy={retrying} /> : null;
  const message = errorMessage(error, tErrors);

  if (compact) {
    return (
      <div className="empty-state compact error-state">
        <Shape shape="octagon" tone="secondary" icon={icon} small />
        <div className="empty-state-text">
          <h3>{title}</h3>
          <p role="alert">{message}</p>
        </div>
        {retry && <div className="empty-state-action">{retry}</div>}
      </div>
    );
  }
  return (
    <Card className="empty-state error-state">
      <Shape shape={notFound ? 'hexagon' : 'octagon'} tone={notFound ? 'tertiary' : 'secondary'} icon={icon} />
      <h2>{title}</h2>
      <p role="alert">{message}</p>
      {retry && <CardActions>{retry}</CardActions>}
    </Card>
  );
}
