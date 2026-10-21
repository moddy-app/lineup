/**
 * Every route of LINEUP.md §6 (the 41 under /lineup, plus the dashboard's
 * `GET /auth/me` and `POST /auth/logout`), as a thin adapter: parse the path and the body, call
 * the logic, choose the status code. The rules live in ../logic.
 *
 * `GET /lineup/auth/login` is a browser navigation, not a request: in mock
 * mode the login button goes to the mock's own login page instead.
 */

import {mockCatalog} from '../logic/badges';
import type {BadgeEntityType} from '@/api/types';

import {unauthenticated} from '../errors';
import {
  claimGuild,
  deleteGuild,
  getGuildProfile,
  listDirectory,
  listMyGuilds,
  refreshGuild,
  refreshMyGuilds,
  updateGuild,
} from '../logic/guilds';
import {
  createExperience,
  deleteExperience,
  listMyExperiences,
  reorderExperiences,
  requestReview,
  staffRejectExperience,
  staffVerifyExperience,
  updateExperience,
  verifyExperience,
} from '../logic/experiences';
import {
  closePost,
  createPost,
  deletePost,
  getPostDetail,
  listFeed,
  listMyPosts,
  publishPost,
  updatePost,
} from '../logic/posts';
import {createReport} from '../logic/reports';
import {
  claimBody,
  createExperienceBody,
  createPostBody,
  guildUpdateBody,
  noteBody,
  orderBody,
  profileUpdateBody,
  reasonBody,
  reportBody,
  updateExperienceBody,
  updatePostBody,
} from '../logic/schemas';
import {
  dismissReport,
  grantBadge,
  hidePost,
  listBadgeGrants,
  listStaffExperiences,
  listStaffReports,
  resolveReport,
  revokeBadge,
  unhidePost,
} from '../logic/staff';
import {getUserProfile, toAccount, toMe, updateMyProfile} from '../logic/users';
import {calendarDate} from '../time';
import {Issues, parseBody, Params} from '../logic/validate';
import type {RouteContext} from './dispatch';
import {created, noContent, ok, type Reply} from './http';

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** `public`: nobody asked · `optional`: enriches the answer · `session`: current_user · `staff`: session + is_staff. */
  auth: 'public' | 'optional' | 'session' | 'staff' | 'any_session';
  /** Validation that runs BEFORE authentication (the 422 comes before the 401), for routes that do so. */
  validateFirst?: (context: RouteContext) => void;
  handler: (context: RouteContext) => Reply | Promise<Reply>;
}

/** The signed-in person of a `session` or `staff` route (the dispatcher already checked). */
function actorOf(c: RouteContext) {
  if (!c.actor) throw unauthenticated();
  return c.actor;
}

/** A path parameter read as a snowflake / a UUID, with Pydantic's 422 when it is neither. */
function pathSnowflake(c: RouteContext, name: string): string {
  const issues = new Issues();
  const value = new Params('path', c.params, issues).snowflake(name);
  issues.throwIfAny();
  return value;
}

function pathUuid(c: RouteContext, name: string): string {
  const issues = new Issues();
  const value = new Params('path', c.params, issues).uuid(name);
  issues.throwIfAny();
  return value;
}

const CACHE_MINUTE = {'Cache-Control': 'public, max-age=60'};
const FEED_TTL_MS = 60_000;

export const routes: Route[] = [
  // ---- 6.1 Session -----------------------------------------------------------
  {method: 'GET', path: '/lineup/me', auth: 'session', handler: (c) => ok(toMe(c.env, actorOf(c)))},
  {method: 'GET', path: '/lineup/me/guilds', auth: 'session', handler: (c) => ok(listMyGuilds(c.env, actorOf(c)))},
  {
    method: 'POST',
    path: '/lineup/me/refresh-guilds',
    auth: 'session',
    handler: (c) => ok(refreshMyGuilds(c.env, actorOf(c))),
  },
  {
    method: 'GET',
    path: '/lineup/catalog',
    auth: 'public',
    handler: () => ok(mockCatalog, {'Cache-Control': 'public, max-age=3600'}),
  },

  // ---- 6.2 Servers -----------------------------------------------------------
  {
    method: 'GET',
    path: '/lineup/guilds',
    auth: 'public',
    handler: (c) => ok(listDirectory(c.env, c.query), CACHE_MINUTE),
  },
  {
    method: 'POST',
    path: '/lineup/guilds/claim',
    auth: 'session',
    handler: (c) => created(claimGuild(c.env, actorOf(c), parseBody(c.rawBody, claimBody, {required: true}))),
  },
  {
    method: 'GET',
    path: '/lineup/guilds/:guild_id',
    auth: 'optional',
    handler: (c) => ok(getGuildProfile(c.env, c.viewer, pathSnowflake(c, 'guild_id'))),
  },
  {
    method: 'PUT',
    path: '/lineup/guilds/:guild_id',
    auth: 'session',
    validateFirst: (c) => {
      pathSnowflake(c, 'guild_id');
      parseBody(c.rawBody, guildUpdateBody);
    },
    handler: (c) => {
      const guildId = pathSnowflake(c, 'guild_id');
      return ok(updateGuild(c.env, actorOf(c), guildId, parseBody(c.rawBody, guildUpdateBody)));
    },
  },
  {
    method: 'DELETE',
    path: '/lineup/guilds/:guild_id',
    auth: 'session',
    handler: (c) => {
      deleteGuild(c.env, actorOf(c), pathSnowflake(c, 'guild_id'));
      return noContent();
    },
  },
  {
    method: 'POST',
    path: '/lineup/guilds/:guild_id/refresh',
    auth: 'session',
    handler: (c) => ok(refreshGuild(c.env, actorOf(c), pathSnowflake(c, 'guild_id'))),
  },

  // ---- 6.3 People ------------------------------------------------------------
  {
    method: 'GET',
    path: '/lineup/users/:user_id',
    auth: 'optional',
    handler: (c) => ok(getUserProfile(c.env, c.viewer, pathSnowflake(c, 'user_id'))),
  },
  {
    method: 'GET',
    path: '/lineup/me/profile',
    auth: 'session',
    handler: (c) => {
      const actor = actorOf(c);
      return ok(getUserProfile(c.env, {...actor, suspended: false}, actor.id));
    },
  },
  {
    method: 'PUT',
    path: '/lineup/me/profile',
    auth: 'session',
    handler: (c) => ok(updateMyProfile(c.env, actorOf(c), parseBody(c.rawBody, profileUpdateBody))),
  },

  // ---- 6.4 Posts -------------------------------------------------------------
  {
    method: 'GET',
    path: '/lineup/posts',
    auth: 'public',
    handler: (c) => {
      // The real feed is cached in Redis for 60 s per combination of filters + cursor: a post published or
      // closed may linger a minute. Off by default in the mock (dev panel), because it is confusing to debug.
      if (!c.server.feedCache()) return ok(listFeed(c.env, c.query), CACHE_MINUTE);
      const key = [...c.query.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .sort()
        .join('&');
      const hit = c.env.db.rt.feedCache.get(key);
      if (hit && c.env.now.getTime() - hit.at < FEED_TTL_MS) return ok(hit.body, CACHE_MINUTE);
      const body = listFeed(c.env, c.query);
      c.env.db.rt.feedCache.set(key, {at: c.env.now.getTime(), body});
      return ok(body, CACHE_MINUTE);
    },
  },
  {
    method: 'GET',
    path: '/lineup/me/posts',
    auth: 'session',
    handler: (c) => ok(listMyPosts(c.env, actorOf(c), c.query)),
  },
  {
    method: 'GET',
    path: '/lineup/posts/:post_id',
    auth: 'optional',
    handler: (c) => ok(getPostDetail(c.env, c.viewer, c.params.post_id ?? '')),
  },
  {
    method: 'POST',
    path: '/lineup/posts',
    auth: 'session',
    handler: (c) =>
      created(createPost(c.env, actorOf(c), parseBody(c.rawBody, createPostBody(c.env.now), {required: true}))),
  },
  {
    method: 'PATCH',
    path: '/lineup/posts/:post_id',
    auth: 'session',
    handler: (c) =>
      ok(
        updatePost(
          c.env,
          actorOf(c),
          c.params.post_id ?? '',
          parseBody(c.rawBody, updatePostBody(c.env.now), {required: true}),
        ),
      ),
  },
  {
    method: 'POST',
    path: '/lineup/posts/:post_id/publish',
    auth: 'session',
    handler: (c) => ok(publishPost(c.env, actorOf(c), c.params.post_id ?? '')),
  },
  {
    method: 'POST',
    path: '/lineup/posts/:post_id/close',
    auth: 'session',
    handler: (c) => ok(closePost(c.env, actorOf(c), c.params.post_id ?? '')),
  },
  {
    method: 'DELETE',
    path: '/lineup/posts/:post_id',
    auth: 'session',
    handler: (c) => {
      deletePost(c.env, actorOf(c), c.params.post_id ?? '');
      return noContent();
    },
  },

  // ---- 6.5 Reports -----------------------------------------------------------
  {
    method: 'POST',
    path: '/lineup/reports',
    auth: 'session',
    handler: (c) => {
      const result = createReport(c.env, actorOf(c), parseBody(c.rawBody, reportBody, {required: true}));
      return {status: result.status, body: result.body};
    },
  },

  // ---- 6.6 Experiences -------------------------------------------------------
  {
    method: 'GET',
    path: '/lineup/me/experiences',
    auth: 'session',
    handler: (c) => ok(listMyExperiences(c.env, actorOf(c))),
  },
  {
    method: 'POST',
    path: '/lineup/me/experiences',
    auth: 'session',
    handler: (c) =>
      created(
        createExperience(
          c.env,
          actorOf(c),
          parseBody(c.rawBody, createExperienceBody(calendarDate(c.env.now)), {required: true}),
        ),
      ),
  },
  {
    method: 'PUT',
    path: '/lineup/me/experiences/order',
    auth: 'session',
    handler: (c) => ok(reorderExperiences(c.env, actorOf(c), parseBody(c.rawBody, orderBody, {required: true}).ids)),
  },
  {
    method: 'PATCH',
    path: '/lineup/me/experiences/:exp_id',
    auth: 'session',
    handler: (c) => {
      const id = pathUuid(c, 'exp_id');
      return ok(updateExperience(c.env, actorOf(c), id, parseBody(c.rawBody, updateExperienceBody, {required: true})));
    },
  },
  {
    method: 'DELETE',
    path: '/lineup/me/experiences/:exp_id',
    auth: 'session',
    handler: (c) => {
      deleteExperience(c.env, actorOf(c), pathUuid(c, 'exp_id'));
      return noContent();
    },
  },
  {
    method: 'POST',
    path: '/lineup/me/experiences/:exp_id/verify',
    auth: 'session',
    handler: (c) => ok(verifyExperience(c.env, actorOf(c), pathUuid(c, 'exp_id'))),
  },
  {
    method: 'POST',
    path: '/lineup/me/experiences/:exp_id/request-review',
    auth: 'session',
    handler: (c) => {
      const id = pathUuid(c, 'exp_id');
      const body = parseBody(c.rawBody, noteBody(500));
      return ok(requestReview(c.env, actorOf(c), id, body.note));
    },
  },

  // ---- 6.7 Staff -------------------------------------------------------------
  {
    method: 'GET',
    path: '/lineup/staff/experiences',
    auth: 'staff',
    handler: (c) => ok(listStaffExperiences(c.env, c.query)),
  },
  {
    method: 'POST',
    path: '/lineup/staff/experiences/:exp_id/verify',
    auth: 'staff',
    handler: (c) => {
      const id = pathUuid(c, 'exp_id');
      const body = parseBody(c.rawBody, noteBody(500));
      return ok(staffVerifyExperience(c.env, actorOf(c), id, body.note));
    },
  },
  {
    method: 'POST',
    path: '/lineup/staff/experiences/:exp_id/reject',
    auth: 'staff',
    handler: (c) => {
      const id = pathUuid(c, 'exp_id');
      const body = parseBody(c.rawBody, reasonBody, {required: true});
      return ok(staffRejectExperience(c.env, actorOf(c), id, body.reason));
    },
  },
  {method: 'GET', path: '/lineup/staff/badges', auth: 'staff', handler: (c) => ok(listBadgeGrants(c.env, c.query))},
  {
    method: 'PUT',
    path: '/lineup/staff/badges/:entity_type/:entity_id/:badge',
    auth: 'staff',
    handler: (c) => {
      const entityId = pathSnowflake(c, 'entity_id');
      const body = parseBody(c.rawBody, noteBody(200));
      return ok(grantBadge(c.env, actorOf(c), c.params.entity_type ?? '', entityId, c.params.badge ?? '', body.note));
    },
  },
  {
    method: 'DELETE',
    path: '/lineup/staff/badges/:entity_type/:entity_id/:badge',
    auth: 'staff',
    handler: (c) => {
      const entityId = pathSnowflake(c, 'entity_id');
      revokeBadge(c.env, (c.params.entity_type ?? '') as BadgeEntityType, entityId, c.params.badge ?? '');
      return noContent();
    },
  },
  {
    method: 'POST',
    path: '/lineup/staff/posts/:post_id/hide',
    auth: 'staff',
    handler: (c) => {
      const id = pathUuid(c, 'post_id');
      return ok(hidePost(c.env, id, parseBody(c.rawBody, reasonBody, {required: true}).reason));
    },
  },
  {
    method: 'POST',
    path: '/lineup/staff/posts/:post_id/unhide',
    auth: 'staff',
    handler: (c) => ok(unhidePost(c.env, pathUuid(c, 'post_id'))),
  },
  {method: 'GET', path: '/lineup/staff/reports', auth: 'staff', handler: (c) => ok(listStaffReports(c.env, c.query))},
  {
    method: 'POST',
    path: '/lineup/staff/reports/:report_id/resolve',
    auth: 'staff',
    handler: (c) => ok(resolveReport(c.env, actorOf(c), pathUuid(c, 'report_id'))),
  },
  {
    method: 'POST',
    path: '/lineup/staff/reports/:report_id/dismiss',
    auth: 'staff',
    handler: (c) => ok(dismissReport(c.env, actorOf(c), pathUuid(c, 'report_id'))),
  },

  // ---- The dashboard's account and sign-out (same cookie) ---------------------
  {method: 'GET', path: '/auth/me', auth: 'any_session', handler: (c) => ok(toAccount(actorOf(c)))},
  {
    method: 'POST',
    path: '/auth/logout',
    auth: 'any_session',
    handler: (c) => {
      c.server.logout();
      // 200 with an EMPTY body (not JSON, no content-type).
      return {status: 200};
    },
  },
];
