/**
 * The editor's form: its state, the rules of each step (from the catalog's
 * `limits`, LINEUP.md §4), the request bodies, and the way a server error finds
 * its step and field. Pure functions, no React: form.test.ts covers them.
 */

import type {
  ApplicationInput,
  Catalog,
  CommitmentInput,
  CreatePostBody,
  Post,
  PostKind,
  RequirementInput,
  UpdatePostBody,
  ValidationIssue,
} from '@/api/types';
import {FIELD_LIMITS} from '@/api/limits';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const STEP_IDS = [
  'type',
  'content',
  'positions',
  'requirements',
  'application',
  'commitment',
  'extras',
  'review',
] as const;
export type StepId = (typeof STEP_IDS)[number];

/**
 * The steps shown. The type step is left out when something already fixes the
 * author: editing, the dashboard of a server (`?guild=`) or a bot (`?bot=`), the personal
 * dashboard (`?kind=user`).
 */
export function stepsFor(typeFixed: boolean): StepId[] {
  return STEP_IDS.filter((id) => !(typeFixed && id === 'type'));
}

export interface RequirementDraft {
  /** Stable key for React lists. */
  key: string;
  type: string;
  /** `int` and `text` values, as typed. */
  text: string;
  /** `bool` value. */
  flag: boolean;
  /** `languages` value. */
  langs: string[];
  /** `custom` title. */
  label: string;
  verified: boolean;
}

export interface FormState {
  kind: PostKind | '';
  guildId: string;
  /** A bot post: the bot that recruits. */
  botId: string;
  title: string;
  description: string;
  positions: string[];
  positionsOther: string[];
  requirements: RequirementDraft[];
  /** '' none, or an application type id. */
  applicationType: string;
  applicationUrl: string;
  hours: string;
  compensation: string;
  openings: string;
  languages: string[];
  timezone: string;
  theme: string;
  tags: string[];
  /** `YYYY-MM-DD` in the person's day, or '' for never. */
  expiresOn: string;
  featuredExperienceId: string;
}

export const EMPTY_FORM: FormState = {
  kind: '',
  guildId: '',
  botId: '',
  title: '',
  description: '',
  positions: [],
  positionsOther: [],
  requirements: [],
  applicationType: '',
  applicationUrl: '',
  hours: '',
  compensation: '',
  openings: '',
  languages: [],
  timezone: '',
  theme: '',
  tags: [],
  expiresOn: '',
  featuredExperienceId: '',
};

let requirementCounter = 0;
export function newRequirementKey(): string {
  requirementCounter += 1;
  return `r${Date.now().toString(36)}${requirementCounter}`;
}

export function emptyRequirement(type = ''): RequirementDraft {
  return {key: newRequirementKey(), type, text: '', flag: true, langs: [], label: '', verified: false};
}

// ---------------------------------------------------------------------------
// Dates and zones
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of a date in the local day. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** The earliest and latest day an expiry can be (tomorrow, and `maxDays` from today). */
export function expiryBounds(now: Date, maxDays: number): {min: string; max: string} {
  return {min: localDay(addDays(now, 1)), max: localDay(addDays(now, maxDays))};
}

/**
 * The instant an expiry day means: the end of that day, in the person's zone,
 * and never later than the API allows (now + `maxDays`).
 */
export function expiryInstant(day: string, now: Date, maxDays: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0, 0);
  if (Number.isNaN(+end)) return null;
  const latest = new Date(+now + maxDays * 86_400_000 - 120_000);
  return (end > latest ? latest : end).toISOString();
}

const UTC_ZONE = /^UTC([+-])(\d{2}):(\d{2})$/;

/** An IANA name this browser knows, or `UTC±HH:MM` (hours 00 to 14, minutes 00 to 59). */
export function isValidTimezone(value: string): boolean {
  if (value.length === 0 || value.length > FIELD_LIMITS.timezoneMax) return false;
  const match = UTC_ZONE.exec(value);
  if (match) return Number(match[2]) <= 14 && Number(match[3]) <= 59;
  if (/\s/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', {timeZone: value});
    return true;
  } catch {
    return false;
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Tags and URLs
// ---------------------------------------------------------------------------

/** A tag as the API stores it: trimmed, lower-cased. */
export function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/^#/, '');
}

export function tagMatches(tag: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(tag);
  } catch {
    return /^[a-z0-9-]{2,24}$/.test(tag);
  }
}

/** https only, 500 characters at most, no credentials, no spaces, port 443 or none. */
export function isValidHttpsUrl(value: string): boolean {
  if (value.length === 0 || value.length > FIELD_LIMITS.link.urlMax || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (url.port === '' || url.port === '443');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** What is wrong with a field: a key of `editor:validation` and its numbers. */
export interface Issue {
  message: string;
  params?: Record<string, string | number>;
}

export type Issues = Record<string, Issue>;

export interface Rules {
  catalog: Catalog;
  now: Date;
  /** The expiry day the post already has (edit): an unchanged one is not checked. */
  unchangedExpiry?: string;
  /** Claimed servers of the person. */
  claimedGuildIds?: readonly string[];
  /** The bots the person manages (`GET /lineup/me/bots`). */
  myBotIds?: readonly string[];
  /** The ids of the person's verified experiences. */
  verifiedExperienceIds?: readonly string[];
}

const intOf = (text: string): number | null => (/^-?\d+$/.test(text.trim()) ? Number(text) : null);

/** The step each form field belongs to. */
const FIELD_STEPS: Array<[prefix: string, step: StepId]> = [
  ['kind', 'type'],
  ['guildId', 'type'],
  ['botId', 'type'],
  ['title', 'content'],
  ['description', 'content'],
  ['positions', 'positions'],
  ['positionsOther', 'positions'],
  ['requirements', 'requirements'],
  ['application', 'application'],
  ['commitment', 'commitment'],
  ['languages', 'commitment'],
  ['timezone', 'commitment'],
  ['theme', 'extras'],
  ['tags', 'extras'],
  ['expiresOn', 'extras'],
  ['featuredExperienceId', 'extras'],
];

export function stepOfField(field: string): StepId | null {
  const root = field.split('.')[0]!;
  return FIELD_STEPS.find(([prefix]) => prefix === root)?.[1] ?? null;
}

export function validateStep(step: StepId, form: FormState, rules: Rules, editing: boolean): Issues {
  const {limits} = rules.catalog;
  const issues: Issues = {};
  const fail = (key: string, message: string, params?: Issue['params']) => {
    issues[key] ??= {message, params};
  };

  switch (step) {
    case 'type': {
      if (editing) break;
      if (form.kind === '') fail('kind', 'kindRequired');
      else if (form.kind === 'guild') {
        if (form.guildId === '') fail('guildId', 'guildRequired');
        else if (rules.claimedGuildIds && !rules.claimedGuildIds.includes(form.guildId)) {
          fail('guildId', 'guildNotClaimed');
        }
      } else if (form.kind === 'bot') {
        if (form.botId === '') fail('botId', 'botRequired');
        else if (rules.myBotIds && !rules.myBotIds.includes(form.botId)) fail('botId', 'botNotManaged');
      }
      break;
    }
    case 'content': {
      const title = form.title.trim();
      if (title.length === 0) fail('title', 'required');
      else if (title.length < limits.title.min) fail('title', 'tooShort', {count: limits.title.min});
      else if (title.length > limits.title.max) fail('title', 'tooLong', {count: limits.title.max});
      const description = form.description.trim();
      if (description.length === 0) fail('description', 'required');
      else if (description.length < limits.description.min) {
        fail('description', 'tooShort', {count: limits.description.min});
      } else if (description.length > limits.description.max) {
        fail('description', 'tooLong', {count: limits.description.max});
      }
      break;
    }
    case 'positions': {
      if (form.positions.length === 0) fail('positions', 'positionsMin');
      else if (form.positions.length > limits.max_positions) {
        fail('positions', 'positionsMax', {count: limits.max_positions});
      }
      if (form.positions.includes('other')) {
        const labels = form.positionsOther.map((label) => label.trim());
        if (labels.length === 0) fail('positionsOther', 'otherRequired');
        if (labels.length > limits.max_positions_other) {
          fail('positionsOther', 'otherMax', {count: limits.max_positions_other});
        }
        labels.forEach((label, index) => {
          if (label.length === 0) fail(`positionsOther.${index}`, 'required');
          else if (label.length > limits.position_other_max_len) {
            fail(`positionsOther.${index}`, 'tooLong', {count: limits.position_other_max_len});
          }
        });
      }
      break;
    }
    case 'requirements': {
      if (form.requirements.length > limits.max_requirements) {
        fail('requirements', 'requirementsMax', {count: limits.max_requirements});
      }
      form.requirements.forEach((draft, index) => {
        const entry = rules.catalog.requirements.find((candidate) => candidate.id === draft.type);
        const base = `requirements.${index}`;
        if (!entry) {
          fail(`${base}.type`, 'required');
          return;
        }
        if (entry.requires_label) {
          const label = draft.label.trim();
          const max = entry.label_max_len ?? 80;
          if (label.length === 0) fail(`${base}.label`, 'required');
          else if (label.length > max) fail(`${base}.label`, 'tooLong', {count: max});
        }
        switch (entry.value_type) {
          case 'int': {
            const value = intOf(draft.text);
            const min = entry.min ?? 0;
            const max = entry.max ?? Number.MAX_SAFE_INTEGER;
            if (draft.text.trim() === '') fail(`${base}.value`, 'required');
            else if (value === null) fail(`${base}.value`, 'integer');
            else if (value < min || value > max) fail(`${base}.value`, 'between', {min, max});
            break;
          }
          case 'text': {
            const text = draft.text.trim();
            const max = entry.max_len ?? 200;
            if (text.length === 0) fail(`${base}.value`, 'required');
            else if (text.length > max) fail(`${base}.value`, 'tooLong', {count: max});
            break;
          }
          case 'languages':
            if (draft.langs.length === 0) fail(`${base}.value`, 'languagesMin');
            else if (draft.langs.length > limits.max_languages) {
              fail(`${base}.value`, 'languagesMax', {count: limits.max_languages});
            }
            break;
          default:
            break;
        }
      });
      break;
    }
    case 'application': {
      if (form.applicationType === '') break;
      const entry = rules.catalog.application_types.find((candidate) => candidate.id === form.applicationType);
      if (!entry || !entry.available) fail('application', 'formUnavailable');
      else if (entry.needs_url) {
        const url = form.applicationUrl.trim();
        if (url.length === 0) fail('application.url', 'required');
        else if (!isValidHttpsUrl(url)) fail('application.url', 'urlHttps');
      }
      break;
    }
    case 'commitment': {
      const {hoursMin, hoursMax, openingsMin, openingsMax} = FIELD_LIMITS.commitment;
      if (form.hours.trim() !== '') {
        const value = intOf(form.hours);
        if (value === null) fail('commitment.hours_per_week', 'integer');
        else if (value < hoursMin || value > hoursMax) {
          fail('commitment.hours_per_week', 'between', {min: hoursMin, max: hoursMax});
        }
      }
      if (form.openings.trim() !== '') {
        const value = intOf(form.openings);
        if (value === null) fail('commitment.openings', 'integer');
        else if (value < openingsMin || value > openingsMax) {
          fail('commitment.openings', 'between', {min: openingsMin, max: openingsMax});
        }
      }
      if (form.languages.length > limits.max_languages)
        fail('languages', 'languagesMax', {count: limits.max_languages});
      if (form.timezone.trim() !== '' && !isValidTimezone(form.timezone.trim())) fail('timezone', 'timezone');
      break;
    }
    case 'extras': {
      if (form.tags.length > limits.max_tags) fail('tags', 'tagsMax', {count: limits.max_tags});
      form.tags.forEach((tag, index) => {
        if (!tagMatches(tag, limits.tag_pattern)) fail(`tags.${index}`, 'tag');
      });
      if (form.expiresOn !== '' && form.expiresOn !== rules.unchangedExpiry) {
        const {min, max} = expiryBounds(rules.now, limits.post_max_expiry_days);
        if (form.expiresOn < min) fail('expiresOn', 'expiryMin');
        else if (form.expiresOn > max) fail('expiresOn', 'expiryMax', {count: limits.post_max_expiry_days});
      }
      if (form.featuredExperienceId !== '') {
        if (form.kind !== 'user') fail('featuredExperienceId', 'featuredUserOnly');
        else if (rules.verifiedExperienceIds && !rules.verifiedExperienceIds.includes(form.featuredExperienceId)) {
          fail('featuredExperienceId', 'featuredNotVerified');
        }
      }
      break;
    }
    case 'review':
      break;
  }
  return issues;
}

/** Every step's issues, in step order. */
export function validateAll(form: FormState, rules: Rules, editing: boolean): Partial<Record<StepId, Issues>> {
  const result: Partial<Record<StepId, Issues>> = {};
  for (const step of STEP_IDS) {
    const issues = validateStep(step, form, rules, editing);
    if (Object.keys(issues).length > 0) result[step] = issues;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

/** The fields of a post that both a creation and an update carry. */
export type Payload = Required<Omit<UpdatePostBody, 'expires_at'>> & {expires_at: string | null};

function requirementPayload(draft: RequirementDraft, catalog: Catalog): RequirementInput {
  const entry = catalog.requirements.find((candidate) => candidate.id === draft.type);
  const out: RequirementInput = {type: draft.type};
  switch (entry?.value_type) {
    case 'int':
      out.value = Number(draft.text);
      break;
    case 'text':
      out.value = draft.text.trim();
      break;
    case 'bool':
      out.value = draft.flag;
      break;
    case 'languages':
      out.value = draft.langs;
      break;
    default:
      break;
  }
  if (entry?.requires_label) out.label = draft.label.trim();
  const canVerify = entry !== undefined && entry.verifiable !== 'no';
  out.verified_by_lineup = canVerify && draft.verified;
  return out;
}

/** The post the form describes, as the API takes it. `expires_at` of an unchanged day is `keepExpiresAt`. */
export function toPayload(
  form: FormState,
  catalog: Catalog,
  now: Date,
  keep?: {expiresOn: string; expiresAt: string | null},
): Payload {
  const hasOther = form.positions.includes('other');
  const commitment: CommitmentInput = {};
  if (form.hours.trim() !== '') commitment.hours_per_week = Number(form.hours);
  if (form.compensation !== '') commitment.compensation = form.compensation;
  if (form.openings.trim() !== '') commitment.openings = Number(form.openings);

  let application: ApplicationInput | null = null;
  if (form.applicationType === 'external_url') {
    application = {type: 'external_url', url: form.applicationUrl.trim()};
  } else if (form.applicationType === 'discord_dm') {
    application = {type: 'discord_dm'};
  }

  let expiresAt: string | null = null;
  if (form.expiresOn !== '') {
    expiresAt =
      keep && keep.expiresOn === form.expiresOn
        ? keep.expiresAt
        : expiryInstant(form.expiresOn, now, catalog.limits.post_max_expiry_days);
  }

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    positions: form.positions,
    positions_other: hasOther ? form.positionsOther.map((label) => label.trim()) : [],
    requirements: form.requirements.map((draft) => requirementPayload(draft, catalog)),
    application,
    languages: form.languages,
    timezone: form.timezone.trim() === '' ? null : form.timezone.trim(),
    commitment: Object.keys(commitment).length > 0 ? commitment : null,
    theme: form.theme === '' ? null : form.theme,
    tags: form.tags,
    featured_experience_id: form.kind === 'user' && form.featuredExperienceId !== '' ? form.featuredExperienceId : null,
    expires_at: expiresAt,
  };
}

export function toCreateBody(
  form: FormState,
  catalog: Catalog,
  now: Date,
  status: 'draft' | 'published',
): CreatePostBody {
  const payload = toPayload(form, catalog, now);
  const common = {...payload, status};
  if (form.kind === 'guild') return {...common, kind: 'guild', guild_id: form.guildId};
  if (form.kind === 'bot') return {...common, kind: 'bot', bot_id: form.botId};
  return {...common, kind: 'user'};
}

/** Only what differs between the form and the post as it was loaded; an explicit null clears. */
export function toUpdateBody(form: FormState, base: Post, catalog: Catalog, now: Date): UpdatePostBody {
  const original = formFromPost(base);
  const keep = {expiresOn: original.expiresOn, expiresAt: base.expires_at};
  const next = toPayload(form, catalog, now, keep);
  const previous = toPayload(original, catalog, now, keep);
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(next) as Array<keyof Payload>) {
    if (JSON.stringify(next[key]) !== JSON.stringify(previous[key])) body[key] = next[key];
  }
  return body as UpdatePostBody;
}

// ---------------------------------------------------------------------------
// From a post
// ---------------------------------------------------------------------------

export function formFromPost(post: Post): FormState {
  return {
    kind: post.kind,
    guildId: post.guild_id ?? '',
    botId: post.bot_id ?? '',
    title: post.title,
    description: post.description,
    positions: post.positions,
    positionsOther: post.positions_other,
    requirements: post.requirements.map((requirement) => ({
      key: newRequirementKey(),
      type: requirement.type,
      text:
        typeof requirement.value === 'number' || typeof requirement.value === 'string' ? String(requirement.value) : '',
      flag: typeof requirement.value === 'boolean' ? requirement.value : true,
      langs: Array.isArray(requirement.value) ? requirement.value : [],
      label: requirement.label ?? '',
      verified: requirement.verified_by_lineup,
    })),
    applicationType: post.application?.type ?? '',
    applicationUrl: post.application?.url ?? '',
    hours: post.commitment?.hours_per_week != null ? String(post.commitment.hours_per_week) : '',
    compensation: post.commitment?.compensation ?? '',
    openings: post.commitment?.openings != null ? String(post.commitment.openings) : '',
    languages: post.languages,
    timezone: post.timezone ?? '',
    theme: post.theme ?? '',
    tags: post.tags,
    expiresOn: post.expires_at ? localDay(new Date(post.expires_at)) : '',
    featuredExperienceId: post.featured_experience_id ?? '',
  };
}

// ---------------------------------------------------------------------------
// Server validation errors
// ---------------------------------------------------------------------------

/** The form field a `detail[].loc` of the API points at (`requirements.2.value` stays as is). */
export function formFieldOfServerPath(path: string): string {
  const [head, ...rest] = path.split('.');
  const tail = rest.length > 0 ? `.${rest.join('.')}` : '';
  switch (head) {
    case 'guild_id':
      return 'guildId';
    case 'bot_id':
      return 'botId';
    case 'positions_other':
      return `positionsOther${tail}`;
    case 'featured_experience_id':
      return 'featuredExperienceId';
    case 'expires_at':
      return 'expiresOn';
    case 'application':
      return rest[0] === 'url' ? 'application.url' : 'application';
    case 'commitment':
      return `commitment${tail}`;
    default:
      return path;
  }
}

export interface MappedIssue {
  field: string;
  step: StepId;
  issue: ValidationIssue;
}

/** Each issue of a 422 with the field and the step it belongs to; a field with no step lands on the review. */
export function mapServerIssues(issues: readonly ValidationIssue[] | null | undefined): MappedIssue[] {
  return (issues ?? []).map((issue) => {
    const [head, ...rest] = issue.loc;
    const parts = head === 'body' ? rest : issue.loc;
    const field = formFieldOfServerPath(parts.join('.'));
    return {field, step: stepOfField(field) ?? 'review', issue};
  });
}

// ---------------------------------------------------------------------------
// Local draft
// ---------------------------------------------------------------------------

export interface StoredDraft {
  version: 1;
  savedAt: number;
  step: StepId;
  form: FormState;
}

export const draftKey = (postId?: string) => `lineup.postDraft.${postId ?? 'new'}`;

export function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Partial<StoredDraft>;
  return (
    draft.version === 1 &&
    typeof draft.savedAt === 'number' &&
    typeof draft.form === 'object' &&
    draft.form !== null &&
    typeof draft.form.title === 'string' &&
    Array.isArray(draft.form.positions) &&
    Array.isArray(draft.form.requirements) &&
    (STEP_IDS as readonly string[]).includes(draft.step as string)
  );
}

/** A stored form with any field the current version knows and the stored one lacks filled in. */
export function mergeStoredForm(stored: Partial<FormState>): FormState {
  return {...EMPTY_FORM, ...stored};
}

export function formsEqual(a: FormState, b: FormState): boolean {
  const strip = (form: FormState) => ({...form, requirements: form.requirements.map(({key: _key, ...rest}) => rest)});
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
