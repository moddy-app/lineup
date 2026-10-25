/**
 * Experiences and their verification (LINEUP.md §6.6, §7). The state machine:
 *
 *   unverified → pending (request-review) → verified | rejected (staff)
 *   unverified | pending | rejected → verified (automatic, through Discord)
 *   verified | pending | rejected → unverified when a sensitive field changes
 *   (the one exception: an end_date on a verified, current experience)
 */

import type {
  CalendarDate,
  ExperienceList,
  PrivateExperience,
  Snowflake,
  StaffExperience,
  Uuid,
  VerificationEvidence,
} from '@/api/types';

import {conflict, lineupError, notFound, rateLimited, unprocessable} from '../errors';
import type {Actor, Env} from '../env';
import {newUuid} from '../ids';
import type {DbExperience} from '../model';
import {calendarDate, iso, MINUTE} from '../time';
import {membershipOf} from './access';
import {resolveBot} from './bots';
import {requireDiscord, resolveInvite} from './discord';
import {limits, type CreateExperienceInput} from './schemas';
import {experiencesOf, toPrivateExperience, toStaffExperience} from './views';

/** The staff permissions that make an experience verifiable, in the order the doc lists them (§7). */
export const STAFF_PERMISSIONS = [
  'ADMINISTRATOR',
  'MANAGE_GUILD',
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'MANAGE_MESSAGES',
  'MODERATE_MEMBERS',
  'MANAGE_NICKNAMES',
  'MANAGE_EVENTS',
] as const;

const VERIFY_LIMIT = 5;
const VERIFY_WINDOW_MS = 10 * MINUTE;

const invalid = (message: string) => unprocessable('lineup_experience_invalid', message);

/** The caller's experience, or the same 404 whether it is unknown or someone else's (§6.6). */
export function loadOwnExperience(env: Env, actor: Actor, id: Uuid): DbExperience {
  const row = env.db.experiences[id];
  if (!row || row.user_id !== actor.id) throw notFound('lineup_experience_not_found');
  return row;
}

/** Forgets everything the verification established: method, proof, rejection reason, date. */
function resetVerification(row: DbExperience): void {
  row.status = 'unverified';
  row.method = null;
  row.evidence = null;
  row.verified_at = null;
  row.verified_by = null;
  row.rejection_reason = null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function listMyExperiences(env: Env, actor: Actor): ExperienceList {
  return {items: experiencesOf(env, actor.id).map((row) => toPrivateExperience(env, row))};
}

/** `POST /lineup/me/experiences`: `unverified`, added in LAST position. 50 at most. */
export function createExperience(env: Env, actor: Actor, input: CreateExperienceInput): PrivateExperience {
  const mine = experiencesOf(env, actor.id);
  if (mine.length >= limits.max_experiences) {
    throw conflict('lineup_experience_limit', `Limite de ${limits.max_experiences} expériences atteinte.`);
  }
  let guildId: Snowflake | null = null;
  let inviteCode: string | null = null;
  // §6.6: `name` is "repris de l'invitation" for a server and ignored if sent.
  let name = input.name ?? '';
  // A server: the icon and the member count come from the invitation. A service: the image is the person's.
  let imageUrl: string | null = input.kind === 'service' ? (input.image_url ?? null) : null;
  let memberCount: number | null = null;
  let botId: Snowflake | null = null;
  let guildCount: number | null = null;
  if (input.kind === 'bot' && input.bot_id) {
    // `name` and `image_url` are ignored: they come from Discord.
    const bot = resolveBot(env, input.bot_id);
    botId = bot.id;
    name = bot.name;
    imageUrl = bot.avatar_url;
    guildCount = bot.guild_count;
  }
  if (input.kind === 'guild' && input.invite) {
    const {invite, guild} = resolveInvite(env, input.invite);
    guildId = guild.id;
    inviteCode = invite.code;
    name = guild.name;
    imageUrl = guild.icon_url;
    memberCount = guild.member_count;
  }
  const now = iso(env.now);
  const row: DbExperience = {
    id: newUuid(),
    user_id: actor.id,
    kind: input.kind,
    guild_id: guildId,
    bot_id: botId,
    invite_code: inviteCode,
    name,
    image_url: imageUrl,
    member_count: memberCount,
    guild_count: guildCount,
    position: input.position,
    position_other: input.position === 'other' ? (input.position_other ?? null) : null,
    description: input.description ? input.description : null,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    status: 'unverified',
    method: null,
    evidence: null,
    verified_at: null,
    verified_by: null,
    rejection_reason: null,
    sort_index: mine.length === 0 ? 0 : Math.max(...mine.map((entry) => entry.sort_index)) + 1,
    created_at: now,
    updated_at: now,
  };
  env.db.experiences[row.id] = row;
  return toPrivateExperience(env, row);
}

export interface ExperienceUpdate {
  invite?: string;
  bot_id?: Snowflake;
  name?: string;
  image_url?: string | null;
  position?: string;
  position_other?: string;
  description?: string | null;
  start_date?: CalendarDate;
  end_date?: CalendarDate | null;
}

/**
 * `PATCH /lineup/me/experiences/{id}`.
 *
 * The merged state must be valid (422 `lineup_experience_invalid`). Then, if a
 * field that grounds the verification REALLY changes (server, a service's
 * name, position, position_other, either date) on a `verified`, `pending` or
 * `rejected` experience, it goes back to `unverified` with everything erased.
 * Changing the description never does, and neither does sending the same
 * value again.
 */
export function updateExperience(env: Env, actor: Actor, id: Uuid, patch: ExperienceUpdate): PrivateExperience {
  const row = loadOwnExperience(env, actor, id);
  const today = calendarDate(env.now);

  // --- the merged state ----------------------------------------------------
  if (patch.invite !== undefined && row.kind !== 'guild') {
    throw invalid('Seule une expérience de serveur a une invitation.');
  }
  if (patch.bot_id !== undefined && row.kind !== 'bot') {
    throw invalid("bot_id n'est modifiable que pour une expérience de bot.");
  }
  const position = patch.position ?? row.position;
  // A catalog position (not `other`) empties position_other by itself.
  const positionOther =
    patch.position !== undefined && position !== 'other' && patch.position_other === undefined
      ? null
      : (patch.position_other ?? row.position_other);
  if (position === 'other' && !positionOther) throw invalid('Précisez le poste (position_other).');
  if (position !== 'other' && positionOther)
    throw invalid("position_other n'est autorisé que pour le poste « Autre ».");
  const startDate = patch.start_date ?? row.start_date;
  const endDate = patch.end_date !== undefined ? patch.end_date : row.end_date;
  if (startDate > today || (endDate !== null && endDate > today))
    throw invalid('Les dates ne peuvent pas être dans le futur.');
  if (endDate !== null && endDate < startDate) throw invalid('La date de fin précède la date de début.');

  // --- the new server, if an invitation was sent ---------------------------
  let serverChanged = false;
  let nextInvite = row.invite_code;
  let nextGuildId = row.guild_id;
  let nextName = row.name;
  let nextImage = row.image_url;
  let nextMembers = row.member_count;
  if (patch.invite !== undefined) {
    const {invite, guild} = resolveInvite(env, patch.invite);
    serverChanged = guild.id !== row.guild_id;
    nextInvite = invite.code;
    nextGuildId = guild.id;
    nextName = guild.name;
    // Read again from the invitation, at each change of invitation.
    nextImage = guild.icon_url;
    nextMembers = guild.member_count;
  }
  // A bot: the same id refreshes the name, avatar and server count without touching the verification; another resets it.
  let nextBotId = row.bot_id ?? null;
  let nextGuildCount = row.guild_count ?? null;
  if (patch.bot_id !== undefined) {
    const bot = resolveBot(env, patch.bot_id);
    serverChanged = bot.id !== row.bot_id;
    nextBotId = bot.id;
    nextName = bot.name;
    nextImage = bot.avatar_url;
    nextGuildCount = bot.guild_count;
  }
  // A service's image is the person's (null clears it); for a server `image_url` is ignored.
  if (row.kind === 'service' && patch.image_url !== undefined) nextImage = patch.image_url;
  // `name` is the person's for a service and ignored for a server.
  const nameChanged = row.kind === 'service' && patch.name !== undefined && patch.name !== row.name;
  if (row.kind === 'service' && patch.name !== undefined) nextName = patch.name;

  const positionChanged = position !== row.position;
  const positionOtherChanged = positionOther !== row.position_other;
  const startChanged = startDate !== row.start_date;
  const endChanged = endDate !== row.end_date;
  const otherSensitive = serverChanged || nameChanged || positionChanged || positionOtherChanged || startChanged;

  if (row.status !== 'unverified' && (otherSensitive || endChanged)) {
    // §7: an end_date posed on a VERIFIED, CURRENT experience (the person left the team) keeps `verified` —
    // if nothing else sensitive changes in the same PATCH. It does not hold for pending/rejected experiences,
    // nor to change or remove an end already set.
    const endDateException = row.status === 'verified' && row.end_date === null && endDate !== null && !otherSensitive;
    if (!endDateException) resetVerification(row);
  }

  row.invite_code = nextInvite;
  row.guild_id = nextGuildId;
  row.bot_id = nextBotId;
  row.guild_count = nextGuildCount;
  row.name = nextName;
  // Changing the image does not reset a verification (it is not in `otherSensitive`).
  row.image_url = nextImage;
  row.member_count = nextMembers;
  row.position = position;
  row.position_other = positionOther;
  row.start_date = startDate;
  row.end_date = endDate;
  if (patch.description !== undefined) row.description = patch.description === '' ? null : patch.description;
  row.updated_at = iso(env.now);
  return toPrivateExperience(env, row);
}

/** `PUT /lineup/me/experiences/order`: every id once, exactly. */
export function reorderExperiences(env: Env, actor: Actor, ids: Uuid[]): ExperienceList {
  const mine = experiencesOf(env, actor.id);
  const wanted = new Set(ids);
  if (ids.length !== mine.length || wanted.size !== ids.length || !mine.every((row) => wanted.has(row.id))) {
    throw unprocessable(
      'lineup_experience_order_invalid',
      'La liste doit contenir toutes vos expériences, une fois chacune. Rechargez la liste puis réessayez.',
    );
  }
  const now = iso(env.now);
  ids.forEach((id, index) => {
    const row = env.db.experiences[id];
    if (row && row.sort_index !== index) {
      row.sort_index = index;
      row.updated_at = now;
    }
  });
  return listMyExperiences(env, actor);
}

/** `DELETE`: a post that featured it keeps going with `featured_experience_id: null` (`ON DELETE SET NULL`). */
export function deleteExperience(env: Env, actor: Actor, id: Uuid): void {
  const row = loadOwnExperience(env, actor, id);
  delete env.db.experiences[row.id];
  for (const post of Object.values(env.db.posts)) {
    if (post.featured_experience_id === row.id) post.featured_experience_id = null;
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function verificationFailed(reason: 'not_member' | 'no_staff_permission') {
  return lineupError(
    422,
    'lineup_verification_failed',
    reason === 'not_member'
      ? "Vous n'êtes pas membre de ce serveur."
      : "Vous n'avez aucune permission de staff sur ce serveur.",
    {reason, can_request_review: true},
  );
}

/**
 * `POST …/verify` (automatic, with the person's own Discord token). Order of
 * checks (§6.6): session (dispatcher) → 404 → 422 not applicable (`not_guild`,
 * then `ended`) → already verified: returned as it is, no Discord call → 403
 * `lineup_reauth_required` → 429 (5 per 10 minutes) → Discord (503 if silent)
 * → 422 `lineup_verification_failed`. So a verified then ended experience
 * answers 422 `ended`.
 */
export function verifyExperience(env: Env, actor: Actor, id: Uuid): PrivateExperience {
  const row = loadOwnExperience(env, actor, id);
  // A bot is checked on its CURRENT support server.
  let checkedGuildId = row.guild_id;
  if (row.kind === 'bot' && row.bot_id) {
    const bot = env.db.bots[row.bot_id];
    if (!bot?.discoverable || !bot.support_guild_id) {
      throw unprocessable(
        'lineup_verification_not_applicable',
        "Ce bot n'est plus découvrable ou n'a plus de serveur support.",
        {reason: 'bot_unavailable', can_request_review: true},
      );
    }
    checkedGuildId = bot.support_guild_id;
  } else if (row.kind !== 'guild' || !row.guild_id) {
    throw unprocessable(
      'lineup_verification_not_applicable',
      'La vérification automatique ne concerne que les serveurs Discord.',
      {
        reason: 'not_guild',
      },
    );
  }
  if (row.end_date !== null) {
    throw unprocessable(
      'lineup_verification_not_applicable',
      'La vérification automatique ne concerne que les expériences en cours.',
      {
        reason: 'ended',
      },
    );
  }
  if (row.status === 'verified') return toPrivateExperience(env, row);
  if (!actor.has_lineup_scopes) {
    throw lineupError(403, 'lineup_reauth_required', 'Autorisez Lineup à lire vos serveurs.', {
      login_url: '/lineup/auth/login',
    });
  }
  const hit = env.db.rt.limiter.hit(`verify_attempts:${actor.id}`, VERIFY_LIMIT, VERIFY_WINDOW_MS, env.now.getTime());
  if (!hit.allowed) throw rateLimited(hit.retryAfter, 'Trop de tentatives de vérification. Réessayez plus tard.');
  requireDiscord(env);

  let permissions: string[];
  let owner = false;
  let roleCount = 4;
  switch (env.verifyOutcome) {
    case 'success':
      permissions = ['MANAGE_MESSAGES', 'MODERATE_MEMBERS'];
      break;
    case 'not_member':
      throw verificationFailed('not_member');
    case 'no_staff_permission':
      throw verificationFailed('no_staff_permission');
    case 'auto': {
      const member = checkedGuildId ? membershipOf(env, actor.id, checkedGuildId) : undefined;
      if (!member) throw verificationFailed('not_member');
      owner = member.owner;
      roleCount = member.role_count;
      permissions = STAFF_PERMISSIONS.filter((name) => member.permissions.includes(name));
      // Owner OR at least one staff permission; the proof never holds the roles' content.
      if (!owner && permissions.length === 0) throw verificationFailed('no_staff_permission');
    }
  }
  const now = iso(env.now);
  row.status = 'verified';
  row.method = 'discord_oauth';
  row.verified_at = now;
  row.verified_by = null;
  row.rejection_reason = null;
  row.evidence = {
    permissions,
    owner,
    role_count: roleCount,
    checked_at: now,
    ...(row.kind === 'bot' && checkedGuildId ? {support_guild_id: checkedGuildId} : {}),
  };
  row.updated_at = now;
  return toPrivateExperience(env, row);
}

/** `POST …/request-review`: `unverified` or `rejected` → `pending`; the note stays in the proof. */
export function requestReview(env: Env, actor: Actor, id: Uuid, note: string | undefined): PrivateExperience {
  const row = loadOwnExperience(env, actor, id);
  if (row.status === 'verified') {
    throw conflict('lineup_experience_already_verified', 'Cette expérience est déjà vérifiée.');
  }
  if (row.status === 'pending') {
    throw conflict('lineup_review_already_pending', 'Une revue est déjà en attente pour cette expérience.');
  }
  const now = iso(env.now);
  const evidence: VerificationEvidence = {requested_at: now};
  if (note) evidence.review_note = note;
  row.status = 'pending';
  row.method = null;
  row.verified_at = null;
  row.rejection_reason = null;
  row.evidence = evidence;
  row.updated_at = now;
  return toPrivateExperience(env, row);
}

// ---------------------------------------------------------------------------
// Staff review (§6.7)
// ---------------------------------------------------------------------------

function loadAny(env: Env, id: Uuid): DbExperience {
  const row = env.db.experiences[id];
  if (!row) throw notFound('lineup_experience_not_found');
  return row;
}

/** Validates from ANY status; keeps the existing proof and adds the staff's note. */
export function staffVerifyExperience(env: Env, staff: Actor, id: Uuid, note: string | undefined): StaffExperience {
  const row = loadAny(env, id);
  const now = iso(env.now);
  row.status = 'verified';
  row.method = 'moddy_staff';
  row.verified_at = now;
  row.verified_by = staff.id;
  row.rejection_reason = null;
  row.evidence = {...(row.evidence ?? {}), verified_at_by_staff: now, ...(note ? {staff_note: note} : {})};
  row.updated_at = now;
  return toStaffExperience(env, row);
}

/** Rejects from ANY status; the reason is shown to the owner. */
export function staffRejectExperience(env: Env, staff: Actor, id: Uuid, reason: string): StaffExperience {
  const row = loadAny(env, id);
  row.status = 'rejected';
  row.method = null;
  row.verified_at = null;
  row.verified_by = staff.id;
  row.rejection_reason = reason;
  row.updated_at = iso(env.now);
  return toStaffExperience(env, row);
}
