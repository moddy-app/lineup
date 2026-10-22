import {QueryClient} from '@tanstack/react-query';
import type {LoaderFunctionArgs} from 'react-router';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {queryKeys} from '@/api/queryKeys';

import {onNewPath, preloader, setPreloadClient} from './preload';

const args = {request: new Request('https://lineup.moddy.app/'), params: {}, context: {}} as LoaderFunctionArgs;

afterEach(() => {
  setPreloadClient(null);
  vi.useRealTimers();
});

describe('preloader', () => {
  it('does nothing without a client', async () => {
    const preload = vi.fn(() => []);
    await expect(preloader(preload)(args)).resolves.toBeNull();
    expect(preload).not.toHaveBeenCalled();
  });

  it('waits for the page queries, and never fails', async () => {
    setPreloadClient(new QueryClient());
    let done = false;
    const work = new Promise<void>((resolve) => setTimeout(resolve, 10)).then(() => {
      done = true;
    });
    await preloader(() => [work, Promise.reject(new Error('down'))])(args);
    expect(done).toBe(true);
  });

  it('stops waiting after 4 s: a slow answer is left to the page', async () => {
    vi.useFakeTimers();
    setPreloadClient(new QueryClient());
    const pending = preloader(() => [new Promise(() => {})])(args);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(pending).resolves.toBeNull();
  });

  it('reads a session-only page only for a signed-in session', async () => {
    const client = new QueryClient();
    setPreloadClient(client);
    const preload = vi.fn(() => []);
    const loader = preloader(preload, {auth: true});
    client.setQueryData(queryKeys.me(), {status: 'anonymous'});
    await loader(args);
    expect(preload).not.toHaveBeenCalled();
    client.setQueryData(queryKeys.me(), {status: 'authenticated', me: {}});
    await loader(args);
    expect(preload).toHaveBeenCalledTimes(1);
  });
});

describe('onNewPath', () => {
  const at = (url: string) => new URL(url, 'https://lineup.moddy.app');
  it('reloads for a new path only, not for a new query string', () => {
    const base = {defaultShouldRevalidate: true} as Parameters<typeof onNewPath>[0];
    expect(onNewPath({...base, currentUrl: at('/people'), nextUrl: at('/people?positions=a')})).toBe(false);
    expect(onNewPath({...base, currentUrl: at('/me'), nextUrl: at('/people')})).toBe(true);
  });
});
