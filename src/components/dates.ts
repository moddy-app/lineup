/** Date helpers of the domain components. */

import {parseDate} from '@/lib/format';

const lang = () => document.documentElement.lang || 'en';

/** "mardi 20 octobre 2026 à 14:03": the title of a relative date. */
export function formatDateTime(value: string | Date, locale = lang()): string {
  return new Intl.DateTimeFormat(locale, {dateStyle: 'full', timeStyle: 'short'}).format(parseDate(value));
}

/** Whole days between two instants, rounded down. */
export function daysBetween(from: string | Date, to: number | Date): number {
  return Math.floor((+new Date(to) - +parseDate(from)) / 86_400_000);
}
