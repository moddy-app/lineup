/**
 * Route loaders that read a page's data before the page shows. While they run,
 * React Router keeps the current page on screen (`navigation.state` is
 * `loading`): the bar at the top of the window shows and the page dims a
 * little (AppShell, lineup.css `.app-content.is-navigating`), then the next
 * page appears with its data.
 *
 * A loader never fails and never waits more than `WAIT_MS`: an error, or a slow
 * answer, is left to the page (its own error or loading state). Data that needs
 * a session is only read for a signed-in session. Without a client (tests that
 * render routes without `App`) the loaders do nothing.
 */

import type {QueryClient} from '@tanstack/react-query';
import type {LoaderFunction, LoaderFunctionArgs, ShouldRevalidateFunction} from 'react-router';

import {queryKeys} from '@/api/queryKeys';
import type {SessionSnapshot} from '@/api/sessionSnapshot';

const WAIT_MS = 4000;

let client: QueryClient | null = null;

/** Called once by `App` with its query client. `null` turns the loaders off. */
export function setPreloadClient(next: QueryClient | null): void {
  client = next;
}

function signedIn(queryClient: QueryClient): boolean {
  return queryClient.getQueryData<SessionSnapshot>(queryKeys.me())?.status === 'authenticated';
}

type Preload = (queryClient: QueryClient, args: LoaderFunctionArgs) => Array<Promise<unknown>>;

/** A loader that runs `preload` (the page's queries, as prefetches) and waits for them, `WAIT_MS` at most. */
export function preloader(preload: Preload, options: {auth?: boolean} = {}): LoaderFunction {
  return async (args) => {
    const queryClient = client;
    if (!queryClient || (options.auth && !signedIn(queryClient))) return null;
    const work = Promise.allSettled(preload(queryClient, args));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, WAIT_MS);
    });
    await Promise.race([work, timeout]);
    clearTimeout(timer);
    return null;
  };
}

/**
 * Loaders run again only for a new path: a change of the query string (the
 * feed's filters, a tab of the posts) stays instant, the page shows its
 * previous results while the new ones load.
 */
export const onNewPath: ShouldRevalidateFunction = ({currentUrl, nextUrl, defaultShouldRevalidate}) =>
  currentUrl.pathname !== nextUrl.pathname && defaultShouldRevalidate;
