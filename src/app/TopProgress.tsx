import {useIsFetching} from '@tanstack/react-query';
import {useEffect, useState} from 'react';
import {useNavigation} from 'react-router';

import {useT} from '@/i18n/useT';

/** How long the bar stays after the work ends, so that a page load that follows a route load reads as one. */
const LINGER_MS = 250;

/**
 * The bar at the very top of the window, above the app bar: shown while the
 * next page loads (its code) and while a query loads its first data (a
 * background refresh of data already on screen does not count).
 */
export function TopProgress() {
  const {t} = useT('common');
  const navigation = useNavigation();
  const firstLoads = useIsFetching({predicate: (query) => query.state.data === undefined});
  const busy = navigation.state !== 'idle' || firstLoads > 0;

  // Set during render when the work ends (no effect that sets state); cleared by the timer below.
  const [wasBusy, setWasBusy] = useState(busy);
  const [lingering, setLingering] = useState(false);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    setLingering(!busy);
  }
  useEffect(() => {
    if (!lingering) return;
    const timer = window.setTimeout(() => setLingering(false), LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [lingering]);

  if (!busy && !lingering) return null;
  return <md-linear-progress className="top-progress" indeterminate fourColor aria-label={t('status.loading')} />;
}
