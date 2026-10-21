/** A time zone as the API stores it: an IANA name (`Europe/Paris`) or `UTC±HH:MM`. */

const UTC_OFFSET = /^UTC([+-])(\d{2}):(\d{2})$/;

const lang = () => document.documentElement.lang || 'en';

/** The offset of a `UTC±HH:MM` zone in minutes; null for anything else. */
export function utcOffsetMinutes(timezone: string): number | null {
  const match = UTC_OFFSET.exec(timezone);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * The time of day in a zone ("14:32", "2:32 PM" in English), or null when the
 * zone is not one this browser knows.
 */
export function localTime(timezone: string, now: number | Date, locale = lang()): string | null {
  const offset = utcOffsetMinutes(timezone);
  const options: Intl.DateTimeFormatOptions = {hour: 'numeric', minute: '2-digit'};
  try {
    if (offset !== null) {
      return new Intl.DateTimeFormat(locale, {...options, timeZone: 'UTC'}).format(+new Date(now) + offset * 60_000);
    }
    return new Intl.DateTimeFormat(locale, {...options, timeZone: timezone}).format(now);
  } catch {
    return null;
  }
}
