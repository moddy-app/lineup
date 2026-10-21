/**
 * Every route of LINEUP.md §6, as one typed function. 41 routes; the app also
 * calls `POST /auth/logout` (a dashboard route, not counted).
 *
 * | #  | Route                                                    | Function                      | File           |
 * |----|----------------------------------------------------------|-------------------------------|----------------|
 * | 1  | GET    /lineup/auth/login (a navigation)                 | loginUrl (URL builder)        | auth.ts        |
 * | 2  | GET    /lineup/me                                        | getMe                         | auth.ts        |
 * | 3  | GET    /lineup/me/guilds                                 | getMyGuilds                   | guilds.ts      |
 * | 4  | POST   /lineup/me/refresh-guilds                         | refreshMyGuilds               | guilds.ts      |
 * | 5  | GET    /lineup/catalog                                   | getCatalog                    | catalog.ts     |
 * | 6  | GET    /lineup/guilds                                    | (unused by the front: the directory page is gone) |
 * | 7  | POST   /lineup/guilds/claim                              | claimGuild                    | guilds.ts      |
 * | 8  | GET    /lineup/guilds/{guild_id}                         | getGuild                      | guilds.ts      |
 * | 9  | PUT    /lineup/guilds/{guild_id}                         | updateGuild                   | guilds.ts      |
 * | 10 | DELETE /lineup/guilds/{guild_id}                         | deleteGuild                   | guilds.ts      |
 * | 11 | POST   /lineup/guilds/{guild_id}/refresh                 | refreshGuild                  | guilds.ts      |
 * | 12 | GET    /lineup/users/{user_id}                           | getUser                       | users.ts       |
 * | 13 | GET    /lineup/me/profile                                | getMyProfile                  | users.ts       |
 * | 14 | PUT    /lineup/me/profile                                | updateMyProfile               | users.ts       |
 * | 15 | GET    /lineup/posts                                     | getFeed                       | posts.ts       |
 * | 16 | GET    /lineup/me/posts                                  | getMyPosts                    | posts.ts       |
 * | 17 | GET    /lineup/posts/{post_id}                           | getPost                       | posts.ts       |
 * | 18 | POST   /lineup/posts                                     | createPost                    | posts.ts       |
 * | 19 | PATCH  /lineup/posts/{post_id}                           | updatePost                    | posts.ts       |
 * | 20 | POST   /lineup/posts/{post_id}/publish                   | publishPost                   | posts.ts       |
 * | 21 | POST   /lineup/posts/{post_id}/close                     | closePost                     | posts.ts       |
 * | 22 | DELETE /lineup/posts/{post_id}                           | deletePost                    | posts.ts       |
 * | 23 | POST   /lineup/reports                                   | createReport                  | reports.ts     |
 * | 24 | GET    /lineup/me/experiences                            | getMyExperiences              | experiences.ts |
 * | 25 | POST   /lineup/me/experiences                            | createExperience              | experiences.ts |
 * | 26 | PATCH  /lineup/me/experiences/{exp_id}                   | updateExperience              | experiences.ts |
 * | 27 | PUT    /lineup/me/experiences/order                      | reorderExperiences            | experiences.ts |
 * | 28 | DELETE /lineup/me/experiences/{exp_id}                   | deleteExperience              | experiences.ts |
 * | 29 | POST   /lineup/me/experiences/{exp_id}/verify            | verifyExperience              | experiences.ts |
 * | 30 | POST   /lineup/me/experiences/{exp_id}/request-review    | requestExperienceReview       | experiences.ts |
 * | 31 | GET    /lineup/staff/experiences                         | getStaffExperiences           | staff.ts       |
 * | 32 | POST   /lineup/staff/experiences/{exp_id}/verify         | staffVerifyExperience         | staff.ts       |
 * | 33 | POST   /lineup/staff/experiences/{exp_id}/reject         | staffRejectExperience         | staff.ts       |
 * | 34 | GET    /lineup/staff/badges                              | getStaffBadges                | staff.ts       |
 * | 35 | PUT    /lineup/staff/badges/{entity_type}/{id}/{badge}   | grantBadge                    | staff.ts       |
 * | 36 | DELETE /lineup/staff/badges/{entity_type}/{id}/{badge}   | revokeBadge                   | staff.ts       |
 * | 37 | POST   /lineup/staff/posts/{post_id}/hide                | hidePost                      | staff.ts       |
 * | 38 | POST   /lineup/staff/posts/{post_id}/unhide              | unhidePost                    | staff.ts       |
 * | 39 | GET    /lineup/staff/reports                             | getStaffReports               | staff.ts       |
 * | 40 | POST   /lineup/staff/reports/{report_id}/resolve         | resolveReport                 | staff.ts       |
 * | 41 | POST   /lineup/staff/reports/{report_id}/dismiss         | dismissReport                 | staff.ts       |
 * | +  | POST   /auth/logout (dashboard route, not under /lineup) | logout                        | auth.ts        |
 *
 * endpoints.test.ts calls each function against a stubbed fetch and checks the
 * method, path, query and body against this table and against LINEUP.md.
 */

export {getMe, loginUrl, LOGIN_PATH, logout, sanitizeRedirect, setLoginUrlBuilder} from './auth';
export type {LoginUrlBuilder} from './auth';
export {getCatalog} from './catalog';
export {
  createExperience,
  deleteExperience,
  getMyExperiences,
  reorderExperiences,
  requestExperienceReview,
  updateExperience,
  verifyExperience,
} from './experiences';
export {claimGuild, deleteGuild, getGuild, getMyGuilds, refreshGuild, refreshMyGuilds, updateGuild} from './guilds';
export {closePost, createPost, deletePost, getFeed, getMyPosts, getPost, publishPost, updatePost} from './posts';
export {createReport} from './reports';
export type {PageOptions, ReadOptions} from './shared';
export {
  dismissReport,
  getStaffBadges,
  getStaffExperiences,
  getStaffReports,
  grantBadge,
  hidePost,
  resolveReport,
  revokeBadge,
  staffRejectExperience,
  staffVerifyExperience,
  unhidePost,
} from './staff';
export {getMyProfile, getUser, updateMyProfile} from './users';
