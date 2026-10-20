/**
 * The mock's "Discord": invitation resolution (LINEUP.md §3), and the failure
 * mode the dev panel can switch on. In the real backend these are HTTP calls
 * that can fail; a failure is never a "no" (§0 `503 discord_unavailable`).
 */

import {discordUnavailable, lineupError, notFound, unprocessable} from '../errors';
import type {Env} from '../env';
import type {DiscordGuild, Invite} from '../model';

/** Throws 503 `discord_unavailable` (with `Retry-After: 30`) when Discord is switched off. */
export function requireDiscord(env: Env): void {
  if (env.discordDown) throw discordUnavailable();
}

const CODE = /^[A-Za-z0-9-]{2,32}$/;
const INVITE_HOSTS: Record<string, 'bare' | 'invite-path'> = {
  'discord.gg': 'bare',
  'discord.com': 'invite-path',
  'discordapp.com': 'invite-path',
};

export const inviteInvalid = (message = "Ce n'est pas un lien d'invitation de serveur Discord.") =>
  unprocessable('invite_invalid', message);

/**
 * The code in what the person pasted: a bare code, or an https link on
 * discord.gg / discord.com/invite / discordapp.com/invite (HTTPS is required
 * for links). Anything else is `invite_invalid`.
 */
export function parseInviteCode(input: string): string {
  const text = input.trim();
  if (CODE.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw inviteInvalid();
  }
  const style = INVITE_HOSTS[url.hostname.toLowerCase()];
  if (url.protocol !== 'https:' || !style || url.username || url.password) throw inviteInvalid();
  const segments = url.pathname.split('/').filter(Boolean);
  const code = style === 'bare' ? segments[0] : segments[0] === 'invite' ? segments[1] : undefined;
  const extra = style === 'bare' ? segments.length > 1 : segments.length > 2;
  if (!code || extra || !CODE.test(code)) throw inviteInvalid();
  return code;
}

export interface ResolvedInvite {
  invite: Invite;
  guild: DiscordGuild;
}

/** An invitation that leads somewhere, found by its code or as a server's vanity URL. */
function lookup(env: Env, code: string): Invite | null {
  const key = code.toLowerCase();
  const stored = env.db.invites[key];
  if (stored) return stored;
  const vanity = Object.values(env.db.guilds).find((guild) => guild.vanity_url_code?.toLowerCase() === key);
  // A vanity URL never expires (§3: "une vanity URL convient").
  return vanity ? {code: vanity.vanity_url_code ?? code, kind: 'guild', guild_id: vanity.id, expires_at: null} : null;
}

/**
 * Resolves an invitation at Discord, in the documented order of checks:
 * malformed → (Discord down: 503) → unknown/expired (404) → not a server (422
 * `invite_invalid`) → has an expiry date (422 `invite_expiring`). Only an
 * invitation that never expires is accepted.
 */
export function resolveInvite(env: Env, input: string): ResolvedInvite {
  const code = parseInviteCode(input);
  requireDiscord(env);
  const invite = lookup(env, code);
  if (!invite || (invite.expires_at !== null && Date.parse(invite.expires_at) <= env.now.getTime())) {
    throw notFound('invite_not_found');
  }
  const guild = invite.kind === 'guild' && invite.guild_id ? env.db.guilds[invite.guild_id] : undefined;
  if (!guild) throw inviteInvalid();
  if (invite.expires_at !== null) {
    throw lineupError(
      422,
      'invite_expiring',
      "Cette invitation expire. Créez une invitation qui n'expire jamais.",
    );
  }
  return {invite, guild};
}
