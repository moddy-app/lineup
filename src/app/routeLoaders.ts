/** The data each page reads before it shows (see preload.ts): the same queries as the page's hooks. */

import {
  botQuery,
  botsQuery,
  catalogQuery,
  feedQuery,
  guildQuery,
  myExperiencesQuery,
  myBotsQuery,
  myGuildsQuery,
  myPostsQuery,
  myProfileQuery,
  postQuery,
  userQuery,
} from '@/api/queries';
import type {PostStatus} from '@/api/types';
import {readNsfwConfirmed} from '@/components/nsfw';
import {effectiveBotFilters, parseBotParams} from '@/features/bots/botFilters';
import {effectiveFilters, type FeedPageKind, parseFeedParams} from '@/features/feed/feedFilters';

import {preloader} from './preload';

/** `/` and `/people`: the first page of the feed for the filters of the address. */
export const feedLoader = (kind: FeedPageKind) =>
  preloader((client, {request}) => [
    client.ensureQueryData(catalogQuery()).then((catalog) => {
      const filters = parseFeedParams(new URL(request.url).searchParams, catalog);
      return client.prefetchInfiniteQuery(feedQuery(effectiveFilters(filters, kind, readNsfwConfirmed())));
    }),
  ]);

export const postLoader = preloader((client, {params}) =>
  params.postId ? [client.prefetchQuery(postQuery(params.postId))] : [],
);

export const guildLoader = preloader((client, {params}) =>
  params.guildId ? [client.prefetchQuery(guildQuery(params.guildId))] : [],
);

export const botLoader = preloader((client, {params}) =>
  params.botId ? [client.prefetchQuery(botQuery(params.botId))] : [],
);

/** `/bots`: the first page of the directory for the filters of the address. */
export const botsLoader = preloader((client, {request}) => [
  client.ensureQueryData(catalogQuery()).then((catalog) => {
    const filters = parseBotParams(new URL(request.url).searchParams, catalog);
    return client.prefetchInfiniteQuery(botsQuery(effectiveBotFilters(filters, readNsfwConfirmed())));
  }),
]);

export const userLoader = preloader((client, {params}) =>
  params.userId ? [client.prefetchQuery(userQuery(params.userId))] : [],
);

/** The editor: the catalog, the post when editing, the person's servers for a server's post. */
export const editorLoader = preloader(
  (client, {params, request}) => [
    client.prefetchQuery(catalogQuery()),
    ...(params.postId ? [client.prefetchQuery(postQuery(params.postId))] : []),
    ...(new URL(request.url).searchParams.has('guild') ? [client.prefetchQuery(myGuildsQuery())] : []),
    ...(new URL(request.url).searchParams.has('bot') ? [client.prefetchQuery(myBotsQuery())] : []),
  ],
  {auth: true},
);

const STATUSES: readonly PostStatus[] = ['draft', 'published', 'closed', 'hidden'];

/** `/me/posts` and a server's posts: the list of the tab of the address (`?status=`). */
export const myPostsLoader = preloader(
  (client, {params, request}) => {
    const requested = new URL(request.url).searchParams.get('status');
    const status = STATUSES.find((entry) => entry === requested);
    return [client.prefetchInfiniteQuery(myPostsQuery({status, guildId: params.guildId, botId: params.botId}))];
  },
  {auth: true},
);

export const myProfileLoader = preloader((client) => [client.prefetchQuery(myProfileQuery())], {auth: true});

export const myExperiencesLoader = preloader((client) => [client.prefetchQuery(myExperiencesQuery())], {
  auth: true,
});
