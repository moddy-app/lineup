/**
 * Numbers and dates in the page's language. The kit's formatters read
 * <html lang>, which the i18n layer keeps in step with the chosen language;
 * the date helpers here do the same.
 */

export {formatCompact, formatNumber, formatRelativeTime} from '@moddy/design-kit/src/utils/format.ts';

const lang = () => document.documentElement.lang || 'en';

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date from the API: an ISO timestamp, or a calendar date (YYYY-MM-DD).
 * A calendar date has no time zone: it is read as that day in the viewer's
 * zone, so it never shifts to the day before in the Americas.
 */
export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const calendar = CALENDAR_DATE.exec(value);
  if (calendar) return new Date(Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3]));
  return new Date(value);
}

export type DateStyle = 'short' | 'medium' | 'long' | 'full';

/** "12 mars 2026" (medium), in the current language. */
export function formatDate(value: string | Date, style: DateStyle = 'medium', locale = lang()): string {
  return new Intl.DateTimeFormat(locale, {dateStyle: style}).format(parseDate(value));
}

/** "mars 2026": the precision of an experience's dates. */
export function formatMonthYear(value: string | Date, locale = lang()): string {
  return new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(parseDate(value));
}
