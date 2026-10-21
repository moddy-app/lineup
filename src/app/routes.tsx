import {Navigate, type RouteObject} from 'react-router';

import {PageLoading} from '@/ui';

import type {RouteHandle} from './handle';
import {paths, routePatterns as p} from './paths';
import {RequireAuth} from './RequireAuth';
import type {AuthPurpose} from './SignInPrompt';
import {RouteError} from './RouteError';
import {Root} from './Root';

/** The pages that need a session go under this layout route: sign-in prompt, suspension screen, staff check. */
const protectedRoutes = (
  purpose: AuthPurpose,
  children: RouteObject[],
  options: {staff?: boolean} = {},
): RouteObject => ({
  element: <RequireAuth purpose={purpose} staff={options.staff} />,
  handle: {requiresAuth: true} satisfies RouteHandle,
  children,
});

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
    element: <Root />,
    children: [
      {
        id: 'content',
        HydrateFallback: PageLoading,
        ErrorBoundary: RouteError,
        children: [
          {path: p.feed, lazy: () => import('@/features/feed/FeedPage')},
          {path: p.people, lazy: () => import('@/features/feed/PeoplePage')},
          {path: p.post, lazy: () => import('@/features/post/PostPage')},
          // The old address of the servers directory, which no longer exists.
          {path: p.guilds, element: <Navigate to={paths.feed()} replace />},
          {path: p.guild, lazy: () => import('@/features/guild-profile/GuildProfilePage')},
          {path: p.user, lazy: () => import('@/features/user-profile/UserProfilePage')},
          protectedRoutes('editor', [
            {path: p.postNew, lazy: () => import('@/features/post-editor/PostEditorPage')},
            {path: p.postEdit, lazy: () => import('@/features/post-editor/PostEditorPage')},
          ]),
          protectedRoutes('posts', [{path: p.myPosts, lazy: () => import('@/features/my-posts/MyPostsPage')}]),
          // The old addresses of the claim page: its two dialogs now open on the dashboard.
          {path: p.guildClaim, element: <Navigate to={paths.guildClaim()} replace />},
          {path: p.myGuilds, element: <Navigate to={paths.myGuilds()} replace />},
          protectedRoutes('manage', [
            {
              path: p.guildManage,
              lazy: () => import('@/features/guild-manage/GuildManageLayout'),
              children: [
                {index: true, lazy: () => import('@/features/guild-manage/ProfilePage')},
                {path: 'invite', lazy: () => import('@/features/guild-manage/InvitePage')},
                {path: 'posts', lazy: () => import('@/features/guild-manage/PostsPage')},
                {path: 'discord', lazy: () => import('@/features/guild-manage/DiscordPage')},
                {path: 'settings', lazy: () => import('@/features/guild-manage/SettingsPage')},
              ],
            },
          ]),
          protectedRoutes('profile', [{path: p.me, lazy: () => import('@/features/me-profile/MeProfilePage')}]),
          protectedRoutes('experiences', [
            {path: p.myExperiences, lazy: () => import('@/features/experiences/ExperiencesPage')},
          ]),
          protectedRoutes(
            'default',
            [
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
            ],
            {staff: true},
          ),
          // Development only: the UI gallery. Left out of production builds.
          ...(import.meta.env.DEV ? [{path: '__ui', lazy: () => import('@/dev/UiGallery')}] : []),
          {path: '*', lazy: () => import('./NotFoundPage'), handle: {special: true} satisfies RouteHandle},
        ],
      },
    ],
  },
];
