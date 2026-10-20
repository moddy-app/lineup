/**
 * Every URL of the app, in one place. Patterns (`routePatterns`) are what the
 * router matches; builders (`paths`) are what links use. Never write a path
 * by hand elsewhere. Ids are strings (Discord snowflakes overflow Number)
 * and are encoded.
 */

export const routePatterns = {
  feed: '/',
  postNew: '/posts/new',
  post: '/posts/:postId',
  postEdit: '/posts/:postId/edit',
  myPosts: '/me/posts',
  guilds: '/guilds',
  guildClaim: '/guilds/claim',
  guild: '/guilds/:guildId',
  guildManage: '/guilds/:guildId/manage',
  user: '/users/:userId',
  me: '/me',
  myExperiences: '/me/experiences',
  staff: '/staff',
  staffReviews: '/staff/reviews',
  staffReports: '/staff/reports',
  staffBadges: '/staff/badges',
  staffPosts: '/staff/posts',
} as const;

const id = encodeURIComponent;

export const paths = {
  home: () => '/',
  feed: () => '/',
  postNew: () => '/posts/new',
  post: (postId: string) => `/posts/${id(postId)}`,
  postEdit: (postId: string) => `/posts/${id(postId)}/edit`,
  myPosts: () => '/me/posts',
  guilds: () => '/guilds',
  guildClaim: () => '/guilds/claim',
  guild: (guildId: string) => `/guilds/${id(guildId)}`,
  guildManage: (guildId: string) => `/guilds/${id(guildId)}/manage`,
  user: (userId: string) => `/users/${id(userId)}`,
  me: () => '/me',
  myExperiences: () => '/me/experiences',
  staff: () => '/staff',
  staffReviews: () => '/staff/reviews',
  staffReports: () => '/staff/reports',
  staffBadges: () => '/staff/badges',
  staffPosts: () => '/staff/posts',
} as const;
