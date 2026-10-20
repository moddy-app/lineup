/** When a post expires, in the words a card needs. */

/** A card only mentions an expiry when it is near. */
export const EXPIRY_SOON_DAYS = 14;

export type ExpiryInfo =
  | {kind: 'expired'}
  | {kind: 'hours'; value: number}
  | {kind: 'days'; value: number}
  | {kind: 'later'; date: Date}
  | {kind: 'never'};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function expiryInfo(expiresAt: string | null, isExpired: boolean, now: number): ExpiryInfo {
  if (isExpired) return {kind: 'expired'};
  if (!expiresAt) return {kind: 'never'};
  const left = +new Date(expiresAt) - now;
  if (left <= 0) return {kind: 'expired'};
  if (left < DAY) return {kind: 'hours', value: Math.max(1, Math.ceil(left / HOUR))};
  const days = Math.ceil(left / DAY);
  if (days <= EXPIRY_SOON_DAYS) return {kind: 'days', value: days};
  return {kind: 'later', date: new Date(expiresAt)};
}

/** Whether `ExpiryLabel` shows something in `soon` mode: a card then wraps it in its own list item. */
export function expiryIsNear(expiresAt: string | null, isExpired: boolean, now = Date.now()): boolean {
  const info = expiryInfo(expiresAt, isExpired, now);
  return info.kind === 'expired' || info.kind === 'hours' || info.kind === 'days';
}
