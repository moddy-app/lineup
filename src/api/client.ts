/**
 * The one way the app talks to the Moddy API (LINEUP.md §0).
 *
 *  - `apiFetch` sends the cookie, serializes the query (arrays are repeated
 *    params), sends JSON only when there is a body, and turns every failure
 *    into an `ApiError`.
 *  - `ApiError` understands the four error shapes of the API (a Lineup error,
 *    a sanction, a plain text, a standard 422) plus a network failure and an
 *    unreadable body, and exposes them the same way: branch on `code`, never
 *    on the French `message`.
 *
 * In mock mode the mock intercepts the same absolute URLs, so the URLs built
 * here are always absolute.
 */

import {config} from '@/config';

import type {SanctionInfo, ValidationIssue} from './types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Which of the shapes of LINEUP.md §0 the failure had.
 *  - `lineup`: `{error: {code, message, …}, code, …}` (most business errors)
 *  - `sanction`: `{error: {code: user_suspended | guild_suspended, …}}`
 *  - `text`: `{error: "Non authentifie"}`
 *  - `validation`: `{error: "Validation error", detail: [...]}` (422)
 *  - `network`: the request never got an answer
 *  - `unknown`: an answer that is not JSON (a gateway page…) or has no known shape
 */
export type ErrorKind = 'lineup' | 'sanction' | 'text' | 'validation' | 'network' | 'unknown';

/**
 * The fields an error object carries next to its `code`. Which ones exist
 * depends on the error (LINEUP.md §12); the rest is kept as received.
 */
export interface ApiErrorContext {
  /** `lineup_quota_exceeded`: 5 or 3. */
  limit?: number;
  /** `lineup_quota_exceeded`: `guild` or `user`. */
  scope?: string;
  /** `lineup_verification_failed`: `not_member` | `no_staff_permission`; `lineup_verification_not_applicable`: `not_guild` | `ended`. */
  reason?: string;
  /** `lineup_reauth_required`: relative to the API. */
  login_url?: string;
  retry_after?: number;
  /** `lineup_guild_already_claimed`. */
  guild_id?: string;
  /** `lineup_filter_invalid`. */
  field?: string;
  /** `lineup_post_invalid_status`. */
  current_status?: string;
  /** `lineup_verification_failed`: offer the manual review. */
  can_request_review?: boolean;
  [key: string]: unknown;
}

export interface ApiErrorInit {
  status: number;
  kind: ErrorKind;
  code: string | null;
  context?: ApiErrorContext;
  sanction?: SanctionInfo | null;
  validation?: ValidationIssue[] | null;
  retryAfter?: number | null;
  serverMessage?: string | null;
  expired?: boolean;
  cause?: unknown;
}

export class ApiError extends Error {
  /** The HTTP status; 0 when no answer came. */
  readonly status: number;
  readonly kind: ErrorKind;
  /**
   * A stable code from LINEUP.md §12, or one of ours: `unauthenticated`,
   * `staff_only`, `origin_not_allowed`, `route_not_found`, `validation_error`,
   * `network_error`. Null when the answer had none.
   */
  readonly code: string | null;
  readonly context: ApiErrorContext;
  /** For `user_suspended` and `guild_suspended`. */
  readonly sanction: SanctionInfo | null;
  /** The `detail[]` of a standard 422. */
  readonly validation: ValidationIssue[] | null;
  /** Seconds to wait before trying again (429, 503). */
  readonly retryAfter: number | null;
  /** The API's French message: a last-resort display, never something to branch on. */
  readonly serverMessage: string | null;
  /** `unauthenticated` only: the session existed and ran out ("Session expiree"). */
  readonly expired: boolean;
  /** When this error was created; `retryAfter` counts from here. */
  readonly receivedAt: number;

  constructor(init: ApiErrorInit) {
    super(
      init.serverMessage ?? `${init.code ?? init.kind} (${init.status === 0 ? 'no answer' : `HTTP ${init.status}`})`,
      init.cause === undefined ? undefined : {cause: init.cause},
    );
    this.name = 'ApiError';
    this.status = init.status;
    this.kind = init.kind;
    this.code = init.code;
    this.context = init.context ?? {};
    this.sanction = init.sanction ?? null;
    this.validation = init.validation ?? null;
    this.retryAfter = init.retryAfter ?? null;
    this.serverMessage = init.serverMessage ?? null;
    this.expired = init.expired ?? false;
    this.receivedAt = Date.now();
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Whether `error` is an `ApiError` carrying one of these codes. */
export function hasCode(error: unknown, ...codes: string[]): error is ApiError {
  return isApiError(error) && error.code !== null && codes.includes(error.code);
}

const SANCTION_CODES = ['user_suspended', 'guild_suspended'] as const;

/** The default wait when a 429 or a 503 carries no delay at all (LINEUP.md §0). */
const DEFAULT_RETRY_AFTER: Record<string, number> = {lineup_rate_limited: 60, discord_unavailable: 30};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Seconds, from a body value (number or numeric string). */
function secondsFrom(value: unknown): number | null {
  const seconds = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** `Retry-After` is a number of seconds or an HTTP date. */
export function parseRetryAfterHeader(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) return secondsFrom(Number(text));
  const date = Date.parse(text);
  return Number.isNaN(date) ? null : secondsFrom((date - now) / 1000);
}

function sanctionFrom(error: Record<string, unknown>, code: SanctionInfo['code']): SanctionInfo {
  return {
    code,
    level: asString(error.level) ?? '',
    subject_type: asString(error.subject_type) ?? '',
    subject_id: asString(error.subject_id) ?? '',
    references: Array.isArray(error.references)
      ? error.references.filter((r): r is string => typeof r === 'string')
      : [],
    expires_at: asString(error.expires_at),
    message: asString(error.message) ?? '',
    violations_url: asString(error.violations_url),
  };
}

function validationFrom(detail: unknown): ValidationIssue[] | null {
  if (!Array.isArray(detail)) return null;
  return detail.filter(isRecord).map((issue) => ({
    type: asString(issue.type) ?? '',
    loc: Array.isArray(issue.loc)
      ? issue.loc.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
      : [],
    msg: asString(issue.msg) ?? '',
    input: issue.input,
    ctx: isRecord(issue.ctx) ? issue.ctx : undefined,
  }));
}

/** Maps the plain-text errors of the API (`{"error": "Staff only"}`) to codes of ours. */
function textErrorCode(status: number, message: string): {code: string | null; expired: boolean} {
  const text = message.trim().toLowerCase();
  if (status === 401) return {code: 'unauthenticated', expired: /expir/.test(text)};
  if (text === 'staff only') return {code: 'staff_only', expired: false};
  if (text === 'origin not allowed') return {code: 'origin_not_allowed', expired: false};
  if (status === 404 && text === 'not found') return {code: 'route_not_found', expired: false};
  return {code: null, expired: false};
}

/**
 * Builds the `ApiError` of a failed response. `body` is the parsed JSON, or
 * `undefined` when the body was empty or not JSON.
 */
export function errorFromResponse(status: number, body: unknown, retryAfterHeader: string | null): ApiError {
  const headerSeconds = parseRetryAfterHeader(retryAfterHeader);
  const withRetry = (code: string | null, context: ApiErrorContext) =>
    secondsFrom(context.retry_after) ?? headerSeconds ?? (code ? (DEFAULT_RETRY_AFTER[code] ?? null) : null);

  if (isRecord(body)) {
    const detail = validationFrom(body.detail);
    const error = body.error;

    if (typeof error === 'string' && detail) {
      // Shape 4: {error: "Validation error", detail: [...]}.
      return new ApiError({
        status,
        kind: 'validation',
        code: 'validation_error',
        validation: detail,
        serverMessage: error,
        retryAfter: headerSeconds,
      });
    }

    if (typeof error !== 'string' && !isRecord(error) && typeof body.detail === 'string') {
      // FastAPI's native shape for an unknown route or a wrong method: {detail: "Not Found"}.
      const {code, expired} = textErrorCode(status, body.detail);
      return new ApiError({status, kind: 'text', code, expired, serverMessage: body.detail, retryAfter: headerSeconds});
    }

    if (typeof error === 'string') {
      // Shape 3: a plain text.
      const {code, expired} = textErrorCode(status, error);
      return new ApiError({
        status,
        kind: 'text',
        code,
        expired,
        serverMessage: error,
        retryAfter: headerSeconds,
      });
    }

    if (isRecord(error)) {
      // Shape 1 copies the fields at the root too; shape 2 does not. Reading the
      // error object first, then the root, covers both.
      const code = asString(error.code) ?? asString(body.code);
      const context: ApiErrorContext = {...body, ...error};
      delete context.error;
      delete context.detail;
      const serverMessage = asString(error.message) ?? asString(body.message);

      const sanctionCode = SANCTION_CODES.find((candidate) => candidate === code);
      if (sanctionCode) {
        return new ApiError({
          status,
          kind: 'sanction',
          code: sanctionCode,
          context,
          sanction: sanctionFrom(error, sanctionCode),
          serverMessage,
          retryAfter: headerSeconds,
        });
      }

      if (code) {
        return new ApiError({
          status,
          kind: 'lineup',
          code,
          context,
          serverMessage,
          retryAfter: withRetry(code, context),
        });
      }
      return new ApiError({status, kind: 'unknown', code: null, context, serverMessage, retryAfter: headerSeconds});
    }

    if (detail) {
      // FastAPI's own 422, if the global handler ever stops wrapping it.
      return new ApiError({status, kind: 'validation', code: 'validation_error', validation: detail});
    }
  }

  // Not JSON, or JSON of no known shape: a gateway page, a proxy, a crash.
  return new ApiError({
    status,
    kind: 'unknown',
    code: status === 401 ? 'unauthenticated' : null,
    retryAfter: headerSeconds,
  });
}

// ---------------------------------------------------------------------------
// Query string
// ---------------------------------------------------------------------------

type QueryScalar = string | number | boolean | null | undefined;
export type QueryValue = QueryScalar | readonly QueryScalar[];
export type Query = Record<string, QueryValue>;

/**
 * `a=1&tag=x&tag=y`. An array becomes repeated params (the API accepts
 * `?positions=a&positions=b`). Undefined, null and '' are skipped, in arrays
 * too; `false` and `0` are values.
 */
export function serializeQuery(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values as QueryScalar[]) {
      if (item === undefined || item === null || item === '') continue;
      params.append(key, String(item));
    }
  }
  return params.toString();
}

/** The absolute URL of an API path (`/lineup/posts`) with its query. */
export function apiUrl(path: string, query?: Query): string {
  const search = serializeQuery(query);
  return `${config.apiBase}${path}${search ? `?${search}` : ''}`;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface ApiRequestInit extends Omit<RequestInit, 'body' | 'credentials'> {
  query?: Query;
  /** Sent as JSON, with its Content-Type; nothing is sent when it is undefined. */
  body?: unknown;
}

function isAbort(error: unknown, signal: AbortSignal | null | undefined): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError');
}

/**
 * Calls the API. Resolves with the JSON body (`undefined` for a 204 or an
 * empty body); rejects with an `ApiError`. An aborted request rejects with the
 * browser's own AbortError, which TanStack Query ignores.
 */
export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const {query, body, headers, ...rest} = init;

  const requestHeaders = new Headers(headers);
  const hasBody = body !== undefined;
  if (hasBody && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(apiUrl(path, query), {
      ...rest,
      headers: requestHeaders,
      credentials: 'include',
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (isAbort(cause, init.signal)) throw cause;
    throw new ApiError({status: 0, kind: 'network', code: 'network_error', cause});
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text().catch(() => '');
  let parsed: unknown;
  let readable = true;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      readable = false;
    }
  }

  if (response.ok) {
    if (!readable) throw new ApiError({status: response.status, kind: 'unknown', code: null});
    return parsed as T;
  }
  throw errorFromResponse(response.status, readable ? parsed : undefined, response.headers.get('Retry-After'));
}

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

/** The key a form field answers to: `['body', 'requirements', 2, 'value']` becomes `requirements.2.value`. */
export function fieldPath(loc: ReadonlyArray<string | number>): string {
  const [head, ...rest] = loc;
  const parts = head === 'body' || head === 'query' || head === 'path' ? rest : loc;
  return parts.join('.');
}

/** What a model-level issue (no field) is keyed under. */
export const FORM_ERROR_KEY = '_form';

/** The issues of a standard 422 grouped by field; the first issue of a field comes first. */
export function issuesByField(error: unknown): Map<string, ValidationIssue[]> {
  const grouped = new Map<string, ValidationIssue[]>();
  if (!isApiError(error) || !error.validation) return grouped;
  for (const issue of error.validation) {
    const key = fieldPath(issue.loc) || FORM_ERROR_KEY;
    const list = grouped.get(key);
    if (list) list.push(issue);
    else grouped.set(key, [issue]);
  }
  return grouped;
}
