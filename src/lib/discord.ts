/** Discord snowflake helpers. Ids are strings everywhere: never go through Number. */

const DISCORD_EPOCH = 1420070400000n;

/**
 * The picture of an avatar decoration from `me.user.avatar_decoration_data`
 * (`{asset, sku_id, expires_at}`: the API sends no URL here, unlike the
 * summaries). A `url` string, when present (the mock), wins.
 */
export function avatarDecorationFromData(data: Record<string, unknown> | null | undefined): {url: string} | null {
  if (!data) return null;
  if (typeof data.url === 'string') return {url: data.url};
  if (typeof data.asset !== 'string' || !/^[\w-]+$/.test(data.asset)) return null;
  return {url: `https://cdn.discordapp.com/avatar-decoration-presets/${data.asset}.png`};
}

/** The default avatar of a user without a picture: one of six, by id. */
export function defaultAvatarUrl(userId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(userId) >> 22n) % 6n)}.png`;
}

/** When a snowflake was created (an account, a server). */
export function snowflakeDate(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}
