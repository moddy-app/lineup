import {useT} from '@/i18n/useT';
import {Bento, Card, CardActions, LinkButton, Page, Shape} from '@/ui';

import {paths} from './paths';
import {usePageTitle} from './usePageTitle';

/** The 404: a real page (the router's catch-all). */
export function Component() {
  const {t} = useT('common');
  usePageTitle(t('notFound.title'));
  return (
    <Page special>
      <Bento>
        <Card variant="hero">
          <Shape shape="octagon" tone="tertiary" icon="explore_off" />
          <h1>{t('notFound.title')}</h1>
          <p>{t('notFound.body')}</p>
          <CardActions>
            <LinkButton to={paths.feed()} icon="campaign">
              {t('actions.backToFeed')}
            </LinkButton>
          </CardActions>
        </Card>
      </Bento>
    </Page>
  );
}
