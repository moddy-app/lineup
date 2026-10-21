/** Discord snowflake helpers. Ids are strings everywhere: never go through Number. */

const DISCORD_EPOCH = 1420070400000n;

/** The default avatar of a user without a picture: one of six, by id. */
export function defaultAvatarUrl(userId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(userId) >> 22n) % 6n)}.png`;
}

/** When a snowflake was created (an account, a server). */
export function snowflakeDate(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}
