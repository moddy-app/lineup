import {useEffect} from 'react';
import {useRouteError} from 'react-router';

import {useT} from '@/i18n/useT';
import {Bento, Card, CardActions, LinkButton, Page, Shape} from '@/ui';

import {paths} from './paths';
import {usePageTitle} from './usePageTitle';

/**
 * The router's error boundary: a route threw, or its module failed to load
 * (an old tab after a deploy, a lost connection). The app bar stays; the
 * page offers a reload and the way back. Unknown URLs never get here: the
 * catch-all route renders the 404.
 */
export function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorCard />;
}

function ErrorCard() {
  const {t} = useT('common');
  usePageTitle(t('routeError.title'));
  return (
    <Page special>
      <Bento>
        <Card variant="hero">
          <Shape shape="diamond" tone="secondary" icon="error" />
          <h1>{t('routeError.title')}</h1>
          <p>{t('routeError.body')}</p>
          <CardActions>
            <md-filled-button onclick={() => window.location.reload()}>{t('actions.reload')}</md-filled-button>
            <LinkButton to={paths.feed()} variant="outlined">
              {t('actions.backToFeed')}
            </LinkButton>
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
