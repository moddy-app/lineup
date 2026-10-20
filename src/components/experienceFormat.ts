/** An experience, in words: its dates, its duration, its verification. */

import type {PublicVerification, VerificationMethod} from '@/api/types';
import {formatDate, formatMonthYear} from '@/lib/format';

import type {ComponentsT} from './componentsT';

interface Day {
  year: number;
  month: number;
  day: number;
}

function parseDay(value: string): Day {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return {year, month, day};
}

/** The next calendar day, by calendar arithmetic (no time zone, no daylight saving). */
function nextDay({year, month, day}: Day): Day {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate()};
}

function today(now: Date): Day {
  return {year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate()};
}

/**
 * Whole months between a start date and an end date (`YYYY-MM-DD`, the end day
 * included), or until today when the experience goes on.
 */
export function monthsBetween(start: string, end: string | null, now: Date = new Date()): number {
  const from = parseDay(start);
  const to = end ? nextDay(parseDay(end)) : today(now);
  const months = (to.year - from.year) * 12 + (to.month - from.month) - (to.day < from.day ? 1 : 0);
  return Math.max(0, months);
}

/** "2 ans 3 mois", "7 mois", "2 ans", "moins d'un mois". */
export function formatDuration(months: number, t: ComponentsT): string {
  if (months < 1) return t('experience.duration.lessThanMonth');
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearsText = t('experience.duration.years', {count: years, value: years});
  const monthsText = t('experience.duration.months', {count: rest, value: rest});
  if (years === 0) return monthsText;
  return rest === 0 ? yearsText : t('experience.duration.both', {years: yearsText, months: monthsText});
}

/** "mars 2024 à aujourd'hui", "janvier 2021 à mars 2023". */
export function formatRange(start: string, end: string | null, t: ComponentsT): string {
  return t('experience.range', {
    start: formatMonthYear(start),
    end: end ? formatMonthYear(end) : t('experience.present'),
  });
}

export type VerificationKey = 'verified' | 'pending' | 'unverified' | 'rejected';

export interface VerificationView {
  key: VerificationKey;
  variant: 'accent' | 'strong' | 'neutral' | 'error';
  /** A check mark in front of the label: only a verification. */
  icon: string | null;
  /** The explanation in a tooltip, when there is one worth giving. */
  tip: string | null;
}

const STAFF_METHODS: readonly VerificationMethod[] = ['moddy_staff', 'moddy_staff_system'];

/**
 * How a verification shows. A verified experience says how and when in a
 * tooltip; a pending one says someone is looking. The public API never sends
 * `rejected` (or `pending`): only the owner's and staff's views do.
 */
export function verificationView(verification: PublicVerification, t: ComponentsT): VerificationView {
  switch (verification.status) {
    case 'verified': {
      const date = verification.verified_at ? formatDate(verification.verified_at, 'long') : null;
      const how =
        verification.method === 'discord_oauth'
          ? 'discord'
          : verification.method && STAFF_METHODS.includes(verification.method)
            ? 'staff'
            : 'generic';
      return {
        key: 'verified',
        variant: 'accent',
        icon: 'check',
        tip: date ? t(`experience.verification.tip.${how}`, {date}) : null,
      };
    }
    case 'pending':
      return {key: 'pending', variant: 'strong', icon: null, tip: t('experience.verification.tip.pending')};
    case 'rejected':
      return {key: 'rejected', variant: 'error', icon: null, tip: null};
    case 'unverified':
      return {key: 'unverified', variant: 'neutral', icon: null, tip: null};
  }
}
