/**
 * The shape of every object the Lineup API sends or accepts (LINEUP.md §4 to
 * §6). One file, read like the contract.
 *
 * Conventions that hold everywhere:
 *  - Ids are strings. Discord snowflakes overflow Number; Lineup objects use
 *    UUIDs. Never convert one.
 *  - Dates are ISO 8601 strings (`2026-10-20T14:03:11.482913+00:00`);
 *    calendar dates (an experience's start and end) are `YYYY-MM-DD` strings.
 *  - Enums that the contract fixes (a post's status, a report's reason) are
 *    string-literal unions. Anything that comes from the catalog (positions,
 *    themes, languages, badges…) is a plain `string`: the catalog is dynamic
 *    and the front never hardcodes its lists.
 *  - Request bodies mirror the API's own rules: a field typed `X | null` accepts
 *    an explicit null ("clear it"); a field typed `X?` is simply left out to be
 *    left alone, and sending null there is a 422.
 */

/** A Discord snowflake, as a string. */
export type Snowflake = string;
/** A UUID (posts, experiences, reports), as a string. */
export type Uuid = string;
/** ISO 8601 date and time, UTC. */
export type IsoDateTime = string;
/** `YYYY-MM-DD`, without a time zone. */
export type CalendarDate = string;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * A page of a cursor-paginated list. `next_cursor` is opaque: pass it back
 * as is, never build or read it. A page can be shorter than `limit`, even
 * empty, with a non-null `next_cursor` (LINEUP.md §0).
 */
export interface Paginated<T> {
  items: T[];
  next_cursor: string | null;
}

// ---------------------------------------------------------------------------
// Catalog (GET /lineup/catalog)
// ---------------------------------------------------------------------------

export interface LocalizedLabel {
  fr: string;
  en: string;
}

/** An entry of a closed list: a stable id and a label in French and English. */
export interface CatalogEntry {
  id: string;
  label: LocalizedLabel;
}

export type RequirementValueType = 'int' | 'text' | 'bool' | 'languages' | 'none';

/** `now`: Lineup can check it today; `future`: planned; `no`: declarative. */
export type RequirementVerifiable = 'now' | 'future' | 'no';

export interface CatalogRequirement extends CatalogEntry {
  /** The shape of `value` in a requirement. `none`: no value at all. */
  value_type: RequirementValueType;
  verifiable: RequirementVerifiable;
  /** `int` only. */
  min?: number;
  max?: number;
  /** `text` only. */
  max_len?: number;
  /** `custom`: the requirement needs a `label` (its title). */
  requires_label?: boolean;
  label_max_len?: number;
}

export interface CatalogApplicationType extends CatalogEntry {
  /** False: reserved (`lineup_form`), writes answer 422 `lineup_form_unavailable`. */
  available: boolean;
  /** An `external_url` needs a URL; a Discord DM does not. */
  needs_url: boolean;
}

export type BadgeSource = 'computed' | 'manual' | 'discord';
export type BadgeEntity = 'guild' | 'user' | 'both';

export interface CatalogBadge extends CatalogEntry {
  entity: BadgeEntity;
  source: BadgeSource;
}

export interface CatalogLimits {
  max_positions: number;
  max_positions_other: number;
  position_other_max_len: number;
  max_requirements: number;
  max_languages: number;
  max_tags: number;
  /** A regular expression source: `^[a-z0-9-]{2,24}$`. */
  tag_pattern: string;
  max_links: number;
  max_published_posts_per_guild: number;
  max_published_posts_per_user: number;
  max_experiences: number;
  post_max_expiry_days: number;
  title: {min: number; max: number};
  description: {min: number; max: number};
}

export interface Catalog {
  positions: CatalogEntry[];
  requirements: CatalogRequirement[];
  application_types: CatalogApplicationType[];
  themes: CatalogEntry[];
  languages: CatalogEntry[];
  compensations: CatalogEntry[];
  badges: CatalogBadge[];
  limits: CatalogLimits;
}

/** The lists of the catalog that hold entries (everything but `limits`). */
export type CatalogKind = Exclude<keyof Catalog, 'limits'>;

// ---------------------------------------------------------------------------
// Shared objects (§5)
// ---------------------------------------------------------------------------

/** A badge on a profile. `label` is French and English; other languages come from the `catalog` namespace. */
export interface Badge {
  id: string;
  label: LocalizedLabel;
  source: BadgeSource;
}

export interface Link {
  /** 1 to 40 characters. */
  label: string;
  /** https only, 500 characters at most. */
  url: string;
}

export interface AvatarDecoration {
  asset: string;
  sku_id: string | null;
  url: string;
}

export interface Nameplate {
  asset: string;
  palette: string | null;
  label: string | null;
  sku_id: string | null;
  url: string;
}

/** `display_name_styles` and `primary_guild` come from Discord as they are: free objects, or null. */
export type DiscordFreeObject = Record<string, unknown>;

/** A person in a server's team (`team[].user`). */
export interface UserSummary {
  id: Snowflake;
  username: string | null;
  global_name: string | null;
  /** `global_name`, else `username`. */
  display_name: string | null;
  avatar_url: string | null;
  avatar_decoration: AvatarDecoration | null;
  /** Without Discord's badges and `moddy_premium` (summaries only). */
  badges: Badge[];
}

// ---- Posts ------------------------------------------------------------------

export type PostKind = 'guild' | 'user';
export type PostStatus = 'draft' | 'published' | 'closed' | 'hidden';

/** A condition of a post. `value` follows the catalog's `value_type`; `null` for `none`. */
export type RequirementValue = number | string | boolean | string[] | null;

export interface Requirement {
  /** A catalog requirement id. */
  type: string;
  value: RequirementValue;
  /** Only `custom` has one (its title). */
  label: string | null;
  /** A promise of verification, not a verification (LINEUP.md §8). */
  verified_by_lineup: boolean;
}

export type ApplicationType = 'external_url' | 'discord_dm' | 'lineup_form';

/** As read: `discord_dm` has `url: null`. */
export interface Application {
  type: ApplicationType;
  url: string | null;
}

/** As written: a Discord DM carries no `url` at all, and `lineup_form` is reserved. */
export type ApplicationInput = {type: 'external_url'; url: string} | {type: 'discord_dm'};

export interface Commitment {
  hours_per_week: number | null;
  /** A catalog compensation id. */
  compensation: string | null;
  openings: number | null;
}

export interface CommitmentInput {
  /** 1 to 168. */
  hours_per_week?: number;
  compensation?: string;
  /** 1 to 50. */
  openings?: number;
}

/** The server a post belongs to (`null` for a `user` post). */
export interface PostGuild {
  id: Snowflake;
  name: string | null;
  icon_url: string | null;
  /** The server is NSFW (theme or Discord's level): the age gate follows it. */
  nsfw: boolean;
  /** Without Discord's badges and `moddy_premium` (summaries only). */
  badges: Badge[];
}

/** From the stored snapshots, never from Discord: fields are null when unknown. */
export interface PostAuthor {
  id: Snowflake;
  username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  /** Without Discord's badges and `moddy_premium` (summaries only). */
  badges: Badge[];
}

/** The public view of a post (feed, detail, profiles). */
export interface Post {
  id: Uuid;
  kind: PostKind;
  guild_id: Snowflake | null;
  author_id: Snowflake;
  title: string;
  description: string;
  positions: string[];
  positions_other: string[];
  requirements: Requirement[];
  application: Application | null;
  languages: string[];
  timezone: string | null;
  commitment: Commitment | null;
  theme: string | null;
  tags: string[];
  featured_experience_id: Uuid | null;
  status: PostStatus;
  /** Null: never expires. */
  expires_at: IsoDateTime | null;
  /** Set at the FIRST publication and never cleared: reopening a post keeps it. */
  published_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  /** Computed on every read. An expired post is still readable by its link. */
  is_expired: boolean;
  guild: PostGuild | null;
  author: PostAuthor;
}

/** The private view (own posts, write responses): adds the staff's reason when hidden. */
export interface PrivatePost extends Post {
  hidden_reason: string | null;
}

/**
 * `GET /lineup/posts/{id}` and every write. `hidden_reason` is present only
 * when `can_edit` is true.
 */
export interface PostDetail extends Post {
  can_edit: boolean;
  hidden_reason?: string | null;
}

/** The response of `POST /posts`, `PATCH`, `publish` and `close`: always an editor's view. */
export interface PostWriteResult extends PrivatePost {
  can_edit: boolean;
}

/** `POST /lineup/staff/posts/{id}/hide` and `unhide`. */
export interface PostModeration {
  id: Uuid;
  status: PostStatus;
  hidden_reason: string | null;
}

// ---- Experiences ------------------------------------------------------------

export type ExperienceKind = 'guild' | 'service';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
/** `moddy_staff_system` is reserved: nothing produces it yet. */
export type VerificationMethod = 'discord_oauth' | 'moddy_staff' | 'moddy_staff_system';

/** What a check left behind. Private: never in a public view. Every key may be absent. */
export interface VerificationEvidence {
  /** `discord_oauth`: the staff permissions found (ADMINISTRATOR, MANAGE_GUILD…). */
  permissions?: string[];
  owner?: boolean;
  role_count?: number;
  checked_at?: IsoDateTime;
  /** A review request: the owner's note. */
  review_note?: string;
  requested_at?: IsoDateTime;
  /** A staff validation. */
  staff_note?: string;
  verified_at_by_staff?: IsoDateTime;
}

export interface PublicVerification {
  status: VerificationStatus;
  method: VerificationMethod | null;
  verified_at: IsoDateTime | null;
}

export interface PrivateVerification extends PublicVerification {
  evidence: VerificationEvidence | null;
  /** Shown to the owner after a rejection. */
  rejection_reason: string | null;
}

/** The server of a server experience, as a summary (`badges` without Discord's). */
export interface ExperienceGuild {
  id: Snowflake;
  name: string | null;
  icon_url: string | null;
  badges: Badge[];
}

/** The public view of an experience (someone else's profile): never any proof. */
export interface Experience {
  id: Uuid;
  kind: ExperienceKind;
  /** Null for a `service`. */
  guild_id: Snowflake | null;
  name: string;
  /** Null for a `service`. */
  invite_url: string | null;
  /** A server: its image or icon, from the invitation. A service: an https URL typed by the person, or null. */
  image_url: string | null;
  /** A server only, read from the invitation; null for a service. */
  member_count: number | null;
  /** The server's Lineup profile when it has one that is listed; null otherwise, and for a service. */
  guild: ExperienceGuild | null;
  /** A catalog position id. */
  position: string;
  position_other: string | null;
  description: string | null;
  start_date: CalendarDate;
  /** Null: still going. */
  end_date: CalendarDate | null;
  is_current: boolean;
  sort_index: number;
  verification: PublicVerification;
}

/** The owner's and the staff's view. */
export interface PrivateExperience extends Omit<Experience, 'verification'> {
  verification: PrivateVerification;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** A queue item of the staff console: the private view plus the owner. */
export interface StaffExperience extends PrivateExperience {
  user_id: Snowflake;
}

/** On a profile, the view depends on the visitor: private for oneself and the staff, public otherwise. */
export type ProfileExperience = Experience | PrivateExperience;

export function isPrivateExperience(experience: ProfileExperience): experience is PrivateExperience {
  return 'created_at' in experience;
}

// ---- Servers ----------------------------------------------------------------

export interface GuildInvite {
  code: string;
  /** Null: the bot could not create an invitation anywhere; hide "Join". */
  url: string | null;
  /** False: the invitation no longer exists on Discord; hide "Join". */
  valid: boolean;
}

/** An item of the public directory (`GET /lineup/guilds`). No `moddy_premium` badge. */
export interface GuildCard {
  id: Snowflake;
  name: string | null;
  icon_url: string | null;
  member_count: number | null;
  presence_count: number | null;
  theme: string | null;
  tags: string[];
  /** Without Discord's badges and `moddy_premium`. */
  badges: Badge[];
  /** The Lineup description, else Discord's, cut at 160 characters with "…". */
  description: string | null;
  nsfw: boolean;
}

export interface TeamMember {
  user: UserSummary;
  position: string;
  position_other: string | null;
  since: CalendarDate;
}

/** A server's full profile. `GET /lineup/guilds/{id}`, claim, update and refresh answer with it. */
export interface GuildProfile {
  id: Snowflake;
  name: string | null;
  icon_url: string | null;
  banner_url: string | null;
  splash_url: string | null;
  /** The Lineup description, falling back to Discord's. */
  description: string | null;
  /** Discord's own description alone (to prefill an editor). */
  discord_description: string | null;
  invite: GuildInvite | null;
  links: Link[];
  theme: string | null;
  tags: string[];
  languages: string[];
  boosts: number | null;
  /** 0 to 3; null while the snapshot predates it. */
  boost_tier: number | null;
  member_count: number | null;
  presence_count: number | null;
  /** When the SERVER was created (from its snowflake). */
  created_at: IsoDateTime;
  badges: Badge[];
  has_moddy: boolean;
  /** False: hidden from the directory; only managers and the staff see it. */
  listed: boolean;
  /** Published, unexpired posts of the server, 20 at most, NSFW included. */
  posts: Post[];
  team: TeamMember[];
  /** True: the Discord snapshot is old and could not be refreshed. */
  stale: boolean;
  /** When the Discord snapshot was taken. Managers only; null for anyone else. */
  snapshot_at: IsoDateTime | null;
  /** For showing edit buttons only; the API checks again on every write. */
  can_manage: boolean;
}

// ---- Users ------------------------------------------------------------------

/** A person's public profile. `GET /lineup/users/{id}` and `GET /lineup/me/profile`. */
export interface UserProfile {
  id: Snowflake;
  username: string | null;
  global_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  accent_color: number | null;
  avatar_decoration: AvatarDecoration | null;
  nameplate: Nameplate | null;
  display_name_styles: DiscordFreeObject | null;
  primary_guild: DiscordFreeObject | null;
  headline: string | null;
  bio: string | null;
  links: Link[];
  languages: string[];
  timezone: string | null;
  open_to_work: boolean;
  /** When the Discord ACCOUNT was created (from its snowflake). */
  created_at: IsoDateTime;
  badges: Badge[];
  /** Published, unexpired `user` posts, 20 at most. */
  posts: Post[];
  /** All of them, in the person's order. */
  experiences: ProfileExperience[];
  is_self: boolean;
  stale: boolean;
}

/** The public Discord fields stored in a profile row. Never an e-mail. */
export interface DiscordUserSnapshot {
  id?: Snowflake;
  username?: string | null;
  global_name?: string | null;
  avatar?: string | null;
  banner?: string | null;
  accent_color?: number | null;
  avatar_decoration_data?: DiscordFreeObject | null;
  collectibles?: DiscordFreeObject | null;
  display_name_styles?: DiscordFreeObject | null;
  primary_guild?: DiscordFreeObject | null;
  public_flags?: number;
}

/** The raw row of `lineup_user_profiles` in `GET /lineup/me`. For the full profile, `GET /lineup/me/profile`. */
export interface MeProfileRow {
  user_id: Snowflake;
  headline: string | null;
  bio: string | null;
  links: Link[];
  languages: string[];
  timezone: string | null;
  open_to_work: boolean;
  discord_snapshot: DiscordUserSnapshot;
  snapshot_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface MeUser {
  id: Snowflake;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_decoration_data: DiscordFreeObject | null;
  is_staff: boolean;
  /** Without Discord's badges and `moddy_premium` (summaries only). */
  badges: Badge[];
}

/**
 * `GET /auth/me` (dashboard route), reduced to what the front reads. The e-mail
 * comes from the session, so a change on Discord shows after the next sign-in.
 */
export interface Account {
  /** Null when the Discord account has none or did not share it. */
  email: string | null;
  /** Discord verified the address. */
  verified: boolean | null;
}

/** `GET /lineup/me`. Also the session test: a 401 means signed out. */
export interface Me {
  user: MeUser;
  /** False: the session comes from the dashboard; only automatic verification needs a Lineup sign-in. */
  has_lineup_scopes: boolean;
  /** Relative to the API: prefix with its base URL. */
  login_url: string;
  /** Null until the person edits their profile or has a snapshot. */
  profile: MeProfileRow | null;
}

/** `GET /lineup/me/guilds`: a server the person can manage on Lineup. */
export interface MyGuild {
  id: Snowflake;
  name: string | null;
  icon_url: string | null;
  /** The bot is on the server. */
  has_moddy: boolean;
  /** A Lineup profile exists already. */
  claimed: boolean;
  /** The profile exists and is visible in the directory; false without a profile. */
  listed: boolean;
}

/** `POST /lineup/me/refresh-guilds`. `stale`: Discord did not answer, `guilds` is the session's (incomplete) list. */
export interface RefreshGuildsResponse {
  guilds: MyGuild[];
  stale: boolean;
}

// ---- Reports ----------------------------------------------------------------

export type ReportReason = 'spam' | 'scam' | 'inappropriate' | 'impersonation' | 'other';
export type ReportTargetType = 'post' | 'user' | 'guild';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

/** A line of the staff's report queue. `target_id` is a post UUID or a snowflake. */
export interface Report {
  id: Uuid;
  target_type: ReportTargetType;
  target_id: string;
  reporter_id: Snowflake;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  handled_by: Snowflake | null;
  created_at: IsoDateTime;
}

/**
 * `POST /lineup/reports`. 201 with `created: true`; 200 with `created: false`
 * when the person already has an open report on this target ("already reported").
 */
export interface CreateReportResponse {
  id: Uuid;
  status: ReportStatus;
  created: boolean;
}

// ---- Staff ------------------------------------------------------------------

export type BadgeEntityType = 'user' | 'guild';

/** A manual badge granted by the staff. */
export interface ManualBadgeGrant {
  entity_type: BadgeEntityType;
  entity_id: Snowflake;
  /** The person's or the server's name; null without a Lineup profile. */
  entity_name: string | null;
  /** The avatar or the server's icon; null without a Lineup profile. */
  entity_icon_url: string | null;
  badge: string;
  granted_by: Snowflake;
  granted_at: IsoDateTime;
  note: string | null;
}

/** `GET /lineup/staff/badges` is paginated by limit and offset, with no total. */
export interface StaffBadgesPage {
  items: ManualBadgeGrant[];
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

export interface CreatePostBodyBase {
  /** 5 to 100 characters. */
  title: string;
  /** 20 to 4000 characters. */
  description: string;
  /** 1 to 5 catalog ids, no duplicate. */
  positions: string[];
  /** Required if and only if `other` is in `positions`; 3 labels of 40 characters at most. */
  positions_other?: string[];
  requirements?: RequirementInput[];
  application?: ApplicationInput | null;
  languages?: string[];
  /** An IANA zone or `UTC±HH:MM`. */
  timezone?: string | null;
  commitment?: CommitmentInput | null;
  theme?: string | null;
  tags?: string[];
  /** A `verified` experience of the author; `user` posts only. */
  featured_experience_id?: Uuid | null;
  /** `published` publishes at once. Default `draft`. */
  status?: 'draft' | 'published';
  /** With a time zone, in the future, within 180 days. Null (default): never. */
  expires_at?: IsoDateTime | null;
}

export interface RequirementInput {
  type: string;
  /** Per the catalog's `value_type`; absent for `none`. */
  value?: RequirementValue;
  /** `custom` only (80 characters at most). */
  label?: string | null;
  /** Only where the catalog's `verifiable` is not `no`. */
  verified_by_lineup?: boolean;
}

/** `guild_id` is required for a server post and forbidden for a personal one. */
export type CreatePostBody =
  (CreatePostBodyBase & {kind: 'guild'; guild_id: Snowflake}) | (CreatePostBodyBase & {kind: 'user'; guild_id?: never});

/**
 * `PATCH /lineup/posts/{id}`: every field is optional and only sent fields
 * change. `kind`, `guild_id` and `status` are refused. An explicit null clears
 * `application`, `timezone`, `commitment`, `theme`, `featured_experience_id`
 * and `expires_at`; it is a 422 on any other field.
 */
export interface UpdatePostBody {
  title?: string;
  description?: string;
  positions?: string[];
  positions_other?: string[];
  requirements?: RequirementInput[];
  application?: ApplicationInput | null;
  languages?: string[];
  timezone?: string | null;
  commitment?: CommitmentInput | null;
  theme?: string | null;
  tags?: string[];
  featured_experience_id?: Uuid | null;
  expires_at?: IsoDateTime | null;
}

/**
 * `POST /lineup/guilds/claim`: at least one of the two. With Moddy on the
 * server (`has_moddy`), `guild_id` alone is enough: the API reads the server
 * and creates the permanent invitation itself. Without Moddy the invitation is
 * required (422 `invite_required` otherwise).
 */
export type ClaimGuildBody = {invite: string; guild_id?: Snowflake} | {guild_id: Snowflake; invite?: string};

export interface UpdateGuildBody {
  /** 2000 characters at most; null goes back to Discord's text. */
  description?: string | null;
  /** 5 at most. Send `[]` to empty. */
  links?: Link[];
  theme?: string | null;
  tags?: string[];
  languages?: string[];
  /**
   * A new permanent invitation to the same server. `null` asks Moddy to
   * generate one (only when Moddy is on the server, else 422 `invite_required`).
   */
  invite?: string | null;
  listed?: boolean;
}

export interface UpdateProfileBody {
  /** 120 characters at most. */
  headline?: string | null;
  /** 2000 characters at most. */
  bio?: string | null;
  links?: Link[];
  languages?: string[];
  timezone?: string | null;
  open_to_work?: boolean;
}

interface ExperienceBodyBase {
  /** A catalog position id. */
  position: string;
  /** Required if and only if `position` is `other` (1 to 40). */
  position_other?: string;
  /** 1000 characters at most. */
  description?: string | null;
  start_date: CalendarDate;
  /** Null (default): still going. Not in the future, not before `start_date`. */
  end_date?: CalendarDate | null;
}

export type CreateExperienceBody =
  | (ExperienceBodyBase & {kind: 'guild'; invite: string; name?: never})
  | (ExperienceBodyBase & {kind: 'service'; name: string; invite?: never; image_url?: string | null});

/**
 * `PATCH /lineup/me/experiences/{id}`. `kind` cannot change. `position` and
 * `start_date` are not nullable; `end_date: null` means "still going".
 */
export interface UpdateExperienceBody {
  /** A server experience only. */
  invite?: string;
  /** A service only. */
  name?: string;
  /** A service only: an https URL, 500 characters at most; null clears it. Ignored for a server. */
  image_url?: string | null;
  position?: string;
  position_other?: string;
  description?: string | null;
  start_date?: CalendarDate;
  end_date?: CalendarDate | null;
}

export interface ReorderExperiencesBody {
  /** Every experience exactly once, in the new order. */
  ids: Uuid[];
}

export interface RequestReviewBody {
  /** 500 characters at most. */
  note?: string;
}

export interface CreateReportBody {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  /** 1000 characters at most. */
  details?: string;
}

export interface StaffVerifyBody {
  /** 500 characters at most. */
  note?: string;
}

export interface StaffRejectBody {
  /** 1 to 500 characters, shown to the owner. */
  reason: string;
}

export interface StaffHideBody {
  /** 1 to 500 characters, shown to the author. */
  reason: string;
}

export interface GrantBadgeBody {
  /** 200 characters at most. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Query filters
// ---------------------------------------------------------------------------

/** The public feed's filters (`GET /lineup/posts`). Arrays are OR filters. */
export interface FeedFilters {
  kind?: PostKind;
  /** At most 10 catalog ids. */
  positions?: string[];
  languages?: string[];
  tags?: string[];
  theme?: string;
  /** A catalog compensation id. */
  compensation?: string;
  /** 100 characters at most. */
  q?: string;
  guild_id?: Snowflake;
  author_id?: Snowflake;
  /** Only on the person's explicit choice. Default false. */
  include_nsfw?: boolean;
}

/** The directory's filters (`GET /lineup/guilds`). */
export interface DirectoryFilters {
  theme?: string;
  /** 100 characters at most. */
  q?: string;
  include_nsfw?: boolean;
}

/** `GET /lineup/me/posts`. With a `guildId`: every post of that server, whoever wrote it (managers only). */
export interface MyPostsParams {
  guildId?: Snowflake;
  status?: PostStatus;
}

export type StaffExperienceStatus = VerificationStatus;
export type StaffReportStatus = ReportStatus | 'all';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** One entry of a standard 422 (`detail[]`). Pydantic's `msg` is English; Lineup's own rules are French. */
export interface ValidationIssue {
  type: string;
  /** `['body', 'title']`, `['body', 'requirements', 2, 'value']`, `['query', 'limit']`… */
  loc: Array<string | number>;
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

/** The sanction behind a 403 `user_suspended` or `guild_suspended` (LINEUP.md §0, shape 2). */
export interface SanctionInfo {
  code: 'user_suspended' | 'guild_suspended';
  level: string;
  subject_type: string;
  subject_id: Snowflake;
  /** Short codes to quote to the support (`A7F2K9`). */
  references: string[];
  /** Null: no end date. */
  expires_at: IsoDateTime | null;
  /** French, from the API. Prefer our own text. */
  message: string;
  /** Where the person can read the sanction; null if the API sent none. */
  violations_url: string | null;
}

/** `GET /lineup/me/experiences`, `PUT …/order`: the person's own experiences, in their order. */
export interface ExperienceList {
  items: PrivateExperience[];
}
