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
  /** Legacy: the directory is gone, the route only redirects to the feed. */
  guilds: '/guilds',
  guildClaim: '/guilds/claim',
  myGuilds: '/me/guilds',
  guild: '/guilds/:guildId',
  guildManage: '/guilds/:guildId/manage',
  guildManageInvite: '/guilds/:guildId/manage/invite',
  guildManagePosts: '/guilds/:guildId/manage/posts',
  guildManageDiscord: '/guilds/:guildId/manage/discord',
  guildManageSettings: '/guilds/:guildId/manage/settings',
  bots: '/bots',
  bot: '/bots/:botId',
  botManage: '/bots/:botId/manage',
  botManagePosts: '/bots/:botId/manage/posts',
  botManageDiscord: '/bots/:botId/manage/discord',
  botManageSettings: '/bots/:botId/manage/settings',
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

export interface PostNewOptions {
  kind?: 'user' | 'guild';
  guildId?: string;
  /** A post for that bot (`?bot=`): it fixes the author and opens the editor in the bot's context. */
  botId?: string;
}

export const paths = {
  home: () => '/',
  feed: () => '/',
  people: () => '/people',
  /**
   * The editor. `{kind}` presets the type (`user`: a personal post), `{guildId}` a post for that server
   * (it fixes the author and opens the editor in the server's context). A bare kind is still accepted.
   */
  postNew: (options?: PostNewOptions | 'user' | 'guild') => {
    const {kind, guildId, botId} =
      typeof options === 'string' ? {kind: options, guildId: undefined, botId: undefined} : (options ?? {});
    const query = [kind && `kind=${kind}`, guildId && `guild=${id(guildId)}`, botId && `bot=${id(botId)}`]
      .filter(Boolean)
      .join('&');
    return query ? `/posts/new?${query}` : '/posts/new';
  },
  post: (postId: string) => `/posts/${id(postId)}`,
  postEdit: (postId: string) => `/posts/${id(postId)}/edit`,
  myPosts: () => '/me/posts',
  /** The "Add a server" dialog, over the dashboard (`?servers=add`). `/guilds/claim` redirects here. */
  guildClaim: () => '/me?servers=add',
  /** The "Manage servers" dialog, over the dashboard (`?servers=manage`). `/me/guilds` redirects here. */
  myGuilds: () => '/me?servers=manage',
  guild: (guildId: string) => `/guilds/${id(guildId)}`,
  guildManage: (guildId: string) => `/guilds/${id(guildId)}/manage`,
  guildManageInvite: (guildId: string) => `/guilds/${id(guildId)}/manage/invite`,
  guildManagePosts: (guildId: string) => `/guilds/${id(guildId)}/manage/posts`,
  guildManageDiscord: (guildId: string) => `/guilds/${id(guildId)}/manage/discord`,
  guildManageSettings: (guildId: string) => `/guilds/${id(guildId)}/manage/settings`,
  /** The bot directory. */
  bots: () => '/bots',
  bot: (botId: string) => `/bots/${id(botId)}`,
  botManage: (botId: string) => `/bots/${id(botId)}/manage`,
  botManagePosts: (botId: string) => `/bots/${id(botId)}/manage/posts`,
  botManageDiscord: (botId: string) => `/bots/${id(botId)}/manage/discord`,
  botManageSettings: (botId: string) => `/bots/${id(botId)}/manage/settings`,
  /** The "Add a bot" dialog, over the dashboard (`?servers=add-bot`). */
  botClaim: () => '/me?servers=add-bot',
  /** The "Manage bots" dialog, over the dashboard (`?servers=manage-bots`). */
  myBots: () => '/me?servers=manage-bots',
  user: (userId: string) => `/users/${id(userId)}`,
  me: () => '/me',
  myExperiences: () => '/me/experiences',
  staff: () => '/staff',
  staffReviews: () => '/staff/reviews',
  staffReports: () => '/staff/reports',
  staffBadges: () => '/staff/badges',
  staffPosts: () => '/staff/posts',
} as const;
