/**
 * The four error shapes of the API, byte for byte (LINEUP.md §0), and the
 * business errors of §12 as small builders. Logic throws `ApiFailure`; the
 * HTTP layer turns it into a response.
 */

import type {IsoDateTime, SanctionInfo, Snowflake, ValidationIssue} from '@/api/types';

import type {SanctionSpec} from './model';

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly headers: Record<string, string> = {},
  ) {
    super(
      typeof body === 'object' && body !== null && 'code' in body
        ? String((body as {code: unknown}).code)
        : `HTTP ${status}`,
    );
    this.name = 'ApiFailure';
  }

  /** The `code` of a Lineup or sanction error, if any. */
  get code(): string | null {
    const error = (this.body as {error?: unknown} | null)?.error;
    return typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code: unknown}).code)
      : null;
  }
}

/**
 * Shape 1: a Lineup error. `error` is an object and its fields are copied at
 * the root too (`body.code` and `body.error.code` are the same).
 */
export function lineupError(
  status: number,
  code: string,
  message: string,
  context: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): ApiFailure {
  const error = {code, message, ...context};
  return new ApiFailure(status, {error, ...error}, headers);
}

/** Shape 3: a plain text (`{"error": "Staff only"}`). */
export function textError(status: number, message: string): ApiFailure {
  return new ApiFailure(status, {error: message});
}

/** Shape 4: the standard 422. */
export function validationFailure(issues: ValidationIssue[]): ApiFailure {
  return new ApiFailure(422, {error: 'Validation error', detail: issues});
}

export const unauthenticated = (expired = false) => textError(401, expired ? 'Session expiree' : 'Non authentifie');
export const staffOnly = () => textError(403, 'Staff only');
export const notFoundRoute = () => textError(404, 'Not Found');

const SANCTION_VIOLATIONS_URL = 'https://moddy.app/violations';

/**
 * Shape 2: a global sanction. `error` is an object and NOT copied at the root
 * (the one difference with shape 1).
 */
export function sanctionError(code: SanctionInfo['code'], subjectId: Snowflake, sanction: SanctionSpec): ApiFailure {
  const message = code === 'user_suspended' ? 'Votre accès à Moddy est suspendu.' : 'Ce serveur est suspendu.';
  return new ApiFailure(403, {
    error: {
      code,
      level: sanction.level,
      subject_type: sanction.subject_type,
      subject_id: subjectId,
      references: sanction.references,
      expires_at: sanction.expires_at satisfies IsoDateTime | null,
      message,
      violations_url: SANCTION_VIOLATIONS_URL,
    },
  });
}

/** 429 `lineup_rate_limited`: the delay is in the body AND in `Retry-After`. */
export function rateLimited(retryAfter: number, message = 'Trop de tentatives. Réessayez plus tard.'): ApiFailure {
  const seconds = Math.max(1, Math.ceil(retryAfter));
  return lineupError(429, 'lineup_rate_limited', message, {retry_after: seconds}, {'Retry-After': String(seconds)});
}

/** 503 `discord_unavailable`: always `Retry-After: 30`. Never a "no": the API refuses to decide on a doubt. */
export function discordUnavailable(): ApiFailure {
  return lineupError(
    503,
    'discord_unavailable',
    'Discord ne répond pas pour le moment. Réessayez dans quelques instants.',
    {},
    {'Retry-After': '30'},
  );
}

// ---------------------------------------------------------------------------
// The business errors of §12 (French messages: display is the front's job)
// ---------------------------------------------------------------------------

export const forbidden = (code: 'lineup_guild_forbidden' | 'lineup_post_forbidden') =>
  lineupError(
    403,
    code,
    code === 'lineup_guild_forbidden'
      ? 'Vous ne gérez pas ce serveur.'
      : "Vous n'avez pas le droit de modifier cette annonce.",
  );

export const notFound = (
  code:
    | 'lineup_guild_not_found'
    | 'lineup_user_not_found'
    | 'lineup_post_not_found'
    | 'lineup_experience_not_found'
    | 'lineup_report_target_not_found'
    | 'lineup_report_not_found'
    | 'lineup_badge_not_found'
    | 'invite_not_found',
) => {
  const messages: Record<string, string> = {
    lineup_guild_not_found: 'Serveur introuvable.',
    lineup_user_not_found: 'Utilisateur introuvable.',
    lineup_post_not_found: 'Annonce introuvable.',
    lineup_experience_not_found: 'Expérience introuvable.',
    lineup_report_target_not_found: 'Cible du signalement introuvable.',
    lineup_report_not_found: 'Signalement introuvable.',
    lineup_badge_not_found: "Ce badge n'est pas attribué.",
    invite_not_found: 'Invitation introuvable ou expirée.',
  };
  return lineupError(404, code, messages[code] ?? 'Introuvable.');
};

export const conflict = (code: string, message: string, context: Record<string, unknown> = {}) =>
  lineupError(409, code, message, context);

export const unprocessable = (code: string, message: string, context: Record<string, unknown> = {}) =>
  lineupError(422, code, message, context);
