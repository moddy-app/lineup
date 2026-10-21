/**
 * Whose dashboard the management navigation shows: the person's own ("me") or
 * a server's. Deduced from the address; a page whose address does not say it
 * (the editor on `/posts/:id/edit`) passes the context to `SettingsLayout`.
 */
export type DashboardContext = {kind: 'me'} | {kind: 'guild'; guildId: string};

export const ME_CONTEXT: DashboardContext = {kind: 'me'};

const decode = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * `/guilds/:id/manage` and below: that server. `/posts/new?guild=<id>`: that
 * server. Anything else: the person.
 */
export function dashboardContext(pathname: string, search = ''): DashboardContext {
  const manage = /^\/guilds\/([^/]+)\/manage(?:\/|$)/.exec(pathname);
  if (manage) {
    const guildId = decode(manage[1]!);
    if (guildId) return {kind: 'guild', guildId};
  }
  if (/^\/posts\/new\/?$/.test(pathname)) {
    const guildId = new URLSearchParams(search).get('guild');
    if (guildId) return {kind: 'guild', guildId};
  }
  return ME_CONTEXT;
}

export const sameContext = (a: DashboardContext, b: DashboardContext): boolean =>
  a.kind === b.kind && (a.kind === 'me' || (b.kind === 'guild' && a.guildId === b.guildId));
