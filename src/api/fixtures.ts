/**
 * Factories for API objects: complete, valid, overridable. Used by the tests
 * (and available to the development mock). Not imported by the app.
 */

import type {
  GuildProfile,
  Me,
  MyGuild,
  Paginated,
  Post,
  PostWriteResult,
  PrivateExperience,
  PrivatePost,
  Report,
  StaffExperience,
  UserProfile,
} from './types';

export const ME_ID = '345678901234567890';
export const GUILD_ID = '812345678901234567';

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

/** A UUID-shaped id, unique and ordered by creation. */
export function uuid(): string {
  return `00000000-0000-4000-8000-${String(next()).padStart(12, '0')}`;
}

export function makePost(overrides: Partial<Post> = {}): Post {
  const id = overrides.id ?? uuid();
  const kind = overrides.kind ?? 'guild';
  const guildId = overrides.guild_id !== undefined ? overrides.guild_id : kind === 'guild' ? GUILD_ID : null;
  return {
    id,
    kind,
    guild_id: guildId,
    author_id: ME_ID,
    title: 'Cherche 2 modérateurs',
    description: 'Une description d’au moins vingt caractères.',
    positions: ['moderator'],
    positions_other: [],
    requirements: [],
    application: null,
    languages: ['fr'],
    timezone: null,
    commitment: null,
    theme: null,
    tags: [],
    featured_experience_id: null,
    status: 'published',
    expires_at: null,
    published_at: '2026-10-20T14:03:11.482913+00:00',
    created_at: '2026-10-20T13:58:02.100000+00:00',
    updated_at: '2026-10-20T14:03:11.482913+00:00',
    is_expired: false,
    guild: guildId ? {id: guildId, name: 'Cubelands FR', icon_url: null} : null,
    author: {id: ME_ID, username: 'alex', global_name: 'Alex', avatar_url: null},
    ...overrides,
  };
}

export function makePrivatePost(overrides: Partial<PrivatePost> = {}): PrivatePost {
  return {...makePost(overrides), hidden_reason: null, ...overrides};
}

export function makeWrittenPost(overrides: Partial<PostWriteResult> = {}): PostWriteResult {
  return {...makePrivatePost(overrides), can_edit: true, ...overrides};
}

/** A post created `minutes` after a fixed origin: later is newer. */
export function postCreatedAt(minutes: number, overrides: Partial<PrivatePost> = {}): PrivatePost {
  const created = new Date(Date.UTC(2026, 9, 20, 10, minutes)).toISOString();
  return makePrivatePost({created_at: created, updated_at: created, ...overrides});
}

export function makeExperience(overrides: Partial<PrivateExperience> = {}): PrivateExperience {
  return {
    id: uuid(),
    kind: 'guild',
    guild_id: GUILD_ID,
    name: 'Cubelands FR',
    invite_url: 'https://discord.gg/cubelands',
    guild: null,
    position: 'moderator',
    position_other: null,
    description: null,
    start_date: '2024-03-01',
    end_date: null,
    is_current: true,
    sort_index: 0,
    verification: {status: 'unverified', method: null, verified_at: null, evidence: null, rejection_reason: null},
    created_at: '2026-10-20T14:09:12.000000+00:00',
    updated_at: '2026-10-20T14:09:12.000000+00:00',
    ...overrides,
  };
}

export function makeStaffExperience(overrides: Partial<StaffExperience> = {}): StaffExperience {
  return {...makeExperience(overrides), user_id: ME_ID, ...overrides};
}

export function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: ME_ID,
    username: 'alex',
    global_name: 'Alex',
    display_name: 'Alex',
    avatar_url: null,
    banner_url: null,
    accent_color: null,
    avatar_decoration: null,
    nameplate: null,
    display_name_styles: null,
    primary_guild: null,
    headline: null,
    bio: null,
    links: [],
    languages: ['fr'],
    timezone: null,
    open_to_work: false,
    created_at: '2018-05-02T10:11:12.345000+00:00',
    badges: [],
    posts: [],
    experiences: [],
    is_self: true,
    stale: false,
    ...overrides,
  };
}

export function makeGuildProfile(overrides: Partial<GuildProfile> = {}): GuildProfile {
  return {
    id: GUILD_ID,
    name: 'Cubelands FR',
    icon_url: null,
    banner_url: null,
    splash_url: null,
    description: 'Le plus grand serveur de survie.',
    discord_description: null,
    invite: {code: 'cubelands', url: 'https://discord.gg/cubelands', valid: true},
    links: [],
    theme: 'gaming',
    tags: ['minecraft'],
    languages: ['fr'],
    boosts: 14,
    boost_tier: null,
    member_count: 4120,
    presence_count: 640,
    created_at: '2021-02-14T09:12:31.231000+00:00',
    badges: [],
    has_moddy: true,
    listed: true,
    posts: [],
    team: [],
    stale: false,
    can_manage: true,
    ...overrides,
  };
}

export function makeMe(overrides: Partial<Me['user']> = {}): Me {
  return {
    user: {
      id: ME_ID,
      username: 'alex',
      global_name: 'Alex',
      avatar_url: null,
      banner_url: null,
      avatar_decoration_data: null,
      is_staff: false,
      ...overrides,
    },
    has_lineup_scopes: true,
    login_url: '/lineup/auth/login',
    profile: null,
  };
}

export function makeMyGuild(overrides: Partial<MyGuild> = {}): MyGuild {
  return {id: GUILD_ID, name: 'Cubelands FR', icon_url: null, has_moddy: true, claimed: false, ...overrides};
}

export function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: uuid(),
    target_type: 'post',
    target_id: uuid(),
    reporter_id: '456789012345678901',
    reason: 'scam',
    details: null,
    status: 'open',
    handled_by: null,
    created_at: '2026-10-20T16:20:00.000000+00:00',
    ...overrides,
  };
}

/** One page of a list. */
export function page<T>(items: T[], nextCursor: string | null = null): Paginated<T> {
  return {items, next_cursor: nextCursor};
}

/** Cached infinite-query data from pages. */
export function infinite<T>(...pages: Array<Paginated<T>>) {
  return {pages, pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index}`))};
}
