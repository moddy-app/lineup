/**
 * The mock database's rows: what the real backend keeps in PostgreSQL
 * (LINEUP.md §14) plus the Discord side it reads (guilds, memberships,
 * invitations). Views (src/api/types.ts) are built from these in logic/views.ts.
 */

import type {
  AvatarDecoration,
  CalendarDate,
  DiscordFreeObject,
  ExperienceKind,
  IsoDateTime,
  Link,
  ManualBadgeGrant,
  Nameplate,
  Post,
  Report,
  Snowflake,
  Uuid,
  VerificationEvidence,
  VerificationMethod,
  VerificationStatus,
} from '@/api/types';

/** A global sanction (docs/GLOBAL_SANCTIONS.md): the account or the server is suspended. */
export interface SanctionSpec {
  level: string;
  subject_type: 'discord_user' | 'guild';
  references: string[];
  expires_at: IsoDateTime | null;
}

/** `lineup_user_profiles` (the part a person edits). */
export interface UserProfileRow {
  headline: string | null;
  bio: string | null;
  links: Link[];
  languages: string[];
  timezone: string | null;
  open_to_work: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** A person: their public Discord snapshot, and their Lineup profile if they ever edited one. */
export interface DbUser {
  id: Snowflake;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
  /** The hash Discord's snapshot stores (the API builds `avatar_url` from it). */
  avatar_hash: string | null;
  banner_url: string | null;
  accent_color: number | null;
  avatar_decoration: AvatarDecoration | null;
  nameplate: Nameplate | null;
  display_name_styles: DiscordFreeObject | null;
  primary_guild: DiscordFreeObject | null;
  /** Discord `public_flags` bit field. */
  public_flags: number;
  is_staff: boolean;
  /** An active Moddy Premium subscription. */
  premium: boolean;
  /** A `ban`: 403 `user_suspended` on session routes, 404 for everyone else. */
  sanction: SanctionSpec | null;
  /** When the snapshot was read (refreshed on read after 24 h). */
  snapshot_at: IsoDateTime;
  /** The refresh through the bot always fails: `stale: true` once the snapshot is old. */
  snapshot_blocked: boolean;
  /** Null: never edited (and `GET /lineup/me` answers `profile: null`). */
  profile: UserProfileRow | null;
}

/** A server as Discord knows it, plus whether Moddy and its premium are there. */
export interface DiscordGuild {
  id: Snowflake;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  splash_url: string | null;
  description: string | null;
  /** `VERIFIED`, `PARTNERED`… */
  features: string[];
  /** 0 default, 1 explicit, 2 safe, 3 age-restricted. */
  nsfw_level: 0 | 1 | 2 | 3;
  premium_subscription_count: number | null;
  premium_tier: number | null;
  vanity_url_code: string | null;
  member_count: number | null;
  presence_count: number | null;
  verification_level: number;
  /** The bot is on the server right now. */
  has_moddy: boolean;
  /** `premium.guild_premium_effective`. */
  premium_effective: boolean;
  owner_id: Snowflake;
  /** A `ban` on the server (suspended or blacklisted). */
  sanction: SanctionSpec | null;
}

/** `lineup_guild_profiles`. The Discord snapshot is read from `DiscordGuild` (fresh at each refresh). */
export interface GuildProfileRow {
  guild_id: Snowflake;
  invite_code: string;
  description: string | null;
  links: Link[];
  theme: string | null;
  tags: string[];
  languages: string[];
  snapshot_at: IsoDateTime;
  /** The bot's state at the last refresh (up to 6 h old). */
  has_moddy: boolean;
  claimed_by: Snowflake;
  listed: boolean;
  /** `_invite_invalid` in the snapshot: the invitation no longer exists on Discord. */
  invite_invalid: boolean;
  /** Refreshing the snapshot always fails (the bot was removed, the invitation is gone…). */
  refresh_blocked: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** What a person is on a server, on Discord: the base permissions the API reads with their OAuth token. */
export interface Member {
  user_id: Snowflake;
  guild_id: Snowflake;
  owner: boolean;
  /** Names of §7 (ADMINISTRATOR, MANAGE_GUILD, MANAGE_MESSAGES…) the person holds. */
  permissions: string[];
  role_count: number;
}

/** A Discord invitation as the mock's Discord resolves it. */
export interface Invite {
  code: string;
  /** `group_dm` and `friend` invitations do not lead to a server. */
  kind: 'guild' | 'group_dm' | 'friend';
  guild_id: Snowflake | null;
  /** Null: never expires. */
  expires_at: IsoDateTime | null;
}

/** `lineup_posts`. */
export type DbPost = Omit<Post, 'is_expired' | 'guild' | 'author'> & {hidden_reason: string | null};

/** `lineup_experiences`. */
export interface DbExperience {
  id: Uuid;
  user_id: Snowflake;
  kind: ExperienceKind;
  guild_id: Snowflake | null;
  invite_code: string | null;
  name: string;
  position: string;
  position_other: string | null;
  description: string | null;
  start_date: CalendarDate;
  end_date: CalendarDate | null;
  status: VerificationStatus;
  method: VerificationMethod | null;
  evidence: VerificationEvidence | null;
  verified_at: IsoDateTime | null;
  verified_by: Snowflake | null;
  rejection_reason: string | null;
  sort_index: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** The list of servers Discord gave back for a person, cached for 5 minutes (LINEUP.md §15). */
export interface GuildListCache {
  fetched_at: IsoDateTime;
  /** A pinned entry does not expire until `refresh-guilds` (the mock's way of showing a stale cache). */
  pinned: boolean;
  guilds: Array<{id: Snowflake; owner: boolean; permissions: string[]}>;
}

/** The persisted part of the database. */
export interface DbData {
  version: number;
  users: Record<Snowflake, DbUser>;
  guilds: Record<Snowflake, DiscordGuild>;
  profiles: Record<Snowflake, GuildProfileRow>;
  members: Member[];
  invites: Record<string, Invite>;
  posts: Record<Uuid, DbPost>;
  experiences: Record<Uuid, DbExperience>;
  reports: Record<Uuid, Report>;
  /** Manual badges, newest grants last. */
  badges: ManualBadgeGrant[];
  guildListCache: Record<Snowflake, GuildListCache>;
}
