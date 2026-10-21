/** "Données Discord potentiellement anciennes": shown when a profile's `stale` is true. Discreet. */

import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

export function StaleNotice({className}: {className?: string}) {
  const {t} = useT('components');
  return (
    <p className={cx('stale-notice', className)}>
      <Icon name="info" filled />
      {t('stale.text')}
    </p>
  );
}
