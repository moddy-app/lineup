import {errorMessage} from '@/api/errors';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Bento, Card, CardActions, Page, Shape} from '@/ui';

import {usePageTitle} from './usePageTitle';

/**
 * A page that needs a session, when the session itself could not be read (the
 * API is unreachable): neither a sign-in prompt, which would be a lie, nor a
 * crash. The message says what happened; one button asks again.
 */
export function SessionError() {
  const {t} = useT('common');
  const {t: tErrors} = useT('errors');
  const session = useSession();
  usePageTitle(t('auth.sessionError.title'));

  return (
    <Page special>
      <Bento>
        <Card variant="hero">
          <Shape shape="diamond" tone="secondary" icon="cloud_off" />
          <h1>{t('auth.sessionError.title')}</h1>
          <p>{errorMessage(session.error, tErrors)}</p>
          <CardActions>
            <md-filled-button onclick={() => session.refresh()}>{t('actions.retry')}</md-filled-button>
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
