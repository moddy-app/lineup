/**
 * Numbers in the page's language. Numbers that change (stats, counters)
 * also use tabular figures (.numeric, .stat-value).
 */

const lang = () => document.documentElement.lang || 'en';

/** 12 345 in French, 12,345 in English. */
export function formatNumber(value: number, locale = lang()) {
  return new Intl.NumberFormat(locale).format(value);
}

/** 1,2 k / 1.2K: for counters that can grow large. */
export function formatCompact(value: number, locale = lang()) {
  return new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 1}).format(value);
}

/** "3 hours ago", "il y a 3 heures". */
export function formatRelativeTime(date: Date | number, locale = lang()) {
  const seconds = Math.round((+new Date(date) - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat(locale, {numeric: 'auto'});
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(seconds, 'second');
}
