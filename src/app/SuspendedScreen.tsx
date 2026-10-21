import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {safeHttpsUrl} from '@/lib/url';
import {Bento, Card, CardActions, LinkButton, Page, Shape} from '@/ui';

import {paths} from './paths';
import {SanctionDetails} from './SanctionDetails';
import {usePageTitle} from './usePageTitle';

/**
 * The page a suspended account sees in place of the pages that need a session
 * (LINEUP.md §2: no sign-in loop, show the sanction). Public pages stay open;
 * those show the notice instead (SuspendedNotice).
 */
export function SuspendedScreen() {
  const {t} = useT('common');
  const session = useSession();
  usePageTitle(t('suspended.title'));
  const sanction = session.sanction;
  const sanctionUrl = safeHttpsUrl(sanction?.violations_url);

  return (
    <Page special>
      <Bento>
        <Card variant="hero">
          <Shape shape="pentagon" tone="tertiary" icon="block" />
          <h1>{t('suspended.title')}</h1>
          <p>{t('suspended.body')}</p>
          {sanction && <SanctionDetails sanction={sanction} />}
          <CardActions>
            {sanctionUrl && <LinkButton to={sanctionUrl}>{t('suspended.viewSanction')}</LinkButton>}
            <LinkButton to={paths.feed()} variant="outlined">
              {t('actions.backToFeed')}
            </LinkButton>
            <md-outlined-button onclick={() => void session.logout()}>{t('auth.logout')}</md-outlined-button>
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
