import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Bento, Card, CardActions, Page, Shape} from '@/ui';

import {usePageTitle} from './usePageTitle';

/** What the page behind the prompt is for: one sentence under the title. */
export type AuthPurpose = 'default' | 'profile' | 'experiences' | 'posts' | 'editor' | 'claim' | 'manage';

/**
 * What an anonymous visitor sees on a page that needs a session: a special
 * page with a single way forward, Discord. After signing in the browser comes
 * back to this very address.
 */
export function SignInPrompt({purpose = 'default'}: {purpose?: AuthPurpose}) {
  const {t} = useT('common');
  const session = useSession();
  usePageTitle(t('auth.signInRequired.title'));

  return (
    <Page special>
      <Bento>
        <Card variant="hero">
          <Shape shape="hexagon" tone="secondary" icon="login" />
          <h1>{t('auth.signInRequired.title')}</h1>
          <p>{t(`auth.signInRequired.purpose.${purpose}`)}</p>
          <CardActions>
            <md-filled-button onclick={() => session.login(window.location.href)}>
              {t('auth.loginWithDiscord')}
            </md-filled-button>
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
