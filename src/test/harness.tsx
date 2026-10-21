/* eslint-disable react-refresh/only-export-components -- test support, not a module that hot-reloads */

/**
 * Test helpers: a stubbed API and the app's providers around a memory router.
 * Not part of the app.
 */

import {QueryClientProvider} from '@tanstack/react-query';
import {useEffect} from 'react';
import {render} from '@testing-library/react';
import {vi} from 'vitest';
import {createMemoryRouter, Outlet, type RouteObject, RouterProvider} from 'react-router';

import {createQueryClient} from '@/app/queryClient';
import {SessionProvider} from '@/auth/session';
import {i18n, initI18n} from '@/i18n';
import {SnackbarProvider} from '@/ui';

export type Handler = (request: {
  method: string;
  path: string;
  search: string;
  body: unknown;
}) => Response | Promise<Response>;

/** A JSON response. */
export const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body ?? {}), {status, headers});

/**
 * Replaces `fetch` with a router over `'METHOD /path'` keys. A request nobody
 * handles fails the test loudly instead of hitting a network.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: Array<{method: string; path: string; search: string; body: unknown}> = [];
  const spy = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(String(input));
    const call = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      search: url.search,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const handler = handlers[`${call.method} ${call.path}`];
    if (!handler) throw new Error(`Unhandled request: ${call.method} ${call.path}`);
    return handler(call);
  });
  vi.stubGlobal('fetch', spy);
  return {calls, spy};
}

/** French, so that assertions read like the product. */
export async function useFrench() {
  initI18n();
  await i18n.changeLanguage('fr');
}

/** The app's providers around a memory router. `routes` are children of the session provider's route. */
export function renderApp(routes: RouteObject[], {path = '/'}: {path?: string} = {}) {
  const queryClient = createQueryClient();
  // No test waits for the real retry delays.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: {...queryClient.getDefaultOptions().queries, retryDelay: 1},
  });
  const router = createMemoryRouter(
    [{path: '/', element: <Session />, children: routes.length ? routes : [{path: '*', element: null}]}],
    {initialEntries: [path]},
  );
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <RouterProvider router={router} />
      </SnackbarProvider>
    </QueryClientProvider>,
  );
  return {...utils, queryClient, router};
}

function Session() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}

/**
 * Reads a hook from inside the providers: mount `<Capture />` in a route and
 * call `current()` for the latest value it returned.
 */
export function captureHook<T>(useIt: () => T) {
  const holder: {value?: T} = {};
  function Capture() {
    const value = useIt();
    // After the render, not during it: a render must not write outside itself.
    useEffect(() => {
      holder.value = value;
    });
    return null;
  }
  return {Capture, current: () => holder.value as T};
}
