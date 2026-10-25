/**
 * Bots (the bot guide): the directory, "my bots", the preview before a claim,
 * claiming, a profile, editing, deleting, refreshing. The App Directory is
 * `db.bots`; a bot's rights follow its support server (owner or ADMINISTRATOR).
 */

import type {BotCard, BotLookup, BotProfile, MyBotsResponse, Paginated, Snowflake} from '@/api/types';

import {ApiFailure, conflict, forbidden, notFound, rateLimited, sanctionError, unprocessable} from '../errors';
import type {Actor, Env, Viewer} from '../env';
import type {BotProfileRow, DiscordBot} from '../model';
import {iso} from '../time';
import {canManageBot, canManageBotQuietly, discordGuildList} from './access';
import {compareKeyed, decodeCursor, pageRows} from './cursor';
import {requireDiscord} from './discord';
import {isTheme} from './schemas';
import {Issues, Params} from './validate';
import {botCard, toBotProfile} from './views';
import {botSupportGuildId, isBotSuspended, isNsfwBot} from './visibility';

const LOOKUP_LIMIT = 20;
const LOOKUP_WINDOW_MS = 60_000;
const REFRESH_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// The App Directory
// ---------------------------------------------------------------------------

/**
 * The application at the App Directory, in the documented order: Discord
 * silent (503) → unknown (404 `bot_not_found`) → not discoverable (422) → no
 * support server (422). Experiences use it too.
 */
export function resolveBot(env: Env, botId: Snowflake): DiscordBot & {support_guild_id: Snowflake} {
  requireDiscord(env);
  const bot = env.db.bots[botId];
  if (!bot) throw notFound('bot_not_found');
  if (!bot.discoverable) {
    throw unprocessable('bot_not_discoverable', "Ce bot n'est pas découvrable sur l'App Directory.");
  }
  if (!bot.support_guild_id) {
    throw unprocessable('bot_support_guild_missing', 'Ce bot ne déclare pas de serveur support.');
  }
  return bot as DiscordBot & {support_guild_id: Snowflake};
}

/** The write-side rights: manager of the support server (403 / 503), then the server is not suspended (403 sanction). */
function requireBotManager(env: Env, actor: Actor, botId: Snowflake): void {
  const supportId = botSupportGuildId(env, botId);
  if (!canManageBot(env, actor, supportId)) throw forbidden('lineup_bot_forbidden');
  const sanction = supportId ? env.db.guilds[supportId]?.sanction : undefined;
  if (sanction && supportId && !actor.is_staff) throw sanctionError('guild_suspended', supportId, sanction);
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

/** `GET /lineup/bots`: listed profiles, newest claim first; suspended support servers removed AFTER the read. */
export function listBots(env: Env, query: URLSearchParams): Paginated<BotCard> {
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
  const rows = Object.values(env.db.botProfiles)
    .filter((profile) => profile.listed)
    .filter((profile) => includeNsfw || !isNsfwBot(env, profile.bot_id))
    .filter((profile) => theme === undefined || profile.theme === theme)
    .filter((profile) => {
      if (!needle) return true;
      const bot = env.db.bots[profile.bot_id];
      return [bot?.name, bot?.description, profile.description].some((text) => text?.toLowerCase().includes(needle));
    })
    .map((profile) => ({at: profile.created_at, id: profile.bot_id, profile}))
    .sort(compareKeyed(true));

  const {rows: page, nextCursor} = pageRows(rows, limit, after, true);
  const items = page.filter(({id}) => !isBotSuspended(env, id)).map(({profile}) => botCard(env, profile));
  return {items, next_cursor: nextCursor};
}

/** `GET /lineup/me/bots`: listed or not, whose support server the person owns or administers. */
export function listMyBots(env: Env, actor: Actor): MyBotsResponse {
  let list;
  try {
    list = discordGuildList(env, actor.id);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 503) return {items: [], stale: true};
    throw error;
  }
  const administered = new Set(
    list.guilds.filter((guild) => guild.owner || guild.permissions.includes('ADMINISTRATOR')).map((guild) => guild.id),
  );
  const items = Object.values(env.db.botProfiles)
    .filter((profile) => {
      const supportId = botSupportGuildId(env, profile.bot_id);
      return supportId !== null && administered.has(supportId);
    })
    .map((profile) => botCard(env, profile))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  return {items, stale: false};
}

// ---------------------------------------------------------------------------
// Lookup and claim
// ---------------------------------------------------------------------------

/** `GET /lineup/bots/lookup/{id}`: 20 per minute per person, then the App Directory. */
export function lookupBot(env: Env, actor: Actor, botId: Snowflake): BotLookup {
  const hit = env.db.rt.limiter.hit(`bot_lookup:${actor.id}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS, env.now.getTime());
  if (!hit.allowed) throw rateLimited(hit.retryAfter, 'Trop de recherches de bots. Réessayez dans un instant.');
  const bot = resolveBot(env, botId);
  const guild = env.db.guilds[bot.support_guild_id];
  const claimed = Boolean(env.db.botProfiles[botId]);
  const canClaim = !claimed && canManageBot(env, actor, bot.support_guild_id);
  return {
    id: bot.id,
    name: bot.name,
    avatar_url: bot.avatar_url,
    description: bot.description,
    guild_count: bot.guild_count,
    is_verified: bot.is_verified,
    support_guild: {
      id: bot.support_guild_id,
      name: guild?.name ?? null,
      icon_url: guild?.icon_url ?? null,
      member_count: guild?.member_count ?? null,
    },
    claimed,
    can_claim: canClaim,
  };
}

/** `POST /lineup/bots/claim`: the App Directory, the rights, the suspension, the duplicate. */
export function claimBot(env: Env, actor: Actor, botId: Snowflake): BotProfile {
  const bot = resolveBot(env, botId);
  if (!canManageBot(env, actor, bot.support_guild_id)) throw forbidden('lineup_bot_forbidden');
  const sanction = env.db.guilds[bot.support_guild_id]?.sanction;
  if (sanction && !actor.is_staff) throw sanctionError('guild_suspended', bot.support_guild_id, sanction);
  if (env.db.botProfiles[botId]) {
    throw conflict('lineup_bot_already_claimed', 'Ce bot a déjà un profil Lineup.', {bot_id: botId});
  }
  const now = iso(env.now);
  const profile: BotProfileRow = {
    bot_id: botId,
    description: null,
    links: [],
    theme: null,
    tags: [],
    languages: [],
    listed: true,
    claimed_by: actor.id,
    support_guild_id: bot.support_guild_id,
    snapshot_at: now,
    refresh_blocked: false,
    created_at: now,
    updated_at: now,
  };
  env.db.botProfiles[botId] = profile;
  return toBotProfile(env, profile, actor);
}

// ---------------------------------------------------------------------------
// A profile
// ---------------------------------------------------------------------------

/** `GET /lineup/bots/{id}`: 404 without a profile, when unlisted and not managed, or when the support server is suspended. */
export function getBotProfile(env: Env, viewer: Viewer | null, botId: Snowflake): BotProfile {
  const profile = env.db.botProfiles[botId];
  if (!profile) throw notFound('lineup_bot_not_found');
  const actor = viewer && !viewer.suspended ? viewer : null;
  if (!actor?.is_staff && isBotSuspended(env, botId)) throw notFound('lineup_bot_not_found');
  if (!profile.listed && !canManageBotQuietly(env, actor, botSupportGuildId(env, botId))) {
    throw notFound('lineup_bot_not_found');
  }
  return toBotProfile(env, profile, actor, viewer?.suspended);
}

export interface BotUpdate {
  description?: string | null;
  links?: Array<{label: string; url: string}>;
  theme?: string | null;
  tags?: string[];
  languages?: string[];
  listed?: boolean;
}

/** `PUT /lineup/bots/{id}`: only the fields sent change. */
export function updateBot(env: Env, actor: Actor, botId: Snowflake, body: BotUpdate): BotProfile {
  const profile = env.db.botProfiles[botId];
  if (!profile) throw notFound('lineup_bot_not_found');
  requireBotManager(env, actor, botId);
  if (body.description !== undefined) profile.description = body.description ? body.description : null;
  if (body.links !== undefined) profile.links = body.links;
  if (body.theme !== undefined) profile.theme = body.theme;
  if (body.tags !== undefined) profile.tags = body.tags;
  if (body.languages !== undefined) profile.languages = body.languages;
  if (body.listed !== undefined) profile.listed = body.listed;
  profile.updated_at = iso(env.now);
  return toBotProfile(env, profile, actor);
}

/** `DELETE /lineup/bots/{id}`: CLOSES the bot's draft and published posts, then removes the profile. */
export function deleteBot(env: Env, actor: Actor, botId: Snowflake): void {
  if (!env.db.botProfiles[botId]) throw notFound('lineup_bot_not_found');
  requireBotManager(env, actor, botId);
  for (const post of Object.values(env.db.posts)) {
    if (post.kind === 'bot' && post.bot_id === botId && (post.status === 'draft' || post.status === 'published')) {
      post.status = 'closed';
      post.updated_at = iso(env.now);
    }
  }
  delete env.db.botProfiles[botId];
}

/**
 * `POST /lineup/bots/{id}/refresh`: rights, then once per minute per bot. The
 * support server is read again: if the developer changed it, the rights follow
 * the new one from now on.
 */
export function refreshBot(env: Env, actor: Actor, botId: Snowflake): BotProfile {
  const profile = env.db.botProfiles[botId];
  if (!profile) throw notFound('lineup_bot_not_found');
  requireBotManager(env, actor, botId);
  const hit = env.db.rt.limiter.hit(`bot_refresh:${botId}`, 1, REFRESH_WINDOW_MS, env.now.getTime());
  if (!hit.allowed) throw rateLimited(hit.retryAfter, 'Ce bot a déjà été rafraîchi à l’instant.');
  if (env.discordDown || profile.refresh_blocked) return {...toBotProfile(env, profile, actor), stale: true};
  profile.snapshot_at = iso(env.now);
  profile.support_guild_id = env.db.bots[botId]?.support_guild_id ?? profile.support_guild_id;
  return toBotProfile(env, profile, actor);
}
