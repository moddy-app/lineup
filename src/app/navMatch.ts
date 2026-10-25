/** Which top-bar destination covers a page. Pure, so the rules are tested (`navMatch.test.ts`). */

const startsWith =
  (...prefixes: string[]) =>
  (pathname: string) =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** The post editor: `/posts/new` and `/posts/:id/edit`. Part of the dashboard, not of Recruiting. */
const isEditor = (pathname: string) => /^\/posts\/(?:new|[^/]+\/edit)\/?$/.test(pathname);

/** `/guilds/:id/manage` and below. */
const isGuildManage = (pathname: string) => /^\/guilds\/[^/]+\/manage(?:\/|$)/.test(pathname);

/** `/bots/:id/manage` and below. */
const isBotManage = (pathname: string) => /^\/bots\/[^/]+\/manage(?:\/|$)/.test(pathname);

/**
 * Recruiting: the feed, a post (but not while writing or editing it), the
 * public profile of a server, the bot directory and a bot's public profile.
 */
export const isRecruiting = (pathname: string) =>
  pathname === '/' ||
  (startsWith('/posts')(pathname) && !isEditor(pathname)) ||
  (startsWith('/guilds')(pathname) && !isGuildManage(pathname)) ||
  (startsWith('/bots')(pathname) && !isBotManage(pathname));

/** Talent: the people who offer their services, and their profiles. */
export const isTalent = startsWith('/people', '/users');

/** The dashboard: `/me` and its pages, the editor, the management of a server or a bot. */
export const isDashboard = (pathname: string) =>
  startsWith('/me')(pathname) || isEditor(pathname) || isGuildManage(pathname) || isBotManage(pathname);

export const isStaffArea = startsWith('/staff');
