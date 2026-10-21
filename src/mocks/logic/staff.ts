/** The staff console (LINEUP.md §6.7, §11): queues, manual badges, hiding posts, reports. */

import {catalogFixture} from '@/api/catalog.fixture';
import type {
  BadgeEntityType,
  ManualBadgeGrant,
  Paginated,
  PostModeration,
  Report,
  ReportStatus,
  Snowflake,
  StaffBadgesPage,
  StaffExperience,
  VerificationStatus,
} from '@/api/types';

import {conflict, notFound, unprocessable} from '../errors';
import type {Actor, Env} from '../env';
import type {StoredBadgeGrant} from '../model';
import {iso} from '../time';
import {compareKeyed, decodeCursor, pageRows} from './cursor';
import {toStaffExperience} from './views';
import {Issues, isUuid, Params} from './validate';

const ENTITY_TYPES: readonly BadgeEntityType[] = ['user', 'guild'];

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

const EXPERIENCE_STATUSES: readonly VerificationStatus[] = ['pending', 'unverified', 'verified', 'rejected'];

/** `GET /lineup/staff/experiences`: the oldest modification first (the queue is processed in arrival order). */
export function listStaffExperiences(env: Env, query: URLSearchParams): Paginated<StaffExperience> {
  const issues = new Issues();
  const params = new Params('query', query, issues);
  const limit = params.int('limit', {def: 50, ge: 1, le: 100}) ?? 50;
  const status = params.get('status') ?? 'pending';
  if (!(EXPERIENCE_STATUSES as readonly string[]).includes(status)) {
    issues.add(
      'literal_error',
      ['query', 'status'],
      "Input should be 'pending', 'unverified', 'verified' or 'rejected'",
      status,
      {
        expected: "'pending', 'unverified', 'verified' or 'rejected'",
      },
    );
  }
  const cursor = params.get('cursor');
  issues.throwIfAny();
  const after = decodeCursor(cursor, isUuid);

  const rows = Object.values(env.db.experiences)
    .filter((row) => row.status === status)
    .map((row) => ({at: row.updated_at, id: row.id, row}))
    .sort(compareKeyed(false));
  const {rows: page, nextCursor} = pageRows(rows, limit, after, false);
  return {items: page.map(({row}) => toStaffExperience(env, row)), next_cursor: nextCursor};
}

const REPORT_STATUSES = ['open', 'resolved', 'dismissed', 'all'] as const;

/** `GET /lineup/staff/reports`: the newest first. */
export function listStaffReports(env: Env, query: URLSearchParams): Paginated<Report> {
  const issues = new Issues();
  const params = new Params('query', query, issues);
  const limit = params.int('limit', {def: 50, ge: 1, le: 100}) ?? 50;
  const status = params.get('status') ?? 'open';
  if (!(REPORT_STATUSES as readonly string[]).includes(status)) {
    issues.add(
      'literal_error',
      ['query', 'status'],
      "Input should be 'open', 'resolved', 'dismissed' or 'all'",
      status,
      {
        expected: "'open', 'resolved', 'dismissed' or 'all'",
      },
    );
  }
  const cursor = params.get('cursor');
  issues.throwIfAny();
  const after = decodeCursor(cursor, isUuid);

  const rows = Object.values(env.db.reports)
    .filter((report) => status === 'all' || report.status === status)
    .map((report) => ({at: report.created_at, id: report.id, report}))
    .sort(compareKeyed(true));
  const {rows: page, nextCursor} = pageRows(rows, limit, after, true);
  return {items: page.map(({report}) => ({...report})), next_cursor: nextCursor};
}

function closeReport(env: Env, staff: Actor, id: string, status: Exclude<ReportStatus, 'open'>): Report {
  const report = env.db.reports[id];
  if (!report) throw notFound('lineup_report_not_found');
  if (report.status !== 'open') {
    throw conflict('lineup_report_already_handled', 'Ce signalement a déjà été traité.');
  }
  // §11: closing a report does NOT change its target; hiding a post is a separate action.
  report.status = status;
  report.handled_by = staff.id;
  return {...report};
}

export const resolveReport = (env: Env, staff: Actor, id: string) => closeReport(env, staff, id, 'resolved');
export const dismissReport = (env: Env, staff: Actor, id: string) => closeReport(env, staff, id, 'dismissed');

// ---------------------------------------------------------------------------
// Manual badges
// ---------------------------------------------------------------------------

const entityTypeInvalid = () =>
  unprocessable('lineup_entity_type_invalid', 'entity_type doit valoir « user » ou « guild ».');

function entityType(raw: string): BadgeEntityType {
  if (!(ENTITY_TYPES as readonly string[]).includes(raw)) throw entityTypeInvalid();
  return raw as BadgeEntityType;
}

/**
 * Only `manual` badges are grantable, and only to an entity type they exist
 * for (`moddy_server` is for a server only). Anything else: 422 `lineup_badge_invalid`.
 */
function manualBadge(id: string, type: BadgeEntityType): string {
  const entry = catalogFixture.badges.find((badge) => badge.id === id);
  if (!entry || entry.source !== 'manual' || (entry.entity !== 'both' && entry.entity !== type)) {
    throw unprocessable('lineup_badge_invalid', "Ce badge n'est pas attribuable à ce type d'entité.");
  }
  return id;
}

/**
 * A grant as the console reads it: the entity's name and icon come from its
 * Lineup profile (a person's, a server's), `null` when it has none.
 */
function toBadgeGrant(env: Env, grant: StoredBadgeGrant): ManualBadgeGrant {
  if (grant.entity_type === 'guild') {
    const profile = env.db.profiles[grant.entity_id];
    const guild = env.db.guilds[grant.entity_id];
    const known = Boolean(profile && guild);
    return {
      ...grant,
      entity_name: known ? (guild?.name ?? null) : null,
      entity_icon_url: known ? (guild?.icon_url ?? null) : null,
    };
  }
  const user = env.db.users[grant.entity_id];
  return {
    ...grant,
    entity_name: user ? (user.global_name ?? user.username) : null,
    entity_icon_url: user?.avatar_url ?? null,
  };
}

/** `GET /lineup/staff/badges`: newest first, paginated by limit and offset (no cursor). */
export function listBadgeGrants(env: Env, query: URLSearchParams): StaffBadgesPage {
  const issues = new Issues();
  const params = new Params('query', query, issues);
  const limit = params.int('limit', {def: 100, ge: 1, le: 200}) ?? 100;
  const offset = params.int('offset', {def: 0, ge: 0}) ?? 0;
  const rawType = params.get('entity_type');
  issues.throwIfAny();
  const type = rawType === undefined ? undefined : entityType(rawType);
  const items = env.db.badges
    .filter((grant) => type === undefined || grant.entity_type === type)
    .sort((a, b) => Date.parse(b.granted_at) - Date.parse(a.granted_at))
    .slice(offset, offset + limit)
    .map((grant) => toBadgeGrant(env, grant));
  return {items};
}

/** `PUT …/badges/{type}/{id}/{badge}`: grants, or grants again with a new note (idempotent). The entity is not checked. */
export function grantBadge(
  env: Env,
  staff: Actor,
  rawType: string,
  entityId: Snowflake,
  badge: string,
  note: string | undefined,
): ManualBadgeGrant {
  const type = entityType(rawType);
  manualBadge(badge, type);
  const grant: StoredBadgeGrant = {
    entity_type: type,
    entity_id: entityId,
    badge,
    granted_by: staff.id,
    granted_at: iso(env.now),
    note: note ? note : null,
  };
  const index = env.db.badges.findIndex(
    (existing) => existing.entity_type === type && existing.entity_id === entityId && existing.badge === badge,
  );
  if (index >= 0) env.db.badges[index] = grant;
  else env.db.badges.push(grant);
  return toBadgeGrant(env, grant);
}

export function revokeBadge(env: Env, rawType: string, entityId: Snowflake, badge: string): void {
  const type = entityType(rawType);
  const index = env.db.badges.findIndex(
    (existing) => existing.entity_type === type && existing.entity_id === entityId && existing.badge === badge,
  );
  if (index < 0) throw notFound('lineup_badge_not_found');
  env.db.badges.splice(index, 1);
}

// ---------------------------------------------------------------------------
// Hiding posts
// ---------------------------------------------------------------------------

/** `hide`: from ANY status to `hidden`; the author reads the reason. */
export function hidePost(env: Env, postId: string, reason: string): PostModeration {
  const post = env.db.posts[postId];
  if (!post) throw notFound('lineup_post_not_found');
  post.status = 'hidden';
  post.hidden_reason = reason;
  post.updated_at = iso(env.now);
  return {id: post.id, status: 'hidden', hidden_reason: reason};
}

/** `unhide`: back to `closed`, never `published` (that would dodge the quotas and republish unchecked content). */
export function unhidePost(env: Env, postId: string): PostModeration {
  const post = env.db.posts[postId];
  if (!post) throw notFound('lineup_post_not_found');
  if (post.status !== 'hidden') throw conflict('lineup_post_not_hidden', "Cette annonce n'est pas masquée.");
  post.status = 'closed';
  post.hidden_reason = null;
  post.updated_at = iso(env.now);
  return {id: post.id, status: 'closed', hidden_reason: null};
}
