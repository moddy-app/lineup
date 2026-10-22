import {useT} from '@/i18n/useT';

import {Page} from './layout';

/** An indeterminate spinner (four colors), centered where it is placed. It fades in after a moment, so quick loads stay calm. */
export function Spinner({label}: {label?: string}) {
  const {t} = useT('common');
  return (
    <div className="loading" role="status">
      <md-circular-progress indeterminate fourColor aria-label={label ?? t('status.loading')} />
    </div>
  );
}

/**
 * The loading state of a whole page: a large spinner and its label, centered
 * in the content area. The bar at the top of the window (`TopProgress`) shows
 * at the same time. No skeletons.
 */
export function PageLoading() {
  const {t} = useT('common');
  return (
    <Page>
      <div className="page-loading" role="status">
        <md-circular-progress indeterminate fourColor aria-label={t('status.loading')} />
        <p className="page-loading-label" aria-hidden="true">
          {t('status.loading')}
        </p>
      </div>
    </Page>
  );
}
