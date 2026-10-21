/**
 * A person's or post's time zone (an IANA name or `UTC±HH:MM`) with the time
 * it is there now ("14:32 heure locale"), updated every minute. By default a
 * mono pill and the time; `inline` is a quiet line of text for a profile's
 * metadata. A zone the browser does not know shows the name alone.
 */

import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon, Pill} from '@/ui';

import {localTime} from './timezone';
import {useNow} from './useNow';

interface TimezoneLabelProps {
  timezone: string | null | undefined;
  /** Plain text with a clock icon instead of a pill. */
  inline?: boolean;
  /** Just the text "Europe/Paris · 14:32 local time", no icon: for a line that has its own. */
  bare?: boolean;
  className?: string;
}

export function TimezoneLabel({timezone, inline, bare, className}: TimezoneLabelProps) {
  const {t} = useT('components');
  useLanguage();
  const now = useNow();
  if (!timezone) return null;
  const time = localTime(timezone, now);
  if (bare) {
    return (
      <span className={cx('timezone-text numeric', className)}>
        {timezone}
        {time && ` · ${t('timezone.localTime', {time})}`}
      </span>
    );
  }
  return (
    <span className={cx('timezone', inline && 'is-inline', className)}>
      <Icon name="schedule" className="timezone-icon" filled={inline} />
      {inline ? (
        <span className="timezone-name">
          <span className="visually-hidden">{t('timezone.label')}: </span>
          {timezone}
        </span>
      ) : (
        <Pill>
          <span className="visually-hidden">{t('timezone.label')}: </span>
          {timezone}
        </Pill>
      )}
      {time && <span className="timezone-time numeric">{t('timezone.localTime', {time})}</span>}
    </span>
  );
}
