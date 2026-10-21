/**
 * What the person reads when a request fails.
 *
 * `errorMessage` turns an `ApiError` into one short, specific sentence in the
 * current language (the `errors` namespace); `fieldErrors` does the same for
 * each field of a rejected form. Code branches on `code`, never on the API's
 * French `message`, which is only a last resort for a code we do not know.
 */

import type {TFunction} from 'i18next';

import {isApiError, issuesByField} from './client';
import type {ValidationIssue} from './types';

/**
 * Every code a failure can carry: the table of LINEUP.md §12, the plain-text
 * errors it maps (`unauthenticated`, `staff_only`, `origin_not_allowed`), the
 * 422 `validation_error`, and two of ours (`route_not_found` for a 404
 * "Not Found", `network_error` for a request that got no answer). Each has a
 * message in all five languages (errors.test.ts).
 */
export const ERROR_CODES = [
  'unauthenticated',
  'user_suspended',
  'guild_suspended',
  'lineup_reauth_required',
  'lineup_guild_forbidden',
  'lineup_post_forbidden',
  'staff_only',
  'origin_not_allowed',
  'route_not_found',
  'lineup_guild_not_found',
  'lineup_user_not_found',
  'lineup_post_not_found',
  'lineup_experience_not_found',
  'lineup_report_target_not_found',
  'lineup_report_not_found',
  'lineup_badge_not_found',
  'invite_not_found',
  'lineup_guild_already_claimed',
  'lineup_quota_exceeded',
  'lineup_post_hidden',
  'lineup_post_invalid_status',
  'lineup_post_not_hidden',
  'lineup_experience_limit',
  'lineup_experience_already_verified',
  'lineup_review_already_pending',
  'lineup_report_already_handled',
  'invite_invalid',
  'invite_expiring',
  'invite_guild_mismatch',
  'invite_required',
  'theme_invalid',
  'cursor_invalid',
  'lineup_filter_invalid',
  'lineup_form_unavailable',
  'lineup_guild_profile_missing',
  'lineup_experience_not_verified',
  'lineup_featured_experience_user_only',
  'lineup_post_expired',
  'lineup_positions_other_required',
  'lineup_positions_other_unexpected',
  'lineup_experience_invalid',
  'lineup_experience_order_invalid',
  'lineup_verification_not_applicable',
  'lineup_verification_failed',
  'lineup_report_self',
  'lineup_entity_type_invalid',
  'lineup_badge_invalid',
  'validation_error',
  'lineup_rate_limited',
  'discord_unavailable',
  'network_error',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isKnownErrorCode(code: string | null): code is ErrorCode {
  return code !== null && (ERROR_CODES as readonly string[]).includes(code);
}

/** The `t` of `useT('errors')`. */
export type ErrorsT = TFunction<'errors'>;

/**
 * Where the failure happened, when it changes the wording. The same
 * `lineup_guild_forbidden` is advice in the claim flow ("you must own the
 * server…") and a statement in the management page ("you no longer manage…").
 */
export type ErrorUseContext = 'claim' | 'manage';

export interface ErrorMessageOptions {
  context?: ErrorUseContext;
  /**
   * The seconds left to wait, when a countdown is running (`useRetryAfter`).
   * Defaults to the error's own `retryAfter`; 0 or less says "you can try again".
   */
  seconds?: number;
}

/** "45 seconds", "3 minutes", "1 hour": the wait, rounded up to the unit that reads best. */
export function formatWait(seconds: number, t: ErrorsT): string {
  const total = Math.max(1, Math.ceil(seconds));
  if (total < 60) return t('wait.seconds', {count: total});
  if (total < 3600) return t('wait.minutes', {count: Math.ceil(total / 60)});
  return t('wait.hours', {count: Math.ceil(total / 3600)});
}

const POST_STATUSES = ['draft', 'published', 'closed', 'hidden'] as const;
const FILTER_FIELDS = ['kind', 'compensation', 'positions', 'status'] as const;
const VERIFICATION_REASONS = ['not_member', 'no_staff_permission'] as const;
const NOT_APPLICABLE_REASONS = ['not_guild', 'ended'] as const;

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * One short, specific, actionable sentence for any failure. Never throws and
 * never returns an empty string.
 */
export function errorMessage(error: unknown, t: ErrorsT, options: ErrorMessageOptions = {}): string {
  if (!isApiError(error)) return t('generic');
  const {code, context} = error;

  switch (code) {
    case 'unauthenticated':
      return error.expired ? t('sessionExpired') : t('codes.unauthenticated');

    case 'lineup_guild_forbidden':
      return options.context ? t(`forbidden.${options.context}`) : t('codes.lineup_guild_forbidden');

    case 'lineup_quota_exceeded': {
      const scope = oneOf(['guild', 'user'], context.scope);
      return scope && typeof context.limit === 'number'
        ? t(`quota.${scope}`, {count: context.limit})
        : t('codes.lineup_quota_exceeded');
    }

    case 'lineup_post_invalid_status': {
      const status = oneOf(POST_STATUSES, context.current_status);
      return status ? t(`invalidStatus.${status}`) : t('codes.lineup_post_invalid_status');
    }

    case 'lineup_filter_invalid': {
      const field = oneOf(FILTER_FIELDS, context.field);
      return field ? t(`filterInvalid.${field}`) : t('codes.lineup_filter_invalid');
    }

    case 'lineup_verification_failed': {
      const reason = oneOf(VERIFICATION_REASONS, context.reason);
      return reason ? t(`verificationFailed.${reason}`) : t('codes.lineup_verification_failed');
    }

    case 'lineup_verification_not_applicable': {
      const reason = oneOf(NOT_APPLICABLE_REASONS, context.reason);
      return reason ? t(`verificationNotApplicable.${reason}`) : t('codes.lineup_verification_not_applicable');
    }

    case 'lineup_rate_limited':
    case 'discord_unavailable': {
      const seconds = options.seconds ?? error.retryAfter;
      if (seconds === null || seconds === undefined) return t(`codes.${code}`);
      if (seconds <= 0) return t('retryNow');
      const wait = formatWait(seconds, t);
      // A Discord outage is never phrased as a refusal: it is a wait.
      return code === 'discord_unavailable' ? t('discordUnavailable', {wait}) : t('rateLimited', {wait});
    }

    default:
      if (isKnownErrorCode(code)) return t(`codes.${code}`);
      // A code we do not know (the API is ahead of the site): its own message is better than nothing.
      if (error.serverMessage) return error.serverMessage;
      return error.status >= 500 ? t('server') : t('generic');
  }
}

// ---------------------------------------------------------------------------
// Validation (422) messages
// ---------------------------------------------------------------------------

/** Pydantic prefixes the message of a rule written as a ValueError. */
const VALUE_ERROR_PREFIX = /^value error,\s*/i;

function numberFrom(ctx: ValidationIssue['ctx'], key: string): number | null {
  const value = ctx?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function valueFrom(ctx: ValidationIssue['ctx'], key: string): string | number | null {
  const value = ctx?.[key];
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

/**
 * The message of one validation issue, in the current language. Pydantic's
 * messages are English; the common types are translated (with their limits),
 * and the rules Lineup wrote itself (`value_error`: links, tags, conditions…)
 * come from the API in French and are shown as they are. An unknown type also
 * keeps the API's message.
 */
export function issueMessage(issue: ValidationIssue, t: ErrorsT): string {
  const {type, ctx} = issue;
  const fallback = issue.msg.replace(VALUE_ERROR_PREFIX, '').trim() || t('validation.invalid');

  switch (type) {
    case 'missing':
      return t('validation.required');
    case 'string_too_short': {
      const count = numberFrom(ctx, 'min_length');
      return count === null ? fallback : t('validation.tooShort', {count});
    }
    case 'string_too_long': {
      const count = numberFrom(ctx, 'max_length');
      return count === null ? fallback : t('validation.tooLong', {count});
    }
    case 'too_short': {
      const count = numberFrom(ctx, 'min_length');
      return count === null ? fallback : t('validation.itemsMin', {count});
    }
    case 'too_long': {
      const count = numberFrom(ctx, 'max_length');
      return count === null ? fallback : t('validation.itemsMax', {count});
    }
    case 'greater_than_equal': {
      const value = valueFrom(ctx, 'ge');
      return value === null ? fallback : t('validation.min', {value});
    }
    case 'less_than_equal': {
      const value = valueFrom(ctx, 'le');
      return value === null ? fallback : t('validation.max', {value});
    }
    case 'greater_than': {
      const value = valueFrom(ctx, 'gt');
      return value === null ? fallback : t('validation.greater', {value});
    }
    case 'less_than': {
      const value = valueFrom(ctx, 'lt');
      return value === null ? fallback : t('validation.less', {value});
    }
    case 'int_parsing':
    case 'int_type':
    case 'int_from_float':
    case 'int_parsing_size':
      return t('validation.integer');
    case 'float_parsing':
    case 'float_type':
    case 'finite_number':
      return t('validation.number');
    case 'bool_parsing':
    case 'bool_type':
      return t('validation.boolean');
    case 'string_type':
      return t('validation.text');
    case 'list_type':
    case 'tuple_type':
    case 'set_type':
      return t('validation.list');
    case 'url_scheme':
      return t('validation.urlHttps');
    case 'url_too_long':
      return t('validation.urlTooLong');
    case 'string_pattern_mismatch':
      return t('validation.pattern');
    case 'literal_error':
    case 'enum':
      return t('validation.choice');
    case 'date_parsing':
    case 'date_type':
    case 'date_from_datetime_parsing':
    case 'datetime_parsing':
    case 'datetime_type':
    case 'datetime_from_date_parsing':
    case 'datetime_object_invalid':
    case 'timezone_aware':
      return t('validation.date');
    case 'uuid_parsing':
    case 'uuid_type':
    case 'uuid_version':
      return t('validation.identifier');
    case 'extra_forbidden':
      return t('validation.notAccepted');
    default:
      if (type.startsWith('url_')) return t('validation.url');
      return fallback;
  }
}

/**
 * The messages of a rejected form, keyed by field: `{title: '…', 'requirements.2.value': '…'}`
 * (see `fieldPath`). A model-level issue is under `_form`. One message per
 * field (the first). Empty when `error` is not a standard 422.
 */
export function fieldErrors(error: unknown, t: ErrorsT): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [field, issues] of issuesByField(error)) {
    const first = issues[0];
    if (first) result[field] = issueMessage(first, t);
  }
  return result;
}
