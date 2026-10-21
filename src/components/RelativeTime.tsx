/**
 * A date as "il y a 3 heures", in a `<time>` whose `title` has the full date.
 * It refreshes every minute and follows the language.
 */

import {useLanguage} from '@/i18n/useLanguage';
import {formatRelativeTime, parseDate} from '@/lib/format';

import {formatDateTime} from './dates';
import {useNow} from './useNow';

interface RelativeTimeProps {
  /** An ISO timestamp from the API. */
  value: string;
  className?: string;
  /** Wraps the relative text in a sentence ("Mis à jour il y a 3 heures"). */
  format?: (relative: string) => string;
}

export function RelativeTime({value, className, format}: RelativeTimeProps) {
  useLanguage();
  useNow();
  const date = parseDate(value);
  if (Number.isNaN(+date)) return null;
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)} className={className}>
      {format ? format(formatRelativeTime(date)) : formatRelativeTime(date)}
    </time>
  );
}
