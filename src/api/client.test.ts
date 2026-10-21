import {afterEach, describe, expect, it, vi} from 'vitest';

import {config} from '@/config';

import {
  ApiError,
  apiFetch,
  fieldPath,
  hasCode,
  isApiError,
  issuesByField,
  parseRetryAfterHeader,
  serializeQuery,
} from './client';

/** Stubs `fetch` with one canned response and returns the spy. */
function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const spy = vi.fn(
    async (..._args: Parameters<typeof fetch>) => new Response(status === 204 ? null : text, {status, headers}),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

async function failure(path = '/lineup/me'): Promise<ApiError> {
  try {
    await apiFetch(path);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('The request should have failed.');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch: requests', () => {
  it('calls the absolute URL with the cookie, and sends no body or content type on a GET', async () => {
    const spy = respond(200, {ok: true});
    await expect(apiFetch('/lineup/catalog')).resolves.toEqual({ok: true});
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe(`${config.apiBase}/lineup/catalog`);
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('sends JSON and its content type only when there is a body', async () => {
    const spy = respond(201, {id: '1'});
    await apiFetch('/lineup/posts', {method: 'POST', body: {title: 'Hello'}});
    const [, init] = spy.mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"title":"Hello"}');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('sends an empty POST without a content type', async () => {
    const spy = respond(200, {});
    await apiFetch('/lineup/posts/x/publish', {method: 'POST'});
    const [, init] = spy.mock.calls[0]!;
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('sends a falsy body (false, 0, null) rather than dropping it', async () => {
    const spy = respond(200, {});
    await apiFetch('/x', {method: 'PUT', body: null});
    expect(spy.mock.calls[0]![1]?.body).toBe('null');
  });

  it('resolves undefined on a 204', async () => {
    respond(204);
    await expect(apiFetch('/lineup/posts/x', {method: 'DELETE'})).resolves.toBeUndefined();
  });

  it('resolves undefined on an empty 200', async () => {
    respond(200);
    await expect(apiFetch('/x')).resolves.toBeUndefined();
  });

  it('passes the abort signal to fetch and lets an abort through untouched', async () => {
    const controller = new AbortController();
    const spy = vi.fn(async (_url: unknown, _init?: RequestInit): Promise<Response> => {
      controller.abort();
      throw new DOMException('The operation was aborted.', 'AbortError');
    });
    vi.stubGlobal('fetch', spy);
    const error = await apiFetch('/lineup/posts', {signal: controller.signal}).catch((e: unknown) => e);
    expect(spy.mock.calls[0]![1]?.signal).toBe(controller.signal);
    expect(error).toBeInstanceOf(DOMException);
    expect(isApiError(error)).toBe(false);
  });
});

describe('query serialization', () => {
  it('repeats array params', () => {
    expect(serializeQuery({positions: ['moderator', 'admin'], kind: 'guild'})).toBe(
      'positions=moderator&positions=admin&kind=guild',
    );
  });

  it('skips undefined, null and empty strings, keeps false and 0', () => {
    expect(serializeQuery({a: undefined, b: null, c: '', d: false, e: 0, f: ['x', '', undefined, null]})).toBe(
      'd=false&e=0&f=x',
    );
  });

  it('encodes values', () => {
    expect(serializeQuery({q: 'a b&c'})).toBe('q=a+b%26c');
  });

  it('is empty without a query', () => {
    expect(serializeQuery(undefined)).toBe('');
    expect(serializeQuery({})).toBe('');
  });

  it('puts the query on the URL', async () => {
    const spy = respond(200, {items: [], next_cursor: null});
    await apiFetch('/lineup/posts', {query: {positions: ['a', 'b'], limit: 20, cursor: undefined}});
    expect(spy.mock.calls[0]![0]).toBe(`${config.apiBase}/lineup/posts?positions=a&positions=b&limit=20`);
  });
});

describe('error shape 1: a Lineup error (copied at the root)', () => {
  const body = {
    error: {
      code: 'lineup_quota_exceeded',
      message: 'Limite de 5 annonces publiées atteinte.',
      limit: 5,
      scope: 'guild',
    },
    code: 'lineup_quota_exceeded',
    message: 'Limite de 5 annonces publiées atteinte.',
    limit: 5,
    scope: 'guild',
  };

  it('reads the code, the context and the French message', async () => {
    respond(409, body);
    const error = await failure();
    expect(error.status).toBe(409);
    expect(error.kind).toBe('lineup');
    expect(error.code).toBe('lineup_quota_exceeded');
    expect(error.context.limit).toBe(5);
    expect(error.context.scope).toBe('guild');
    expect(error.serverMessage).toBe('Limite de 5 annonces publiées atteinte.');
    expect(error.sanction).toBeNull();
    expect(error.validation).toBeNull();
    expect(error.retryAfter).toBeNull();
    expect(hasCode(error, 'lineup_quota_exceeded')).toBe(true);
    expect(hasCode(error, 'other')).toBe(false);
  });

  it('reads the code from the root when the error object lacks it', async () => {
    respond(404, {error: {message: 'x'}, code: 'lineup_post_not_found'});
    expect((await failure()).code).toBe('lineup_post_not_found');
  });

  it('keeps the context of an already-claimed server', async () => {
    respond(409, {error: {code: 'lineup_guild_already_claimed', message: 'm', guild_id: '812345678901234567'}});
    const error = await failure();
    expect(error.context.guild_id).toBe('812345678901234567');
  });
});

describe('error shape 2: a global sanction (no copy at the root)', () => {
  const body = {
    error: {
      code: 'user_suspended',
      level: 'ban',
      subject_type: 'discord_user',
      subject_id: '1234567890123456789',
      references: ['A7F2K9'],
      expires_at: null,
      message: 'Votre accès à Moddy est suspendu.',
      violations_url: 'https://moddy.app/violations',
    },
  };

  it('builds the sanction', async () => {
    respond(403, body);
    const error = await failure();
    expect(error.kind).toBe('sanction');
    expect(error.code).toBe('user_suspended');
    expect(error.sanction).toEqual({
      code: 'user_suspended',
      level: 'ban',
      subject_type: 'discord_user',
      subject_id: '1234567890123456789',
      references: ['A7F2K9'],
      expires_at: null,
      message: 'Votre accès à Moddy est suspendu.',
      violations_url: 'https://moddy.app/violations',
    });
  });

  it('knows a suspended server too', async () => {
    respond(403, {error: {...body.error, code: 'guild_suspended', subject_type: 'guild'}});
    const error = await failure();
    expect(error.kind).toBe('sanction');
    expect(error.sanction?.code).toBe('guild_suspended');
  });

  it('survives a sanction without references or a link', async () => {
    respond(403, {error: {code: 'user_suspended'}});
    const error = await failure();
    expect(error.sanction?.references).toEqual([]);
    expect(error.sanction?.violations_url).toBeNull();
  });
});

describe('error shape 3: plain text', () => {
  it('maps a 401 to unauthenticated', async () => {
    respond(401, {error: 'Non authentifie'});
    const error = await failure();
    expect(error.kind).toBe('text');
    expect(error.code).toBe('unauthenticated');
    expect(error.expired).toBe(false);
  });

  it('flags an expired session', async () => {
    respond(401, {error: 'Session expiree'});
    const error = await failure();
    expect(error.code).toBe('unauthenticated');
    expect(error.expired).toBe(true);
  });

  it('reads the FastAPI `detail` string of an unknown route or a wrong method like a plain text', async () => {
    respond(404, {detail: 'Not Found'});
    const notFound = await failure();
    expect([notFound.kind, notFound.code, notFound.serverMessage]).toEqual(['text', 'route_not_found', 'Not Found']);
    respond(405, {detail: 'Method Not Allowed'});
    const method = await failure();
    expect([method.kind, method.code, method.status]).toEqual(['text', null, 405]);
    respond(401, {detail: 'Not authenticated'});
    expect((await failure()).code).toBe('unauthenticated');
  });

  it('treats a 200 with an empty body (logout) as a success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, {status: 200})),
    );
    await expect(apiFetch('/auth/logout', {method: 'POST'})).resolves.toBeUndefined();
  });

  it('maps Staff only', async () => {
    respond(403, {error: 'Staff only'});
    expect((await failure()).code).toBe('staff_only');
  });

  it('maps Origin not allowed', async () => {
    respond(403, {error: 'Origin not allowed'});
    expect((await failure()).code).toBe('origin_not_allowed');
  });

  it('maps a 404 Not Found to an unknown route', async () => {
    respond(404, {error: 'Not Found'});
    expect((await failure()).code).toBe('route_not_found');
  });

  it('keeps an unknown text as the server message, with no code', async () => {
    respond(400, {error: 'Something odd'});
    const error = await failure();
    expect(error.kind).toBe('text');
    expect(error.code).toBeNull();
    expect(error.serverMessage).toBe('Something odd');
  });
});

describe('error shape 4: validation', () => {
  const body = {
    error: 'Validation error',
    detail: [
      {
        type: 'string_too_short',
        loc: ['body', 'title'],
        msg: 'String should have at least 5 characters',
        input: 'Hey',
        ctx: {min_length: 5},
      },
      {type: 'missing', loc: ['body', 'requirements', 2, 'value'], msg: 'Field required', input: {}},
    ],
  };

  it('keeps the issues', async () => {
    respond(422, body);
    const error = await failure();
    expect(error.kind).toBe('validation');
    expect(error.code).toBe('validation_error');
    expect(error.validation).toHaveLength(2);
    expect(error.validation![0]).toEqual({
      type: 'string_too_short',
      loc: ['body', 'title'],
      msg: 'String should have at least 5 characters',
      input: 'Hey',
      ctx: {min_length: 5},
    });
  });

  it('groups issues by form field', async () => {
    respond(422, body);
    const grouped = issuesByField(await failure());
    expect([...grouped.keys()]).toEqual(['title', 'requirements.2.value']);
  });

  it('maps locations to field names', () => {
    expect(fieldPath(['body', 'title'])).toBe('title');
    expect(fieldPath(['body', 'requirements', 2, 'value'])).toBe('requirements.2.value');
    expect(fieldPath(['query', 'limit'])).toBe('limit');
    expect(fieldPath(['path', 'post_id'])).toBe('post_id');
    expect(fieldPath(['body'])).toBe('');
  });

  it('is a lineup error, not a validation, when the 422 has a code', async () => {
    respond(422, {error: {code: 'cursor_invalid', message: 'Curseur invalide.'}, code: 'cursor_invalid'});
    const error = await failure();
    expect(error.kind).toBe('lineup');
    expect(error.code).toBe('cursor_invalid');
  });
});

describe('Retry-After', () => {
  it('prefers retry_after in the body over the header', async () => {
    respond(
      429,
      {
        error: {code: 'lineup_rate_limited', message: 'm', retry_after: 42},
        code: 'lineup_rate_limited',
        retry_after: 42,
      },
      {'Retry-After': '10'},
    );
    const error = await failure();
    expect(error.code).toBe('lineup_rate_limited');
    expect(error.retryAfter).toBe(42);
  });

  it('falls back to the header', async () => {
    respond(429, {error: {code: 'lineup_rate_limited', message: 'm'}}, {'Retry-After': '17'});
    expect((await failure()).retryAfter).toBe(17);
  });

  it('falls back to 60 seconds for a rate limit with no delay at all', async () => {
    respond(429, {error: {code: 'lineup_rate_limited', message: 'm'}});
    expect((await failure()).retryAfter).toBe(60);
  });

  it('reads the Retry-After: 30 of a 503 discord_unavailable', async () => {
    respond(
      503,
      {error: {code: 'discord_unavailable', message: 'm'}, code: 'discord_unavailable'},
      {'Retry-After': '30'},
    );
    const error = await failure();
    expect(error.status).toBe(503);
    expect(error.code).toBe('discord_unavailable');
    expect(error.retryAfter).toBe(30);
  });

  it('defaults a discord_unavailable to 30 when the header is not readable', async () => {
    respond(503, {error: {code: 'discord_unavailable', message: 'm'}});
    expect((await failure()).retryAfter).toBe(30);
  });

  it('parses a header given as an HTTP date', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    expect(parseRetryAfterHeader('Tue, 20 Oct 2026 10:00:45 GMT', now)).toBe(45);
    expect(parseRetryAfterHeader('Tue, 20 Oct 2026 09:00:00 GMT', now)).toBeNull();
    expect(parseRetryAfterHeader('soon', now)).toBeNull();
    expect(parseRetryAfterHeader(null, now)).toBeNull();
    expect(parseRetryAfterHeader('0', now)).toBeNull();
  });

  it('has no delay on other errors', async () => {
    respond(404, {error: {code: 'lineup_post_not_found', message: 'm'}});
    expect((await failure()).retryAfter).toBeNull();
  });
});

describe('failures with no usable answer', () => {
  it('turns a fetch rejection into a network error', async () => {
    const cause = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause));
    const error = await failure();
    expect(error.kind).toBe('network');
    expect(error.code).toBe('network_error');
    expect(error.status).toBe(0);
    expect(error.cause).toBe(cause);
  });

  it('calls an HTML error page unknown', async () => {
    respond(502, '<html>Bad gateway</html>');
    const error = await failure();
    expect(error.kind).toBe('unknown');
    expect(error.code).toBeNull();
    expect(error.status).toBe(502);
  });

  it('calls a JSON body of no known shape unknown', async () => {
    respond(500, {oops: true});
    const error = await failure();
    expect(error.kind).toBe('unknown');
    expect(error.code).toBeNull();
  });

  it('still reads a 401 that is not JSON as unauthenticated', async () => {
    respond(401, 'nope');
    expect((await failure()).code).toBe('unauthenticated');
  });

  it('rejects a 200 whose body is not JSON', async () => {
    respond(200, 'not json');
    const error = await failure();
    expect(error.kind).toBe('unknown');
    expect(error.status).toBe(200);
  });
});
