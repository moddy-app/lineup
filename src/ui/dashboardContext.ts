/**
 * Whose dashboard the management navigation shows: the person's own ("me") or
 * a server's. Deduced from the address; a page whose address does not say it
 * (the editor on `/posts/:id/edit`) passes the context to `SettingsLayout`.
 */
export type DashboardContext = {kind: 'me'} | {kind: 'guild'; guildId: string} | {kind: 'bot'; botId: string};

export const ME_CONTEXT: DashboardContext = {kind: 'me'};

const decode = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * `/guilds/:id/manage` and below: that server. `/bots/:id/manage` and below:
 * that bot. `/posts/new?guild=<id>` (or `?bot=<id>`): that server (or bot).
 * Anything else: the person.
 */
export function dashboardContext(pathname: string, search = ''): DashboardContext {
  const manage = /^\/guilds\/([^/]+)\/manage(?:\/|$)/.exec(pathname);
  if (manage) {
    const guildId = decode(manage[1]!);
    if (guildId) return {kind: 'guild', guildId};
  }
  const bot = /^\/bots\/([^/]+)\/manage(?:\/|$)/.exec(pathname);
  if (bot) {
    const botId = decode(bot[1]!);
    if (botId) return {kind: 'bot', botId};
  }
  if (/^\/posts\/new\/?$/.test(pathname)) {
    const query = new URLSearchParams(search);
    const guildId = query.get('guild');
    if (guildId) return {kind: 'guild', guildId};
    const botId = query.get('bot');
    if (botId) return {kind: 'bot', botId};
  }
  return ME_CONTEXT;
}

export const sameContext = (a: DashboardContext, b: DashboardContext): boolean => {
  if (a.kind === 'guild') return b.kind === 'guild' && a.guildId === b.guildId;
  if (a.kind === 'bot') return b.kind === 'bot' && a.botId === b.botId;
  return b.kind === 'me';
};
