/**
 * Every URL of the app, in one place. Patterns (`routePatterns`) are what the
 * router matches; builders (`paths`) are what links use. Never write a path
 * by hand elsewhere. Ids are strings (Discord snowflakes overflow Number)
 * and are encoded.
 */

export const routePatterns = {
  feed: '/',
  people: '/people',
  postNew: '/posts/new',
  post: '/posts/:postId',
  postEdit: '/posts/:postId/edit',
  myPosts: '/me/posts',
  guilds: '/guilds',
  guildClaim: '/guilds/claim',
  myGuilds: '/me/guilds',
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
  people: () => '/people',
  postNew: (kind?: 'user' | 'guild') => (kind ? `/posts/new?kind=${kind}` : '/posts/new'),
  post: (postId: string) => `/posts/${id(postId)}`,
  postEdit: (postId: string) => `/posts/${id(postId)}/edit`,
  myPosts: () => '/me/posts',
  guilds: () => '/guilds',
  /** The old claim address, kept for existing links: it leads to `myGuilds`. */
  guildClaim: () => '/me/guilds',
  myGuilds: () => '/me/guilds',
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
