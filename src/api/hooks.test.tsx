import {QueryClientProvider, type QueryClient} from '@tanstack/react-query';
import {act, renderHook, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {createQueryClient} from '@/app/queryClient';
import {json, mockApi} from '@/test/harness';

import {ApiError} from './client';
import {GUILD_ID, makeMe, makePost, makeWrittenPost, page} from './fixtures';
import {useCreatePost} from './mutations';
import {useInfiniteList} from './pagination';
import {useCatalog, useFeed, useMe, useMyProfile, usePost} from './queries';
import {queryKeys} from './queryKeys';
import type {SessionSnapshot} from './sessionSnapshot';

/** A client whose retries do not wait. */
function makeClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: {...client.getDefaultOptions().queries, retryDelay: 1},
  });
  return client;
}

const wrap = (client: QueryClient) =>
  function Wrapper({children}: {children: ReactNode}) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

const signedIn: SessionSnapshot = {status: 'authenticated', me: makeMe()};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the retry policy, through a real QueryClient', () => {
  it('does not retry a 4xx', async () => {
    const api = mockApi({
      'GET /lineup/posts/abc': () => json(404, {error: {code: 'lineup_post_not_found', message: 'm'}}),
    });
    const {result} = renderHook(() => usePost('abc'), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.code).toBe('lineup_post_not_found');
    expect(api.calls).toHaveLength(1);
  });

  it('retries a Discord outage twice, then gives up', async () => {
    const api = mockApi({
      'GET /lineup/posts/abc': () =>
        json(503, {error: {code: 'discord_unavailable', message: 'm'}}, {'Retry-After': '30'}),
    });
    const {result} = renderHook(() => usePost('abc'), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api.calls).toHaveLength(3);
    expect(result.current.error?.retryAfter).toBe(30);
  });

  it('recovers when a retry succeeds', async () => {
    let attempt = 0;
    mockApi({
      'GET /lineup/posts/abc': () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError('Failed to fetch');
        return json(200, makePost({id: 'abc'}));
      },
    });
    const {result} = renderHook(() => usePost('abc'), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(attempt).toBe(2);
  });

  it('never retries a write', async () => {
    const api = mockApi({
      'POST /lineup/posts': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const {result} = renderHook(() => useCreatePost(), {wrapper: wrap(makeClient())});
    await act(async () => {
      await result.current
        .mutateAsync({kind: 'user', title: 'Titre', description: 'x'.repeat(20), positions: ['moderator']})
        .catch(() => {});
    });
    expect(api.calls).toHaveLength(1);
  });
});

describe('what a failed request does to the session', () => {
  it('a 401 on a protected read signs the session out, without any redirect', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.me(), signedIn);
    mockApi({'GET /lineup/me/profile': () => json(401, {error: 'Session expiree'})});
    const {result} = renderHook(() => useMyProfile(), {wrapper: wrap(client)});
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<SessionSnapshot>(queryKeys.me())).toEqual({status: 'anonymous'});
    expect(result.current.error?.expired).toBe(true);
  });

  it('a suspension met by a write suspends the session', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.me(), signedIn);
    mockApi({
      'POST /lineup/posts': () =>
        json(403, {
          error: {
            code: 'user_suspended',
            level: 'ban',
            references: ['A7F2K9'],
            message: 'm',
            violations_url: 'https://moddy.app/violations',
          },
        }),
    });
    const {result} = renderHook(() => useCreatePost(), {wrapper: wrap(client)});
    await act(async () => {
      await result.current
        .mutateAsync({kind: 'user', title: 'Titre', description: 'x'.repeat(20), positions: ['moderator']})
        .catch(() => {});
    });
    expect(client.getQueryData<SessionSnapshot>(queryKeys.me())).toMatchObject({
      status: 'suspended',
      sanction: {references: ['A7F2K9']},
    });
  });

  it('a suspension met by a public read suspends the session too', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.me(), signedIn);
    mockApi({'GET /lineup/posts': () => json(403, {error: {code: 'user_suspended', message: 'm', references: []}})});
    const {result} = renderHook(() => useFeed(), {wrapper: wrap(client)});
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<SessionSnapshot>(queryKeys.me())?.status).toBe('suspended');
  });

  it('a 401 on a public read does not touch the session', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.me(), signedIn);
    mockApi({'GET /lineup/posts/abc': () => json(401, {error: 'Non authentifie'})});
    const {result} = renderHook(() => usePost('abc'), {wrapper: wrap(client)});
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<SessionSnapshot>(queryKeys.me())?.status).toBe('authenticated');
  });

  it('own-data hooks wait for a signed-in session instead of calling a 401', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.me(), {status: 'anonymous'} satisfies SessionSnapshot);
    const api = mockApi({});
    renderHook(() => useMyProfile(), {wrapper: wrap(client)});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toHaveLength(0);
  });
});

describe('useMe and useCatalog', () => {
  it('turns the three answers of /lineup/me into data', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe())});
    const {result} = renderHook(() => useMe(), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.data?.status).toBe('authenticated'));
  });

  it('loads the catalog once and keeps it for good', async () => {
    const client = makeClient();
    const api = mockApi({'GET /lineup/catalog': () => json(200, {positions: []})});
    const first = renderHook(() => useCatalog(), {wrapper: wrap(client)});
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    renderHook(() => useCatalog(), {wrapper: wrap(client)});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toHaveLength(1);
    expect(client.getQueryCache().find({queryKey: queryKeys.catalog()})?.isStaleByTime(Infinity)).toBe(false);
  });
});

describe('the feed and its pagination', () => {
  it('sends repeated params and the cursor as received, never built', async () => {
    const api = mockApi({
      'GET /lineup/posts': ({search}) => {
        const cursor = new URLSearchParams(search).get('cursor');
        return json(200, cursor ? page([makePost()], null) : page([makePost()], 'opaque-cursor=='));
      },
    });
    const {result} = renderHook(() => useInfiniteList(useFeed({positions: ['moderator', 'admin'], kind: 'guild'})), {
      wrapper: wrap(makeClient()),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);

    expect(api.calls[0]!.search).toBe('?kind=guild&positions=admin&positions=moderator');
    expect(api.calls[1]!.search).toBe('?kind=guild&positions=admin&positions=moderator&cursor=opaque-cursor%3D%3D');
  });

  it('two filter objects that mean the same share one cache entry', async () => {
    const client = makeClient();
    const api = mockApi({'GET /lineup/posts': () => json(200, page([makePost()]))});
    const first = renderHook(() => useFeed({positions: ['b', 'a', 'a'], q: ' mod ', include_nsfw: false}), {
      wrapper: wrap(client),
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    renderHook(() => useFeed({positions: ['a', 'b'], q: 'mod'}), {wrapper: wrap(client)});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toHaveLength(1);
  });

  it('follows empty pages that have a cursor on its own, and shows the posts after them', async () => {
    let call = 0;
    const api = mockApi({
      'GET /lineup/posts': () => {
        call += 1;
        if (call === 1) return json(200, page([], 'c1'));
        if (call === 2) return json(200, page([], 'c2'));
        return json(200, page([makePost()], null));
      },
    });
    const {result} = renderHook(() => useInfiniteList(useFeed()), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(api.calls).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isEmpty).toBe(false);
  });

  it('stops after three empty pages in a row and leaves "Load more" to the person', async () => {
    let call = 0;
    const api = mockApi({
      'GET /lineup/posts': () => {
        call += 1;
        return call <= 4 ? json(200, page([], `c${call}`)) : json(200, page([makePost()], null));
      },
    });
    const {result} = renderHook(() => useInfiniteList(useFeed()), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(api.calls).toHaveLength(3));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.calls).toHaveLength(3);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);

    act(() => result.current.loadMore());
    await waitFor(() => expect(api.calls).toHaveLength(4));
    // The fourth page is empty too: still no automatic fetch.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.calls).toHaveLength(4);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
  });

  it('is empty only when the list is over', async () => {
    mockApi({'GET /lineup/posts': () => json(200, page([], null))});
    const {result} = renderHook(() => useInfiniteList(useFeed()), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.isEmpty).toBe(true));
    expect(result.current.hasMore).toBe(false);
  });

  it('does not loop on a failing page: the items stay, the error is exposed', async () => {
    let call = 0;
    const api = mockApi({
      'GET /lineup/posts': () => {
        call += 1;
        return call === 1
          ? json(200, page([], 'c1'))
          : json(422, {error: {code: 'cursor_invalid', message: 'm'}, code: 'cursor_invalid'});
      },
    });
    const {result} = renderHook(() => useInfiniteList(useFeed()), {wrapper: wrap(makeClient())});
    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.calls).toHaveLength(2);
  });
});

describe('writes update the cache from the response', () => {
  it('a created post is in the detail cache and the right lists, with no other request', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.me(), signedIn);
    const created = makeWrittenPost({status: 'draft', kind: 'guild', guild_id: GUILD_ID});
    client.setQueryData(queryKeys.myPosts({status: 'draft'}), {pages: [page([])], pageParams: [null]});
    const api = mockApi({'POST /lineup/posts': () => json(201, created)});

    const {result} = renderHook(() => useCreatePost(), {wrapper: wrap(client)});
    await act(async () => {
      await result.current.mutateAsync({
        kind: 'guild',
        guild_id: GUILD_ID,
        title: 'Titre',
        description: 'x'.repeat(20),
        positions: ['moderator'],
      });
    });
    expect(client.getQueryData(queryKeys.postDetail(created.id))).toEqual(created);
    // My draft tab holds it now; nothing else was read.
    const draftTab = client.getQueryData<{pages: Array<{items: Array<{id: string}>}>}>(
      queryKeys.myPosts({status: 'draft'}),
    );
    expect(draftTab!.pages[0]!.items.map((post) => post.id)).toEqual([created.id]);
    expect(api.calls).toHaveLength(1);
  });
});
