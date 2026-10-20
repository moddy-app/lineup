/** The person's own experiences (LINEUP.md §6.6, §7). Every route is the caller's only. */

import {apiFetch} from '../client';
import type {
  CreateExperienceBody,
  ExperienceList,
  PrivateExperience,
  RequestReviewBody,
  UpdateExperienceBody,
  Uuid,
} from '../types';
import {enc, type ReadOptions} from './shared';

/** `GET /lineup/me/experiences`: `{items}` in the person's order. */
export function getMyExperiences({signal}: ReadOptions = {}): Promise<ExperienceList> {
  return apiFetch<ExperienceList>('/lineup/me/experiences', {signal});
}

/** `POST /lineup/me/experiences`: 201, `unverified`, added last. */
export function createExperience(body: CreateExperienceBody): Promise<PrivateExperience> {
  return apiFetch<PrivateExperience>('/lineup/me/experiences', {method: 'POST', body});
}

/**
 * `PATCH /lineup/me/experiences/{exp_id}`. Changing the server, the position,
 * the dates or a service's name resets a verification (an `end_date` on a
 * verified, current experience is the exception).
 */
export function updateExperience(expId: Uuid, body: UpdateExperienceBody): Promise<PrivateExperience> {
  return apiFetch<PrivateExperience>(`/lineup/me/experiences/${enc(expId)}`, {method: 'PATCH', body});
}

/** `PUT /lineup/me/experiences/order`: every id exactly once, in the new order. */
export function reorderExperiences(ids: Uuid[]): Promise<ExperienceList> {
  return apiFetch<ExperienceList>('/lineup/me/experiences/order', {method: 'PUT', body: {ids}});
}

/** `DELETE /lineup/me/experiences/{exp_id}`: 204. A post that featured it keeps going without. */
export function deleteExperience(expId: Uuid): Promise<void> {
  return apiFetch<void>(`/lineup/me/experiences/${enc(expId)}`, {method: 'DELETE'});
}

/** `POST /lineup/me/experiences/{exp_id}/verify`: the automatic check through Discord. 5 tries per 10 minutes. */
export function verifyExperience(expId: Uuid): Promise<PrivateExperience> {
  return apiFetch<PrivateExperience>(`/lineup/me/experiences/${enc(expId)}/verify`, {method: 'POST'});
}

/** `POST /lineup/me/experiences/{exp_id}/request-review`: a manual review by the staff; `note` is optional. */
export function requestExperienceReview(expId: Uuid, body?: RequestReviewBody): Promise<PrivateExperience> {
  return apiFetch<PrivateExperience>(`/lineup/me/experiences/${enc(expId)}/request-review`, {
    method: 'POST',
    body: body?.note ? {note: body.note} : undefined,
  });
}
