/** Pure rules of the staff console: URL filters, ids, and which manual badges fit which entity. */

import {FIELD_LIMITS} from '@/api/limits';
import type {BadgeEntityType, CatalogBadge, StaffExperienceStatus, StaffReportStatus} from '@/api/types';

export const REVIEW_STATUSES: readonly StaffExperienceStatus[] = ['pending', 'unverified', 'verified', 'rejected'];
export const REPORT_STATUSES: readonly StaffReportStatus[] = ['open', 'resolved', 'dismissed', 'all'];
export type EntityFilter = 'all' | BadgeEntityType;
export const ENTITY_FILTERS: readonly EntityFilter[] = ['all', 'user', 'guild', 'bot'];

/** The reason, note and badge-note limits of LINEUP.md §6.7. */
export const REASON_MAX = FIELD_LIMITS.staff.reasonMax;
export const BADGE_NOTE_MAX = FIELD_LIMITS.staff.badgeNoteMax;

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

export const parseReviewStatus = (value: string | null) => oneOf(REVIEW_STATUSES, value, 'pending');
export const parseReportStatus = (value: string | null) => oneOf(REPORT_STATUSES, value, 'open');
export const parseEntityFilter = (value: string | null) => oneOf(ENTITY_FILTERS, value, 'all');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The post UUID inside what was pasted: the bare id or a post URL. Lower case, or null. */
export function extractPostId(input: string): string | null {
  const match = UUID.exec(input);
  return match ? match[0].toLowerCase() : null;
}

/** A Discord snowflake as typed: digits only, 15 to 20 of them. */
export function isEntityId(value: string): boolean {
  return /^\d{15,20}$/.test(value);
}

/**
 * The manual badges (the only ones the staff can grant) that exist for this
 * kind of entity. `entities` is the full list; `entity` (`both` for user +
 * guild) is only read when a catalog has no `entities` yet.
 */
export function manualBadgesFor(
  badges: readonly CatalogBadge[] | undefined,
  entityType: BadgeEntityType,
): CatalogBadge[] {
  return (badges ?? []).filter(
    (badge) =>
      badge.source === 'manual' &&
      (badge.entities
        ? badge.entities.includes(entityType)
        : badge.entity === entityType || (badge.entity === 'both' && entityType !== 'bot')),
  );
}
