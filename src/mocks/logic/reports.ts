/** Reports (LINEUP.md §6.5, §11). */

import type {CreateReportResponse, ReportReason, ReportTargetType} from '@/api/types';

import {notFound, rateLimited, unprocessable} from '../errors';
import type {Actor, Env} from '../env';
import {newUuid} from '../ids';
import {HOUR, iso} from '../time';
import {isUuid, Issues} from './validate';
import {validationFailure} from '../errors';

const REPORT_LIMIT = 10;

export interface ReportInput {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}

/**
 * `POST /lineup/reports`. Order: target shape (422) → the target exists (404)
 * → not one's own content (422 `lineup_report_self`) → an OPEN report by the
 * same person on the same target (200, `created: false`, no quota used) → the
 * limit of 10 per hour (429) → created (201).
 */
export function createReport(
  env: Env,
  actor: Actor,
  input: ReportInput,
): {status: 200 | 201; body: CreateReportResponse} {
  const issues = new Issues();
  const loc = ['body', 'target_id'];
  if (input.target_type === 'post' ? !isUuid(input.target_id) : !/^\d{1,19}$/.test(input.target_id)) {
    issues.add(
      'value_error',
      loc,
      input.target_type === 'post'
        ? 'Value error, target_id doit être un UUID pour une annonce.'
        : 'Value error, target_id doit être un identifiant Discord.',
      input.target_id,
      {error: {}},
    );
    throw validationFailure(issues.list);
  }
  const targetId = input.target_type === 'post' ? input.target_id.toLowerCase() : String(BigInt(input.target_id));

  // Who owns the target: the author of a post, the person, the one who claimed a server or a bot (§6.5).
  let ownerId: string | undefined;
  if (input.target_type === 'post') {
    const post = env.db.posts[targetId];
    if (!post) throw notFound('lineup_report_target_not_found');
    ownerId = post.author_id;
  } else if (input.target_type === 'user') {
    if (!env.db.users[targetId]) throw notFound('lineup_report_target_not_found');
    ownerId = targetId;
  } else if (input.target_type === 'bot') {
    // A bot must have a profile; the one who claimed it cannot report it.
    const profile = env.db.botProfiles[targetId];
    if (!profile) throw notFound('lineup_report_target_not_found');
    ownerId = profile.claimed_by;
  } else {
    const profile = env.db.profiles[targetId];
    if (!profile) throw notFound('lineup_report_target_not_found');
    ownerId = profile.claimed_by;
  }
  if (ownerId === actor.id)
    throw unprocessable('lineup_report_self', 'Vous ne pouvez pas signaler votre propre contenu.');

  const duplicate = Object.values(env.db.reports).find(
    (report) =>
      report.status === 'open' &&
      report.reporter_id === actor.id &&
      report.target_type === input.target_type &&
      report.target_id === targetId,
  );
  if (duplicate) return {status: 200, body: {id: duplicate.id, status: 'open', created: false}};

  const hit = env.db.rt.limiter.hit(`reports_rate:${actor.id}`, REPORT_LIMIT, HOUR, env.now.getTime());
  if (!hit.allowed)
    throw rateLimited(hit.retryAfter, 'Vous avez atteint la limite de signalements. Réessayez plus tard.');

  const id = newUuid();
  env.db.reports[id] = {
    id,
    target_type: input.target_type,
    target_id: targetId,
    reporter_id: actor.id,
    reason: input.reason,
    details: input.details ? input.details : null,
    status: 'open',
    handled_by: null,
    created_at: iso(env.now),
  };
  return {status: 201, body: {id, status: 'open', created: true}};
}
