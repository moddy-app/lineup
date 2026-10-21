/**
 * Servers (LINEUP.md §3, §6.2): the directory, a profile, claiming by
 * invitation, editing, deleting, refreshing, and "my servers".
 */

import type {GuildCard, GuildProfile, MyGuild, Paginated, RefreshGuildsResponse, Snowflake} from '@/api/types';

import {conflict, forbidden, notFound, rateLimited, sanctionError, unprocessable} from '../errors';
import type {Actor, Env, Viewer} from '../env';
import type {DiscordGuild, GuildProfileRow} from '../model';
import {iso} from '../time';
import {canManageGuild, canManageGuildQuietly, manageableGuilds} from './access';
import {compareKeyed, decodeCursor, pageRows} from './cursor';
import {requireDiscord, resolveInvite} from './discord';
import {isTheme} from './schemas';
import {Issues, Params} from './validate';
import {guildCard, toGuildProfile} from './views';
import {isGuildSuspended, isNsfwGuild} from './visibility';

// ---------------------------------------------------------------------------
// Rights
// ---------------------------------------------------------------------------

/**
 * The write-side rights check, in this order: the person manages the server
 * (403 `lineup_guild_forbidden`, or 503 when undecidable), then the server is
 * not suspended (403 `guild_suspended`, a sanction object; the staff pass).
 */
export function requireManager(env: Env, actor: Actor, guildId: Snowflake): void {
  if (!canManageGuild(env, actor, guildId)) throw forbidden('lineup_guild_forbidden');
  const sanction = env.db.guilds[guildId]?.sanction;
  if (sanction && !actor.is_staff) throw sanctionError('guild_suspended', guildId, sanction);
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

/** `GET /lineup/guilds`: listed profiles, newest claim first, suspended ones removed AFTER the read (§6.2). */
export function listDirectory(env: Env, query: URLSearchParams): Paginated<GuildCard> {
  const issues = new Issues();
  const params = new Params('query', query, issues);
  const limit = params.int('limit', {def: 24, ge: 1, le: 50}) ?? 24;
  const includeNsfw = params.bool('include_nsfw');
  const theme = params.string('theme', {max: 30});
  const q = params.string('q', {max: 100});
  const cursor = params.get('cursor');
  issues.throwIfAny();

  if (theme !== undefined && !isTheme(theme)) throw unprocessable('theme_invalid', 'Thème inconnu.');
  const after = decodeCursor(cursor, (id) => /^\d{1,19}$/.test(id));

  const needle = q?.trim().toLowerCase();
  const rows = Object.values(env.db.profiles)
    .filter((profile) => profile.listed)
    .filter((profile) => includeNsfw || !isNsfwGuild(env, profile.guild_id))
    .filter((profile) => theme === undefined || profile.theme === theme)
    .filter((profile) => {
      if (!needle) return true;
      const guild = env.db.guilds[profile.guild_id];
      return [guild?.name, profile.description, guild?.description].some((text) =>
        text?.toLowerCase().includes(needle),
      );
    })
    .map((profile) => ({at: profile.created_at, id: profile.guild_id, profile}))
    .sort(compareKeyed(true));

  const {rows: page, nextCursor} = pageRows(rows, limit, after, true);
  // §0: suspended and blacklisted servers disappear after the page was read, so a page can come back short or empty.
  const items = page.filter(({id}) => !isGuildSuspended(env, id)).map(({profile}) => guildCard(env, profile));
  return {items, next_cursor: nextCursor};
}

// ---------------------------------------------------------------------------
// A profile
// ---------------------------------------------------------------------------

/**
 * `GET /lineup/guilds/{id}`. 404 `lineup_guild_not_found` when there is no
 * profile, the server is suspended (staff excepted), or it is unlisted and the
 * reader does not manage it. A NSFW server is NOT blocked (§9).
 */
export function getGuildProfile(env: Env, viewer: Viewer | null, guildId: Snowflake): GuildProfile {
  const profile = env.db.profiles[guildId];
  if (!profile) throw notFound('lineup_guild_not_found');
  const actor = viewer && !viewer.suspended ? viewer : null;
  if (!actor?.is_staff && isGuildSuspended(env, guildId)) throw notFound('lineup_guild_not_found');
  if (!profile.listed && !canManageGuildQuietly(env, actor, guildId)) throw notFound('lineup_guild_not_found');
  return toGuildProfile(env, profile, actor, viewer?.suspended);
}

// ---------------------------------------------------------------------------
// Claim, update, delete, refresh
// ---------------------------------------------------------------------------

/**
 * The permanent invitation Moddy creates itself on a server where it is
 * present (or the one it created earlier).
 */
function moddyInvite(env: Env, guild: DiscordGuild): string {
  const code = `moddy-${guild.id.slice(-8)}`;
  if (!env.db.invites[code]) {
    env.db.invites[code] = {code, kind: 'guild', guild_id: guild.id, expires_at: null};
  }
  return code;
}

export const inviteRequired = () =>
  unprocessable('invite_required', 'Moddy n’est pas sur ce serveur : une invitation est nécessaire.');

/**
 * `POST /lineup/guilds/claim`, with `invite`, `guild_id` or both.
 *
 * With an invitation, the documented order: resolve the invitation → (two
 * servers: 422 `invite_guild_mismatch`) → the person's rights → already
 * claimed. With `guild_id` alone: rights → already claimed → Moddy must be on
 * the server (422 `invite_required`), which then creates the permanent
 * invitation itself. (The server's suspension is checked with the rights,
 * before the duplicate.)
 */
export function claimGuild(env: Env, actor: Actor, body: {invite?: string; guild_id?: Snowflake}): GuildProfile {
  let guild: DiscordGuild;
  let inviteCode: string | null;
  if (body.invite !== undefined) {
    const resolved = resolveInvite(env, body.invite);
    if (body.guild_id !== undefined && body.guild_id !== resolved.guild.id) {
      throw unprocessable('invite_guild_mismatch', 'Cette invitation mène à un autre serveur.');
    }
    guild = resolved.guild;
    inviteCode = resolved.invite.code;
    requireManager(env, actor, guild.id);
  } else {
    const guildId = body.guild_id ?? '';
    requireManager(env, actor, guildId);
    const known = env.db.guilds[guildId];
    if (!known) throw forbidden('lineup_guild_forbidden');
    guild = known;
    inviteCode = null;
  }
  if (env.db.profiles[guild.id]) {
    throw conflict('lineup_guild_already_claimed', 'Ce serveur est déjà sur Lineup.', {guild_id: guild.id});
  }
  if (inviteCode === null) {
    requireDiscord(env);
    if (!guild.has_moddy) throw inviteRequired();
    inviteCode = moddyInvite(env, guild);
  }
  const now = iso(env.now);
  const profile: GuildProfileRow = {
    guild_id: guild.id,
    invite_code: inviteCode,
    description: null,
    links: [],
    theme: null,
    tags: [],
    languages: [],
    snapshot_at: now,
    has_moddy: guild.has_moddy,
    claimed_by: actor.id,
    listed: true,
    invite_invalid: false,
    refresh_blocked: false,
    created_at: now,
    updated_at: now,
  };
  env.db.profiles[guild.id] = profile;
  return toGuildProfile(env, profile, actor);
}

export interface GuildUpdate {
  description?: string | null;
  links?: Array<{label: string; url: string}>;
  theme?: string | null;
  tags?: string[];
  languages?: string[];
  invite?: string | null;
  listed?: boolean;
}

/** `PUT /lineup/guilds/{id}`: only the fields sent change. */
export function updateGuild(env: Env, actor: Actor, guildId: Snowflake, body: GuildUpdate): GuildProfile {
  requireManager(env, actor, guildId);
  const profile = env.db.profiles[guildId];
  if (!profile) throw notFound('lineup_guild_not_found');

  // A new invitation must be permanent and lead to THIS server. `invite: null` asks Moddy to generate one:
  // only when it is on the server (422 `invite_required` otherwise).
  let inviteCode: string | undefined;
  if (body.invite === null) {
    const guild = env.db.guilds[guildId];
    requireDiscord(env);
    if (!guild?.has_moddy) throw inviteRequired();
    inviteCode = moddyInvite(env, guild);
  } else if (typeof body.invite === 'string') {
    const resolved = resolveInvite(env, body.invite);
    if (resolved.guild.id !== guildId) {
      throw unprocessable('invite_guild_mismatch', 'Cette invitation mène à un autre serveur.');
    }
    inviteCode = resolved.invite.code;
  }
  if (body.description !== undefined)
    profile.description = body.description && body.description !== '' ? body.description : null;
  if (body.links !== undefined) profile.links = body.links;
  if (body.theme !== undefined) profile.theme = body.theme;
  if (body.tags !== undefined) profile.tags = body.tags;
  if (body.languages !== undefined) profile.languages = body.languages;
  if (body.listed !== undefined) profile.listed = body.listed;
  if (inviteCode !== undefined) {
    profile.invite_code = inviteCode;
    profile.invite_invalid = false;
  }
  profile.updated_at = iso(env.now);
  return toGuildProfile(env, profile, actor);
}

/**
 * `DELETE /lineup/guilds/{id}`: removes the profile and CLOSES its `draft` and
 * `published` posts (`hidden` ones stay hidden). Idempotent: 204 even with no
 * profile, but the rights are checked either way.
 */
export function deleteGuild(env: Env, actor: Actor, guildId: Snowflake): void {
  requireManager(env, actor, guildId);
  delete env.db.profiles[guildId];
  for (const post of Object.values(env.db.posts)) {
    if (post.guild_id === guildId && (post.status === 'draft' || post.status === 'published')) {
      post.status = 'closed';
      post.updated_at = iso(env.now);
    }
  }
}

const REFRESH_WINDOW_MS = 60_000;

/**
 * `POST /lineup/guilds/{id}/refresh`: rights, then the profile, THEN the
 * one-per-minute limit (§6.2: "le contrôle des droits passe avant la limite").
 * When Discord does not answer the snapshot stays and the profile is returned
 * with `stale: true`.
 */
export function refreshGuild(env: Env, actor: Actor, guildId: Snowflake): GuildProfile {
  requireManager(env, actor, guildId);
  const profile = env.db.profiles[guildId];
  if (!profile) throw notFound('lineup_guild_not_found');
  const hit = env.db.rt.limiter.hit(`guild_refresh:${guildId}`, 1, REFRESH_WINDOW_MS, env.now.getTime());
  if (!hit.allowed) throw rateLimited(hit.retryAfter, 'Ce serveur a déjà été rafraîchi à l’instant.');

  const view = (stale: boolean): GuildProfile => ({...toGuildProfile(env, profile, actor), stale});
  const guild = env.db.guilds[guildId];
  if (env.discordDown || profile.refresh_blocked || !guild) return view(true);

  profile.snapshot_at = iso(env.now);
  profile.has_moddy = guild.has_moddy;
  // The invitation still has to exist at Discord for `invite.valid` to hold.
  const code = profile.invite_code?.toLowerCase();
  const invite = code ? env.db.invites[code] : undefined;
  profile.invite_invalid =
    code !== undefined && !(invite && invite.guild_id === guildId) && guild.vanity_url_code?.toLowerCase() !== code;
  return view(false);
}

// ---------------------------------------------------------------------------
// My servers
// ---------------------------------------------------------------------------

function toMyGuild(env: Env, guildId: Snowflake): MyGuild {
  const guild = env.db.guilds[guildId];
  return {
    id: guildId,
    name: guild?.name ?? null,
    icon_url: guild?.icon_url ?? null,
    has_moddy: guild?.has_moddy ?? false,
    claimed: Boolean(env.db.profiles[guildId]),
    listed: env.db.profiles[guildId]?.listed ?? false,
  };
}

const byName = (a: MyGuild, b: MyGuild) => (a.name ?? '').localeCompare(b.name ?? '', 'fr', {sensitivity: 'base'});

/** `GET /lineup/me/guilds`: servers the person can manage, sorted by name. */
export function listMyGuilds(env: Env, actor: Actor): MyGuild[] {
  return manageableGuilds(env, actor)
    .guilds.map((id) => toMyGuild(env, id))
    .sort(byName);
}

/** `POST /lineup/me/refresh-guilds`: skips the cache; `stale: true` when Discord stayed silent. */
export function refreshMyGuilds(env: Env, actor: Actor): RefreshGuildsResponse {
  const {guilds, stale} = manageableGuilds(env, actor, true);
  return {guilds: guilds.map((id) => toMyGuild(env, id)).sort(byName), stale};
}
