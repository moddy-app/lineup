import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {ApiError} from './client';
import {secondsLeft, useRetryAfter} from './useRetryAfter';

const limited = (retryAfter: number | null) =>
  new ApiError({status: 429, kind: 'lineup', code: 'lineup_rate_limited', retryAfter});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('secondsLeft', () => {
  it('counts from the moment the error was received, rounding up', () => {
    const error = limited(45);
    expect(secondsLeft(error, error.receivedAt)).toBe(45);
    expect(secondsLeft(error, error.receivedAt + 1)).toBe(45);
    expect(secondsLeft(error, error.receivedAt + 1000)).toBe(44);
    expect(secondsLeft(error, error.receivedAt + 44_500)).toBe(1);
    expect(secondsLeft(error, error.receivedAt + 45_000)).toBe(0);
    expect(secondsLeft(error, error.receivedAt + 99_000)).toBe(0);
  });

  it('is zero for an error with no delay, or anything else', () => {
    expect(secondsLeft(limited(null), Date.now())).toBe(0);
    expect(secondsLeft(new Error('x'), Date.now())).toBe(0);
    expect(secondsLeft(null, Date.now())).toBe(0);
  });
});

describe('useRetryAfter', () => {
  it('counts down each second and ends inactive', () => {
    const error = limited(3);
    const {result} = renderHook(() => useRetryAfter(error));
    expect(result.current).toEqual({seconds: 3, active: true});
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.seconds).toBe(2);
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current).toEqual({seconds: 0, active: false});
  });

  it('is inactive without an error', () => {
    const {result} = renderHook(() => useRetryAfter(null));
    expect(result.current).toEqual({seconds: 0, active: false});
  });

  it('restarts for a new error', () => {
    const first = limited(2);
    const {result, rerender} = renderHook(({error}) => useRetryAfter(error), {initialProps: {error: first}});
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.active).toBe(false);
    rerender({error: limited(30)});
    expect(result.current).toEqual({seconds: 30, active: true});
  });
});
