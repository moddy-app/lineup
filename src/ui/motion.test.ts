import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {EXIT_MS, usePresence} from './motion';

const motion = (allowed: boolean) =>
  vi
    .spyOn(window, 'matchMedia')
    .mockImplementation(
      (query: string) => ({matches: allowed && query.includes('no-preference'), media: query}) as MediaQueryList,
    );

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('usePresence', () => {
  it('stays mounted, closing, for the exit animation, then unmounts', () => {
    vi.useFakeTimers();
    motion(true);
    const {result, rerender} = renderHook(({open}) => usePresence(open), {initialProps: {open: true}});
    expect(result.current).toEqual({mounted: true, closing: false});
    rerender({open: false});
    expect(result.current).toEqual({mounted: true, closing: true});
    act(() => void vi.advanceTimersByTime(EXIT_MS));
    expect(result.current).toEqual({mounted: false, closing: false});
  });

  it('opens again at once while closing', () => {
    vi.useFakeTimers();
    motion(true);
    const {result, rerender} = renderHook(({open}) => usePresence(open), {initialProps: {open: true}});
    rerender({open: false});
    rerender({open: true});
    expect(result.current).toEqual({mounted: true, closing: false});
    act(() => void vi.advanceTimersByTime(EXIT_MS));
    expect(result.current).toEqual({mounted: true, closing: false});
  });

  it('unmounts at once under reduced motion', () => {
    motion(false);
    const {result, rerender} = renderHook(({open}) => usePresence(open), {initialProps: {open: true}});
    rerender({open: false});
    expect(result.current).toEqual({mounted: false, closing: false});
  });
});
