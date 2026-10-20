/**
 * A person's or post's time zone (an IANA name or `UTC±HH:MM`) as a mono pill,
 * with the time it is there now ("14:32 heure locale"), updated every minute.
 * A zone the browser does not know shows the pill alone.
 */

import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon, Pill} from '@/ui';

import {localTime} from './timezone';
import {useNow} from './useNow';

interface TimezoneLabelProps {
  timezone: string | null | undefined;
  className?: string;
}

export function TimezoneLabel({timezone, className}: TimezoneLabelProps) {
  const {t} = useT('components');
  useLanguage();
  const now = useNow();
  if (!timezone) return null;
  const time = localTime(timezone, now);
  return (
    <span className={cx('timezone', className)}>
      <Icon name="schedule" className="timezone-icon" />
      <Pill>
        <span className="visually-hidden">{t('timezone.label')}: </span>
        {timezone}
      </Pill>
      {time && <span className="timezone-time numeric">{t('timezone.localTime', {time})}</span>}
    </span>
  );
}
