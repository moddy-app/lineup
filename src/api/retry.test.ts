import {describe, expect, it} from 'vitest';

import {ApiError} from './client';
import {MAX_RETRY_DELAY_MS, retryDelay, shouldRetry} from './retry';

const error = (init: Partial<ConstructorParameters<typeof ApiError>[0]> & {status: number}) =>
  new ApiError({kind: 'lineup', code: null, ...init});

const network = new ApiError({status: 0, kind: 'network', code: 'network_error'});
const discord = error({status: 503, code: 'discord_unavailable', retryAfter: 30});

describe('shouldRetry', () => {
  it('retries a network failure and a Discord outage twice', () => {
    for (const failure of [network, discord]) {
      expect(shouldRetry(0, failure)).toBe(true);
      expect(shouldRetry(1, failure)).toBe(true);
      expect(shouldRetry(2, failure)).toBe(false);
    }
  });

  it('never retries a 4xx', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(shouldRetry(0, error({status, code: 'lineup_post_not_found'})), String(status)).toBe(false);
    }
  });

  it('does not retry other failures, nor anything that is not an API error', () => {
    expect(shouldRetry(0, error({status: 500}))).toBe(false);
    expect(shouldRetry(0, error({status: 502, kind: 'unknown'}))).toBe(false);
    expect(shouldRetry(0, new Error('bug'))).toBe(false);
  });
});

describe('retryDelay', () => {
  it('backs off exponentially from one second', () => {
    expect(retryDelay(0, network)).toBe(1000);
    expect(retryDelay(1, network)).toBe(2000);
  });

  it('waits at least what Retry-After asks', () => {
    expect(retryDelay(0, discord)).toBe(30_000);
    expect(retryDelay(0, error({status: 503, code: 'discord_unavailable', retryAfter: 5}))).toBe(5000);
  });

  it('never waits more than 30 seconds', () => {
    expect(retryDelay(0, error({status: 503, code: 'discord_unavailable', retryAfter: 120}))).toBe(MAX_RETRY_DELAY_MS);
    expect(retryDelay(10, network)).toBe(MAX_RETRY_DELAY_MS);
  });
});
