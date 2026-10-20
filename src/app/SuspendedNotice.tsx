import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {safeHttpsUrl} from '@/lib/url';
import {Bento, Card, CardActions, CardHead, LinkButton, Page, Shape} from '@/ui';

import {SanctionDetails} from './SanctionDetails';

/**
 * Shown at the top of every public page while the account is suspended. It is
 * not dismissable: the person can read everything but write nothing, and must
 * be able to see why wherever they are. Pages that need a session show the
 * full SuspendedScreen instead.
 */
export function SuspendedNotice() {
  const {t} = useT('common');
  const session = useSession();
  if (session.status !== 'suspended') return null;
  const sanction = session.sanction;
  const sanctionUrl = safeHttpsUrl(sanction?.violations_url);

  return (
    <Page className="suspended-notice">
      <Bento>
        <Card as="section" aria-labelledby="suspended-notice-title">
          <CardHead>
            <Shape shape="pentagon" tone="tertiary" icon="block" small />
            <h2 id="suspended-notice-title">{t('suspended.title')}</h2>
          </CardHead>
          <p>{t('suspended.noticeBody')}</p>
          {sanction && <SanctionDetails sanction={sanction} />}
          <CardActions>
            {sanctionUrl && <LinkButton to={sanctionUrl}>{t('suspended.viewSanction')}</LinkButton>}
            <md-outlined-button onclick={() => void session.logout()}>{t('auth.logout')}</md-outlined-button>
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
