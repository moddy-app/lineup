/** Dates the way the Python backend writes them (LINEUP.md §0), and Discord snowflakes. */

import type {CalendarDate, IsoDateTime, Snowflake} from '@/api/types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** `2026-10-20T14:03:11.482000+00:00`: isoformat with microseconds and a numeric offset. */
export function iso(date: Date | number): IsoDateTime {
  const value = typeof date === 'number' ? new Date(date) : date;
  return value.toISOString().replace('Z', '000+00:00');
}

/** `YYYY-MM-DD` of a date, in UTC. */
export function calendarDate(date: Date | number): CalendarDate {
  return (typeof date === 'number' ? new Date(date) : date).toISOString().slice(0, 10);
}

const DISCORD_EPOCH = 1_420_070_400_000n;

/** A snowflake whose embedded creation time is `at` (Discord ids carry their date). */
export function snowflake(at: Date | number, sequence = 1): Snowflake {
  const ms = BigInt(typeof at === 'number' ? at : at.getTime());
  return ((ms - DISCORD_EPOCH) << 22n | (BigInt(sequence) & 0x3fffffn)).toString();
}

/** When a snowflake was created (the account or server creation date, LINEUP.md §6.2, §6.3). */
export function snowflakeDate(id: Snowflake): Date {
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

/** Whether `value` is a calendar date that exists (`2026-02-30` is not one). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && calendarDate(date) === value;
}
