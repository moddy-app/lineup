import {Navigate, type RouteObject} from 'react-router';

import {PageLoading} from '@/ui';

import {AppShell} from './AppShell';
import type {RouteHandle} from './handle';
import {routePatterns as p} from './paths';
import {RouteError} from './RouteError';

/**
 * The route table. The shell is eager (it is on every page); every page is
 * lazy, in its feature folder, and exports a `Component`.
 *
 * The pathless "content" route carries the loading and error states, so both
 * appear inside the shell: the app bar never disappears.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        id: 'content',
        HydrateFallback: PageLoading,
        ErrorBoundary: RouteError,
        children: [
          {path: p.feed, lazy: () => import('@/features/feed/FeedPage')},
          {path: p.postNew, lazy: () => import('@/features/post-editor/PostEditorPage')},
          {path: p.postEdit, lazy: () => import('@/features/post-editor/PostEditorPage')},
          {path: p.post, lazy: () => import('@/features/post/PostPage')},
          {path: p.myPosts, lazy: () => import('@/features/my-posts/MyPostsPage')},
          {path: p.guilds, lazy: () => import('@/features/guilds/GuildDirectoryPage')},
          {path: p.guildClaim, lazy: () => import('@/features/claim/ClaimPage')},
          {path: p.guild, lazy: () => import('@/features/guild-profile/GuildProfilePage')},
          {path: p.guildManage, lazy: () => import('@/features/guild-manage/GuildManagePage')},
          {path: p.user, lazy: () => import('@/features/user-profile/UserProfilePage')},
          {path: p.me, lazy: () => import('@/features/me-profile/MeProfilePage')},
          {path: p.myExperiences, lazy: () => import('@/features/experiences/ExperiencesPage')},
          {
            path: p.staff,
            lazy: () => import('@/features/staff/StaffLayout'),
            children: [
              {index: true, element: <Navigate to="reviews" replace />},
              {path: 'reviews', lazy: () => import('@/features/staff/ReviewsPage')},
              {path: 'reports', lazy: () => import('@/features/staff/ReportsPage')},
              {path: 'badges', lazy: () => import('@/features/staff/BadgesPage')},
              {path: 'posts', lazy: () => import('@/features/staff/StaffPostsPage')},
            ],
          },
          // Development only: the UI gallery. Left out of production builds.
          ...(import.meta.env.DEV ? [{path: '__ui', lazy: () => import('@/dev/UiGallery')}] : []),
          {path: '*', lazy: () => import('./NotFoundPage'), handle: {special: true} satisfies RouteHandle},
        ],
      },
    ],
  },
];
