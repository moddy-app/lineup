/** The staff console (LINEUP.md §6.7). Every route answers `403 Staff only` to anyone else. */

import {apiFetch} from '../client';
import type {
  BadgeEntityType,
  GrantBadgeBody,
  ManualBadgeGrant,
  Paginated,
  PostModeration,
  Report,
  Snowflake,
  StaffExperience,
  StaffExperienceStatus,
  StaffHideBody,
  StaffBadgesPage,
  StaffRejectBody,
  StaffReportStatus,
  StaffVerifyBody,
  Uuid,
} from '../types';
import {enc, type PageOptions, type ReadOptions} from './shared';

/** `GET /lineup/staff/experiences`: the review queue, oldest change first. */
export function getStaffExperiences(
  status: StaffExperienceStatus,
  {cursor, limit, signal}: PageOptions = {},
): Promise<Paginated<StaffExperience>> {
  return apiFetch<Paginated<StaffExperience>>('/lineup/staff/experiences', {
    signal,
    query: {status, limit, cursor},
  });
}

/** `POST /lineup/staff/experiences/{exp_id}/verify`: from any status. */
export function staffVerifyExperience(expId: Uuid, body?: StaffVerifyBody): Promise<StaffExperience> {
  return apiFetch<StaffExperience>(`/lineup/staff/experiences/${enc(expId)}/verify`, {
    method: 'POST',
    body: body?.note ? {note: body.note} : undefined,
  });
}

/** `POST /lineup/staff/experiences/{exp_id}/reject`: the reason is required and shown to the owner. */
export function staffRejectExperience(expId: Uuid, body: StaffRejectBody): Promise<StaffExperience> {
  return apiFetch<StaffExperience>(`/lineup/staff/experiences/${enc(expId)}/reject`, {method: 'POST', body});
}

export interface StaffBadgesOptions extends ReadOptions {
  /** 1 to 200, default 100. */
  limit?: number;
  offset?: number;
}

/** `GET /lineup/staff/badges`: manual badges granted, newest first. Paginated by limit and offset. */
export function getStaffBadges(
  entityType: BadgeEntityType,
  {limit, offset, signal}: StaffBadgesOptions = {},
): Promise<StaffBadgesPage> {
  return apiFetch<StaffBadgesPage>('/lineup/staff/badges', {
    signal,
    query: {entity_type: entityType, limit, offset},
  });
}

/** `PUT /lineup/staff/badges/{entity_type}/{entity_id}/{badge}`: grants (or grants again, with a new note). */
export function grantBadge(
  entityType: BadgeEntityType,
  entityId: Snowflake,
  badge: string,
  body?: GrantBadgeBody,
): Promise<ManualBadgeGrant> {
  return apiFetch<ManualBadgeGrant>(`/lineup/staff/badges/${enc(entityType)}/${enc(entityId)}/${enc(badge)}`, {
    method: 'PUT',
    body: body?.note ? {note: body.note} : undefined,
  });
}

/** `DELETE /lineup/staff/badges/{entity_type}/{entity_id}/{badge}`: 204. */
export function revokeBadge(entityType: BadgeEntityType, entityId: Snowflake, badge: string): Promise<void> {
  return apiFetch<void>(`/lineup/staff/badges/${enc(entityType)}/${enc(entityId)}/${enc(badge)}`, {method: 'DELETE'});
}

/** `POST /lineup/staff/posts/{post_id}/hide`: from any status; the author sees the reason. */
export function hidePost(postId: Uuid, body: StaffHideBody): Promise<PostModeration> {
  return apiFetch<PostModeration>(`/lineup/staff/posts/${enc(postId)}/hide`, {method: 'POST', body});
}

/** `POST /lineup/staff/posts/{post_id}/unhide`: the post becomes `closed`, never `published`. */
export function unhidePost(postId: Uuid): Promise<PostModeration> {
  return apiFetch<PostModeration>(`/lineup/staff/posts/${enc(postId)}/unhide`, {method: 'POST'});
}

/** `GET /lineup/staff/reports`: newest first. */
export function getStaffReports(
  status: StaffReportStatus,
  {cursor, limit, signal}: PageOptions = {},
): Promise<Paginated<Report>> {
  return apiFetch<Paginated<Report>>('/lineup/staff/reports', {signal, query: {status, limit, cursor}});
}

/** `POST /lineup/staff/reports/{report_id}/resolve`: acted on. Does not change the target. */
export function resolveReport(reportId: Uuid): Promise<Report> {
  return apiFetch<Report>(`/lineup/staff/reports/${enc(reportId)}/resolve`, {method: 'POST'});
}

/** `POST /lineup/staff/reports/{report_id}/dismiss`: nothing to do. */
export function dismissReport(reportId: Uuid): Promise<Report> {
  return apiFetch<Report>(`/lineup/staff/reports/${enc(reportId)}/dismiss`, {method: 'POST'});
}
