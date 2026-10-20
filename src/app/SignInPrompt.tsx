import {errorMessage} from '@/api/errors';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Bento, Card, CardActions, Page, Shape} from '@/ui';

import {usePageTitle} from './usePageTitle';

/** What the page behind the prompt is for: one sentence under the title. */
export type AuthPurpose = 'default' | 'profile' | 'experiences' | 'posts' | 'editor' | 'claim' | 'manage';

/**
 * What an anonymous visitor sees on a page that needs a session: a special
 * page with a single way forward, Discord. After signing in the browser comes
 * back to this very address. When the session could not be read at all (the API
 * is unreachable) the page says so and offers to ask again, since it is not known
 * that the person is signed out.
 */
export function SignInPrompt({purpose = 'default'}: {purpose?: AuthPurpose}) {
  const {t} = useT('common');
  const {t: tErrors} = useT('errors');
  const session = useSession();
  usePageTitle(t('auth.signInRequired.title'));

  return (
    <Page special>
      <Bento>
        <Card variant="hero">
          <Shape shape="hexagon" tone="secondary" icon="login" />
          <h1>{t('auth.signInRequired.title')}</h1>
          <p>{t(`auth.signInRequired.purpose.${purpose}`)}</p>
          {session.error && (
            <p role="status">
              {t('auth.sessionError.note')} {errorMessage(session.error, tErrors)}
            </p>
          )}
          <CardActions>
            <md-filled-button onclick={() => session.login(window.location.href)}>
              {t('auth.loginWithDiscord')}
            </md-filled-button>
            {session.error && (
              <md-outlined-button onclick={() => session.refresh()}>{t('actions.retry')}</md-outlined-button>
            )}
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
