import {useT} from '@/i18n/useT';

import {Card} from './Card';
import {Bento, Page} from './layout';

/** An indeterminate spinner, centered where it is placed. */
export function Spinner({label}: {label?: string}) {
  const {t} = useT('common');
  return (
    <div className="loading" role="status">
      <md-circular-progress indeterminate aria-label={label ?? t('status.loading')} />
    </div>
  );
}

/** The loading state of a whole page: one card with a spinner. No skeletons. */
export function PageLoading() {
  return (
    <Page>
      <Bento>
        <Card>
          <Spinner />
        </Card>
      </Bento>
    </Page>
  );
}
